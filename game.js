// Minimal Alto's Adventure pINGpONG core (straight paddles, NO blocks/powerups, day-night bg)
const WIN_SCORE = 10;
const PADDLE_W = 18, PADDLE_H = 120;
const BALL_RADIUS = 13;
let BOARD_W, BOARD_H, PLAYER_X_RANGE, AI_X_RANGE, Y_RANGE;
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const aiBtn = document.getElementById('aiBtn');
const pvpBtn = document.getElementById('pvpBtn');
const winnerDiv = document.getElementById('winner');
const winnerText = document.getElementById('winnerText');
const restartBtn = document.getElementById('restartBtn');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const scoreboard = document.getElementById('scoreboard');

let player1, player2, ball;
let player1Score, player2Score;
let mode = null;
let running = false, mousePos = {x:0, y:0};
let keys = {};
let lastTime = null;
let lastPaddleBounce = null;
let dayNightProgress = 0;

function setBoardSize() {
    BOARD_W = window.innerWidth;
    BOARD_H = window.innerHeight;
    canvas.width = BOARD_W;
    canvas.height = BOARD_H;
    PLAYER_X_RANGE = [0, BOARD_W/2 - 36 - PADDLE_W];
    AI_X_RANGE = [BOARD_W/2 + 36, BOARD_W - PADDLE_W];
    Y_RANGE = [0, BOARD_H - PADDLE_H];
}
window.addEventListener('resize', setBoardSize);

function resetGameVars() {
    setBoardSize();
    player1 = {x: PLAYER_X_RANGE[0]+12, y: BOARD_H/2-PADDLE_H/2, color: "#7dcfff", lastX: 0, lastY: 0, vx: 0, vy: 0};
    player2 = {x: AI_X_RANGE[1]-12, y: BOARD_H/2-PADDLE_H/2, color: "#ffd47d", lastX: 0, lastY: 0, vx: 0, vy: 0};
    player1Score = 0; player2Score = 0;
    lastPaddleBounce = null;
    resetBall(Math.random()>0.5?1:-1);
}

function startGame(selectedMode) {
    mode = selectedMode;
    resetGameVars();
    running = true;
    menu.style.display = 'none';
    winnerDiv.style.display = 'none';
    canvas.style.display = '';
    scoreboard.style.display = '';
    lastTime = null;
    requestAnimationFrame(gameLoop);
}
function endGame(text) {
    running = false;
    winnerText.textContent = text;
    winnerDiv.style.display = '';
    canvas.style.display = 'none';
    scoreboard.style.display = 'none';
}

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left - PADDLE_W/2;
    mousePos.y = e.clientY - rect.top - PADDLE_H/2;
});
document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
restartBtn.onclick = () => {
    winnerDiv.style.display = 'none';
    menu.style.display = '';
    canvas.style.display = 'none';
};
aiBtn.onclick = () => startGame('ai');
pvpBtn.onclick = () => startGame('pvp');

