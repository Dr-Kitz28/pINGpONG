// === CONFIG ===
const WIN_SCORE = 10;
const PADDLE_WIDTH = 16;
const PADDLE_HEIGHT = 110;
const BALL_RADIUS = 10;
const PLAYER_X = 30;
const AI_X = 800 - PADDLE_WIDTH - 30; // canvas.width - PADDLE_WIDTH - 30
const AI_SPEED = 4;
const PADDLE_CURVE_RADIUS = 90; // For concave paddle rendering

// === DOM ===
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const aiBtn = document.getElementById('aiBtn');
const pvpBtn = document.getElementById('pvpBtn');
const winnerDiv = document.getElementById('winner');
const winnerText = document.getElementById('winnerText');
const restartBtn = document.getElementById('restartBtn');

// === GAME STATE ===
let player1Y, player2Y, ballX, ballY, ballSpeedX, ballSpeedY;
let player1Score, player2Score;
let mode = null; // 'ai' or 'pvp'
let running = false;
let mouseY = 0;

// === MENU HANDLERS ===
aiBtn.onclick = () => startGame('ai');
pvpBtn.onclick = () => startGame('pvp');
restartBtn.onclick = () => {
    winnerDiv.style.display = 'none';
    menu.style.display = '';
    canvas.style.display = 'none';
};

function startGame(selectedMode) {
    mode = selectedMode;
    player1Y = (canvas.height - PADDLE_HEIGHT) / 2;
    player2Y = (canvas.height - PADDLE_HEIGHT) / 2;
    player1Score = 0;
    player2Score = 0;
    resetBall(Math.random() > 0.5 ? 1 : -1);
    running = true;
    mouseY = player1Y;
    menu.style.display = 'none';
    winnerDiv.style.display = 'none';
    canvas.style.display = '';
    requestAnimationFrame(gameLoop);
}

// === INPUT HANDLERS ===
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseY = e.clientY - rect.top - PADDLE_HEIGHT/2;
});
document.addEventListener('keydown', e => {
    if (mode === 'pvp') {
        // W/S for Player 1 (left), Up/Down for Player 2 (right)
        if (e.key === 'w' || e.key === 'W') player1Y -= 32;
        if (e.key === 's' || e.key === 'S') player1Y += 32;
        if (e.key === 'ArrowUp') player2Y -= 32;
        if (e.key === 'ArrowDown') player2Y += 32;
    }
});

// === DRAWING ===
function drawPaddle(x, y, color, flip=false) {
    ctx.save();
    ctx.translate(x + (flip ? PADDLE_WIDTH : 0), y + PADDLE_HEIGHT/2);

    ctx.beginPath();
    // Concave arc for paddle
    ctx.lineWidth = PADDLE_WIDTH;
    ctx.strokeStyle = color;
    ctx.arc(
        0, 0, 
        PADDLE_CURVE_RADIUS, 
        flip ? Math.PI/2 : Math.PI*1.5, 
        flip ? Math.PI*1.5 : Math.PI/2, 
        flip
    );
    ctx.stroke();
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Center Line
    ctx.strokeStyle = "#fff8";
    ctx.setLineDash([16, 16]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, 0);
    ctx.lineTo(canvas.width/2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles (concave)
    drawPaddle(PLAYER_X, player1Y, "#0af", false);
    drawPaddle(AI_X, player2Y, "#fa0", true);

    // Ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI*2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // Score
    ctx.font = "36px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText(player1Score, canvas.width/2 - 60, 50);
    ctx.fillText(player2Score, canvas.width/2 + 35, 50);
}

// === GAME LOGIC ===
function update() {
    // Paddle controls
    if (mode === 'ai') {
        // Player: mouse
        player1Y = mouseY;
        player1Y = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, player1Y));
        // AI: simple tracking
        let aiCenter = player2Y + PADDLE_HEIGHT/2;
        if (aiCenter < ballY - 20) player2Y += AI_SPEED;
        if (aiCenter > ballY + 20) player2Y -= AI_SPEED;
        player2Y = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, player2Y));
    } else if (mode === 'pvp') {
        // Player 1: W/S (already handled in keydown)
        player1Y = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, player1Y));
        // Player 2: Arrow keys
        player2Y = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, player2Y));
    }

    // Ball movement
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Wall collision
    if (ballY - BALL_RADIUS < 0) {
        ballY = BALL_RADIUS;
        ballSpeedY *= -1;
    } else if (ballY + BALL_RADIUS > canvas.height) {
        ballY = canvas.height - BALL_RADIUS;
        ballSpeedY *= -1;
    }

    // Paddle collision
    if (checkConcavePaddleHit(PLAYER_X, player1Y, false)) {
        ballX = PLAYER_X + PADDLE_WIDTH + BALL_RADIUS;
        applyConcaveBounce(player1Y, false);
    } else if (checkConcavePaddleHit(AI_X, player2Y, true)) {
        ballX = AI_X - BALL_RADIUS;
        applyConcaveBounce(player2Y, true);
    }

    // Score
    if (ballX - BALL_RADIUS < 0) {
        player2Score++;
        if (player2Score >= WIN_SCORE) endGame(mode === 'ai' ? 'AI Wins!' : 'Player 2 Wins!');
        else resetBall(1);
    }
    if (ballX + BALL_RADIUS > canvas.width) {
        player1Score++;
        if (player1Score >= WIN_SCORE) endGame('Player 1 Wins!');
        else resetBall(-1);
    }
}

