const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}
function saveUsers(usersArr) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersArr, null, 2));
}
function getUser(username) {
    return loadUsers().find(u => u.username === username);
}
function updateUser(user) {
    let users = loadUsers();
    users = users.map(u => u.username === user.username ? user : u);
    saveUsers(users);
}
function addUser(user) {
    const users = loadUsers();
    users.push(user);
    saveUsers(users);
}
const friendRequests = new Map();
const onlineUsers = new Map();

app.post('/api/register', async (req, res) => {
    const { username, password, displayName } = req.body;
    
    if (getUser(username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
        username,
        password: hashedPassword,
        displayName,
        friends: [],
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`
    };

    addUser(user);
    res.json({ username, displayName, avatar: user.avatar, friends: [] });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = getUser(username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
        username,
        displayName: user.displayName,
        avatar: user.avatar,
        friends: user.friends
    });
});

// Friend management routes
app.post('/api/friend-request', (req, res) => {
    const { from, to } = req.body;
    if (from === to) {
        return res.status(400).json({ error: 'Cannot add yourself as a friend' });
    }
    const fromUser = getUser(from);
    const toUser = getUser(to);
    if (!toUser) {
        return res.status(404).json({ error: 'User not found' });
    }
    if (fromUser.friends && fromUser.friends.includes(to)) {
        return res.status(400).json({ error: 'Already friends' });
    }
    // Prevent duplicate requests
    const requests = friendRequests.get(to) || [];
    if (!requests.includes(from)) {
        requests.push(from);
        friendRequests.set(to, requests);
        const toSocket = onlineUsers.get(to);
        if (toSocket) {
            io.to(toSocket).emit('friendRequest', { from });
        }
    } else {
        return res.status(400).json({ error: 'Friend request already sent' });
    }
    res.json({ message: 'Friend request sent' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('login', (username) => {
        onlineUsers.set(username, socket.id);
        socket.username = username;
        
        const requests = friendRequests.get(username) || [];
        requests.forEach(from => {
            socket.emit('friendRequest', { from });
        });
    });

    socket.on('message', ({ to, content }) => {
        const recipientSocket = onlineUsers.get(to);
        if (recipientSocket) {
            io.to(recipientSocket).emit('message', {
                from: socket.username,
                content
            });
        }
    });

    socket.on('acceptFriend', ({ from }) => {
        const user = getUser(socket.username);
        const fromUser = getUser(from);
        if (user && fromUser) {
            if (!user.friends.includes(from)) user.friends.push(from);
            if (!fromUser.friends.includes(socket.username)) fromUser.friends.push(socket.username);
            updateUser(user);
            updateUser(fromUser);
            const requests = friendRequests.get(socket.username) || [];
            friendRequests.set(
                socket.username,
                requests.filter(req => req !== from)
            );
            const fromSocket = onlineUsers.get(from);
            if (fromSocket) {
                io.to(fromSocket).emit('friendAccepted', { by: socket.username });
            }
            // Send updated friends list to both users
            const userSocket = onlineUsers.get(socket.username);
            if (userSocket) {
                io.to(userSocket).emit('friendsUpdate', { friends: user.friends });
            }
            if (fromSocket) {
                io.to(fromSocket).emit('friendsUpdate', { friends: fromUser.friends });
            }
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            onlineUsers.delete(socket.username);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