// === Alto's background ===
function lerpColor(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}
function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
const SKIES = [
    [ [155,191,230], [245,224,196], [255,151,113], [51,49,89] ],
    [ [204,223,238], [176,222,255], [136,110,176], [22,27,46] ],
    [ [233,234,209], [124,190,202], [ 66,80,82 ], [13,25,35] ]
];
const SUN_COLOR = [255,220,120];
const MOON_COLOR = [230,230,255];
function drawAltoBackground(progress) {
    let p = (progress % 1 + 1) % 1, k = Math.floor(p * 4), t = (p * 4) % 1;
    let top = lerpColor(SKIES[0][k], SKIES[0][(k+1)%4], t),
        mid = lerpColor(SKIES[1][k], SKIES[1][(k+1)%4], t),
        bot = lerpColor(SKIES[2][k], SKIES[2][(k+1)%4], t);
    let grad = ctx.createLinearGradient(0, 0, 0, BOARD_H);
    grad.addColorStop(0, rgb(top));
    grad.addColorStop(0.6, rgb(mid));
    grad.addColorStop(1, rgb(bot));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    drawMountains(BOARD_H, 0.18, 0.15, 32, [80, 105, 142], 0.9, progress*0.5, 1.0);
    drawMountains(BOARD_H, 0.32, 0.22, 36, [65, 79, 101], 0.92, progress, 0.5);
    drawMountains(BOARD_H, 0.45, 0.33, 40, [39, 52, 77], 0.88, progress*1.5, 0.25);

    // Sun/moon
    let sunMoonT = (progress + 0.04) % 1;
    let theta = Math.PI * (1 - sunMoonT);
    let cx = BOARD_W/2 + Math.cos(theta)*BOARD_W*0.36;
    let cy = BOARD_H*0.21 - Math.sin(theta)*BOARD_H*0.18;
    let isNight = (k === 3 || (k === 0 && t < 0.2));
    ctx.save();
    ctx.globalAlpha = 0.80;
    ctx.beginPath();
    ctx.arc(cx, cy, isNight ? 40 : 63, 0, Math.PI*2);
    ctx.fillStyle = isNight ? rgb(MOON_COLOR) : rgb(SUN_COLOR);
    ctx.shadowColor = isNight ? "#ccd7ff77" : "#ffeab077";
    ctx.shadowBlur = isNight ? 26 : 48;
    ctx.fill();
    ctx.restore();
    if (isNight) drawStars(ctx, BOARD_W, BOARD_H, 0.14);
}
function drawStars(ctx, w, h, alpha=1) {
    ctx.save();
    ctx.globalAlpha = 0.19*alpha;
    for (let i=0; i<60; ++i) {
        let sx = Math.random()*w, sy = Math.random()*h*0.7, r = Math.random()*1.4+0.5;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
        ctx.fillStyle = "#fff";
        ctx.fill();
    }
    ctx.restore();
}
function drawMountains(h, topFrac, baseFrac, detail, color, alpha, xshift, parallax) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    let y0 = h*topFrac, y1 = h*baseFrac, w = BOARD_W;
    ctx.moveTo(0, h);
    for (let i = 0; i <= detail; ++i) {
        let t = i / detail, px = t*w;
        let base = y0 + (y1-y0)*Math.pow(Math.sin(Math.PI*t), 3);
        let noise =
            Math.sin(xshift*5 + i*0.6 + Math.cos(xshift*2+t*6)*1.2) * 12 +
            Math.sin(xshift*2.2 + i*1.5) * 18 * (0.5-Math.abs(t-0.5));
        ctx.lineTo(px, base + noise*parallax);
    }
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = rgb(color);
    ctx.fill(); ctx.restore();
}

// === DRAWING ===
function drawPaddle(p) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, PADDLE_W, PADDLE_H);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.29;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff7";
    ctx.stroke();
    ctx.restore();
}

function drawBall() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI*2);
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#7dcfff";
    ctx.shadowBlur = 34;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#fff8";
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
}

