document.addEventListener('DOMContentLoaded', async function() {
    const socket = io('http://localhost:3000');
    let currentUser = null;
    let currentContact = null;

    // Check authentication
    const userJson = localStorage.getItem('currentUser');
    if (!userJson) {
        window.location.href = 'login.html';
        return;
    }

    try {
        currentUser = JSON.parse(userJson);
        document.getElementById('current-user-avatar').style.backgroundImage = `url(${currentUser.avatar})`;
        document.getElementById('current-user-name').textContent = currentUser.displayName;
        
        // Connect to Socket.IO
        socket.emit('login', currentUser.username);
    } catch (error) {
        console.error('Error parsing user data:', error);
        window.location.href = 'login.html';
        return;
    }

    // Logout handler
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });

    // Add friend handler
    document.getElementById('add-friend-btn').addEventListener('click', async function() {
        const friendUsername = document.getElementById('friend-username').value.trim();
        if (!friendUsername) return;
        if (friendUsername === currentUser.username) {
            alert("You can't add yourself as a friend.");
            return;
        }
        if (currentUser.friends && currentUser.friends.includes(friendUsername)) {
            alert("This user is already your friend.");
            return;
        }
        // Prevent duplicate add
        const contactsList = document.getElementById('contacts-list');
        for (let el of contactsList.children) {
            if (el.querySelector('.contact-name') && el.querySelector('.contact-name').textContent === friendUsername) {
                alert("This user is already in your contacts.");
                return;
            }
        }
        try {
            const response = await fetch('http://localhost:3000/api/friend-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: currentUser.username,
                    to: friendUsername
                })
            });
            if (response.ok) {
                alert('Friend request sent!');
                document.getElementById('friend-username').value = '';
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to send friend request');
            }
        } catch (error) {
            console.error('Error sending friend request:', error);
            alert('Failed to send friend request');
        }
    });

    // Friend request handler
    socket.on('friendRequest', ({ from }) => {
        const requestsContainer = document.getElementById('friend-requests');
        const requestElement = document.createElement('div');
        requestElement.className = 'friend-request';
        requestElement.innerHTML = `
            <span>Friend request from ${from}</span>
            <button class="accept-btn">Accept</button>
        `;

        requestElement.querySelector('.accept-btn').addEventListener('click', () => {
            socket.emit('acceptFriend', { from });
            requestElement.remove();
        });

        requestsContainer.appendChild(requestElement);
    });

    // Friend accepted handler
    socket.on('friendAccepted', ({ by }) => {
        alert(`${by} accepted your friend request!`);
        addFriendToList(by);
    });

    function addFriendToList(username) {
        const contactsList = document.getElementById('contacts-list');
        // Prevent duplicate display
        for (let el of contactsList.children) {
            if (el.querySelector('.contact-name') && el.querySelector('.contact-name').textContent === username) {
                return;
            }
        }
        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item';
        contactItem.innerHTML = `
            <div class="contact-avatar" style="background-image: url(https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random)"></div>
            <div class="contact-name">${username}</div>
        `;
        contactItem.addEventListener('click', function() {
            currentContact = username;
            document.getElementById('chat-contact-name').textContent = username;
            document.getElementById('chat-contact-avatar').style.backgroundImage = 
                `url(https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random)`;
            document.getElementById('messages').innerHTML = '';
        });
        contactsList.appendChild(contactItem);
    }

    function rebuildFriendsList(friends) {
        const contactsList = document.getElementById('contacts-list');
        contactsList.innerHTML = '';
        if (Array.isArray(friends)) {
            friends.forEach(friend => addFriendToList(friend));
        }
    }

    // Initialize friends list
    if (currentUser.friends) {
        rebuildFriendsList(currentUser.friends);
    }

    // Listen for friends update from server
    socket.on('friendsUpdate', ({ friends }) => {
        currentUser.friends = friends;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        rebuildFriendsList(friends);
    });

    // Message handling
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages');

    function addMessage(text, isReceived = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isReceived ? 'received' : 'sent'}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = text;
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        messageDiv.appendChild(bubble);
        messageDiv.appendChild(time);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendBtn.addEventListener('click', function() {
        const messageText = messageInput.value.trim();
        if (messageText && currentContact) {
            socket.emit('message', {
                to: currentContact,
                content: messageText
            });
            addMessage(messageText);
            messageInput.value = '';
        }
    });

    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendBtn.click();
        }
    });

    // Receive message handler
    socket.on('message', ({ from, content }) => {
        if (from === currentContact) {
            addMessage(content, true);
        }
    });
});