function endGame(text) {
    running = false;
    winnerText.textContent = text;
    winnerDiv.style.display = '';
    canvas.style.display = 'none';
}

function resetBall(dir) {
    ballX = canvas.width/2;
    ballY = canvas.height/2;
    ballSpeedX = 6 * dir;
    ballSpeedY = 4 * (Math.random() > 0.5 ? 1 : -1);
}

// Concave paddle collision check (roughly, as arc)
function checkConcavePaddleHit(paddleX, paddleY, flip) {
    // Find closest point on arc to ball center
    // For arc center:
    let centerX = paddleX + (flip ? PADDLE_WIDTH : 0);
    let centerY = paddleY + PADDLE_HEIGHT/2;
    let dx = ballX - centerX;
    let dy = ballY - centerY;
    let dist = Math.sqrt(dx*dx + dy*dy);
    // Accept hit if ball is within the arc "thickness" and the angle is inside the arc's sweep
    if (dist > PADDLE_CURVE_RADIUS-BALL_RADIUS-PADDLE_WIDTH/2 && dist < PADDLE_CURVE_RADIUS+BALL_RADIUS+PADDLE_WIDTH/2) {
        let angle = Math.atan2(dy, dx);
        // For left (player1), accept -PI/2 to PI/2, for right (player2), accept PI/2 to 3PI/2
        if (!flip && angle > -Math.PI/2 && angle < Math.PI/2) return true;
        if (flip && (angle < -Math.PI/2 || angle > Math.PI/2)) return true;
    }
    return false;
}

// Concave bounce: reflect angle, add "spin" based on hit position
function applyConcaveBounce(paddleY, flip) {
    // Arc center
    let centerX = (flip ? AI_X + PADDLE_WIDTH : PLAYER_X);
    let centerY = paddleY + PADDLE_HEIGHT/2;
    let dx = ballX - centerX;
    let dy = ballY - centerY;
    let angle = Math.atan2(dy, dx);
    // Compute the normal at collision point
    let normal = angle;
    // Velocity vector
    let speed = Math.sqrt(ballSpeedX*ballSpeedX + ballSpeedY*ballSpeedY);
    let ballAngle = Math.atan2(ballSpeedY, ballSpeedX);
    // Reflect velocity about the normal
    let reflect = 2*normal - ballAngle + Math.PI;
    ballSpeedX = speed * Math.cos(reflect);
    ballSpeedY = speed * Math.sin(reflect);
    // Add some randomness based on contact position
    ballSpeedY += (Math.random() - 0.5) * 2;
    // Slightly increase speed
    ballSpeedX *= 1.05;
    ballSpeedY *= 1.05;
}

// === GAME LOOP ===
function gameLoop() {
    if (!running) return;
    update();
    draw();
    requestAnimationFrame(gameLoop);
}