function drawCenterLine(){
    ctx.save();
    ctx.strokeStyle = "#fff2";
    ctx.setLineDash([13, 12]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(BOARD_W/2, 0);
    ctx.lineTo(BOARD_W/2, BOARD_H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function drawScore(){
    ctx.save();
    ctx.font = "38px 'Minecraftia', Arial, monospace";
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.8;
    ctx.fillText(player1Score, BOARD_W/2 - 78, 54);
    ctx.fillText(player2Score, BOARD_W/2 + 54, 54);
    ctx.restore();
    score1El.textContent = player1Score;
    score2El.textContent = player2Score;
}

function draw() {
    drawAltoBackground(dayNightProgress);
    drawCenterLine();
    drawPaddle(player1);
    drawPaddle(player2);
    drawBall();
    drawScore();
}

function resetBall(dir) {
    ball = {
        x: BOARD_W/2,
        y: BOARD_H/2,
        vx: 5.0*dir,
        vy: 2 + Math.random()*2*(Math.random()>0.5?1:-1)
    };
    lastPaddleBounce = null;
}

function updatePaddles(dt) {
    if (player1) {
        player1.vx = player1.x - (player1.lastX || player1.x);
        player1.vy = player1.y - (player1.lastY || player1.y);
        player1.lastX = player1.x;
        player1.lastY = player1.y;
    }
    if (player2) {
        player2.vx = player2.x - (player2.lastX || player2.x);
        player2.vy = player2.y - (player2.lastY || player2.y);
        player2.lastX = player2.x;
        player2.lastY = player2.y;
    }
    const paddleSpeed = 4.2;
    if (mode==='ai') {
        player1.x = clamp(mousePos.x, PLAYER_X_RANGE[0], PLAYER_X_RANGE[1]);
        player1.y = clamp(mousePos.y, Y_RANGE[0], Y_RANGE[1]);
        let targetY = ball.y - PADDLE_H/2;
        player2.y += clamp(targetY - player2.y, -paddleSpeed, paddleSpeed);
        player2.y = clamp(player2.y, Y_RANGE[0], Y_RANGE[1]);
        // AI paddle stays fixed horizontally
    } else {
        if (keys['w']) player1.y -= paddleSpeed;
        if (keys['s']) player1.y += paddleSpeed;
        player1.x = clamp(player1.x, PLAYER_X_RANGE[0], PLAYER_X_RANGE[1]);
        player1.y = clamp(player1.y, Y_RANGE[0], Y_RANGE[1]);
        if (keys['arrowup']) player2.y -= paddleSpeed;
        if (keys['arrowdown']) player2.y += paddleSpeed;
        player2.x = clamp(player2.x, AI_X_RANGE[0], AI_X_RANGE[1]);
        player2.y = clamp(player2.y, Y_RANGE[0], Y_RANGE[1]);
    }
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// Simple straight paddle collision and anti-stick
function checkPaddleBounce(p, leftPaddle) {
    if (ball.y + BALL_RADIUS < p.y) return false;
    if (ball.y - BALL_RADIUS > p.y + PADDLE_H) return false;
    if (leftPaddle) {
        if (ball.x - BALL_RADIUS < p.x + PADDLE_W && ball.x > p.x) return true;
    } else {
        if (ball.x + BALL_RADIUS > p.x && ball.x < p.x + PADDLE_W) return true;
    }
    return false;
}
function dynamicPaddleBounce(p, leftPaddle) {
    // Add paddle velocity for realism
    let impact = (ball.y-(p.y+PADDLE_H/2))/(PADDLE_H/2); // -1 (top), 0 (center), 1 (bottom)
    let paddleSpeed = p.vy || 0;
    let baseVy = impact*7 + paddleSpeed*0.5 + (Math.random()-0.5)*1.1;
    let baseVx = leftPaddle ? Math.abs(ball.vx) : -Math.abs(ball.vx);
    ball.vx = baseVx + (p.vx||0)*0.3;
    ball.vy = baseVy;
    // Always move ball outside paddle
    if (leftPaddle) ball.x = p.x + PADDLE_W + BALL_RADIUS + 1;
    else ball.x = p.x - BALL_RADIUS - 1;
    // Clamp speed
    let speed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
    let minSpeed = 4.7, maxSpeed = 13.5;
    speed = Math.max(Math.min(speed, maxSpeed), minSpeed);
    let theta = Math.atan2(ball.vy, ball.vx);
    ball.vx = speed * Math.cos(theta);
    ball.vy = speed * Math.sin(theta);
    lastPaddleBounce = leftPaddle ? "left" : "right";
}

function gameLoop(ts) {
    if (!running) return;
    if (!lastTime) lastTime = ts;
    let dt = ts-lastTime;
    lastTime = ts;

    // Day/Night cycle
    dayNightProgress += dt/(1000*180);
    if (dayNightProgress > 1) dayNightProgress -= 1;

    updatePaddles(dt);

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall bounce
    if (ball.y - BALL_RADIUS < 0) {
        ball.y = BALL_RADIUS;
        ball.vy *= -1;
    } else if (ball.y + BALL_RADIUS > BOARD_H) {
        ball.y = BOARD_H - BALL_RADIUS;
        ball.vy *= -1;
    }

    // Left paddle
    if (checkPaddleBounce(player1, true)) {
        if (ball.vx < 0 && lastPaddleBounce !== "left") {
            dynamicPaddleBounce(player1, true);
        }
    } else if (lastPaddleBounce === "left") {
        lastPaddleBounce = null;
    }
    // Right paddle
    if (checkPaddleBounce(player2, false)) {
        if (ball.vx > 0 && lastPaddleBounce !== "right") {
            dynamicPaddleBounce(player2, false);
        }
    } else if (lastPaddleBounce === "right") {
        lastPaddleBounce = null;
    }

    // Score
    if (ball.x - BALL_RADIUS < 0) {
        player2Score++;
        if (player2Score >= WIN_SCORE) endGame(mode === 'ai' ? 'AI Wins!' : 'Player 2 Wins!');
        else scoreReset();
    }
    if (ball.x + BALL_RADIUS > BOARD_W) {
        player1Score++;
        if (player1Score >= WIN_SCORE) endGame('Player 1 Wins!');
        else scoreReset();
    }

    draw();

    requestAnimationFrame(gameLoop);
}

function scoreReset() {
    resetBall(Math.random()>0.5?1:-1);
}
