// Interactive glowing particle live wallpaper background for login/signup
window.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        canvas.style.position = 'fixed';
        canvas.style.top = 0;
        canvas.style.left = 0;
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = 0;
        canvas.style.pointerEvents = 'none';
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

function randomColor() {
    const colors = [
        [0, 198, 251],
        [0, 91, 234],
        [0, 255, 203],
        [0, 168, 255],
        [0, 255, 255]
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

class Particle {
    constructor() {
        this.radius = 44 + Math.random() * 24;
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.color = randomColor();
        this.vx = (Math.random() - 0.5) * 1.2;
        this.vy = (Math.random() - 0.5) * 1.2;
        this.baseSpeed = 0.2 + Math.random() * 0.13;
    }
    update(mouse) {
        // Mouse repel
        let dx = this.x - mouse.x;
        let dy = this.y - mouse.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 140) {
            let angle = Math.atan2(dy, dx);
            let force = (140 - dist) / 140 * 1.8;
            this.vx += Math.cos(angle) * force * 0.05;
            this.vy += Math.sin(angle) * force * 0.05;
        }
        // Inertia
        this.vx *= 0.97;
        this.vy *= 0.97;
        // Base random walk
        this.vx += (Math.random() - 0.5) * this.baseSpeed * 0.1;
        this.vy += (Math.random() - 0.5) * this.baseSpeed * 0.1;
        this.x += this.vx;
        this.y += this.vy;
        // Bounds
        if (this.x < -this.radius) this.x = width + this.radius;
        if (this.x > width + this.radius) this.x = -this.radius;
        if (this.y < -this.radius) this.y = height + this.radius;
        if (this.y > height + this.radius) this.y = -this.radius;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.19;
        const grad = ctx.createRadialGradient(
            this.x, this.y, this.radius * 0.3,
            this.x, this.y, this.radius
        );
        grad.addColorStop(0, `rgba(${this.color[0]},${this.color[1]},${this.color[2]},1)`);
        grad.addColorStop(1, `rgba(${this.color[0]},${this.color[1]},${this.color[2]},0)`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.filter = 'blur(8px)';
        ctx.fill();
        ctx.restore();
    }
}

let particles = [];
let mouse = { x: width/2, y: height/2 };
function resetParticles() {
    particles = [];
    for (let i = 0; i < 13; i++) particles.push(new Particle());
}
resetParticles();
window.addEventListener('resize', () => {
    resizeCanvas();
    resetParticles();
});

canvas.addEventListener('mousemove', function(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
canvas.addEventListener('touchmove', function(e) {
    if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
    }
}, {passive:true});

function animate() {
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
        p.update(mouse);
        p.draw(ctx);
    }
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
});
