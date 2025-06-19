// === Alto's Adventure "pINGpONG" ===

// EXOPLANETS (unchanged)
const EXOPLANETS = [
    { name: "Earth", emoji: "🌍", gravity: 9.8 },
    { name: "Mars", emoji: "🪐", gravity: 3.7 },
    { name: "Moon", emoji: "🌙", gravity: 1.6 },
    { name: "Kepler-62f", emoji: "🪐", gravity: 12.1 },
    { name: "TRAPPIST-1e", emoji: "🌑", gravity: 9.1 },
    { name: "GJ 1132b", emoji: "🟣", gravity: 11.7 },
    { name: "Proxima Centauri b", emoji: "🟦", gravity: 10.9 },
    { name: "LHS 1140b", emoji: "🟤", gravity: 12.5 },
    { name: "K2-18b", emoji: "🟩", gravity: 13.8 },
    { name: "HD 40307g", emoji: "🟠", gravity: 14.7 },
    { name: "55 Cancri e", emoji: "🔵", gravity: 14.2 }
];

const WIN_SCORE = 10;
const PADDLE_W = 24, PADDLE_H = 120;
const PADDLE_MARGIN = 40;
const BALL_RADIUS = 12;
const BLOCK_SIZE = 38;
const BLOCK_MARGIN = 3*BLOCK_SIZE;
const MAX_BLOCKS = 5;
const BLOCK_TYPES = ['glass','stone','nether','creeper','gravity'];
const OBSTACLE_LIFE_MIN = 2000, OBSTACLE_LIFE_MAX = 5000;

let BOARD_W, BOARD_H;
let PLAYER_X_RANGE, AI_X_RANGE, Y_RANGE;

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const aiBtn = document.getElementById('aiBtn');
const pvpBtn = document.getElementById('pvpBtn');
const winnerDiv = document.getElementById('winner');
const winnerText = document.getElementById('winnerText');
const restartBtn = document.getElementById('restartBtn');
const planetPopup = document.getElementById('planetPopup');
const planetGraphic = document.getElementById('planetGraphic');
const planetLabel = document.getElementById('planetLabel');
const gravityLabel = document.getElementById('gravityLabel');
const spinningIndicator = document.getElementById('spinningIndicator');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const scoreboard = document.getElementById('scoreboard');

let player1, player2, ball, obstacles, obstacleTimer, spinning, spinDir, spinAngle, spinSpeed, gravity, gravityVec, gravityTimeout, spinTimeout, planet, lastSpinStart;
let player1Score, player2Score;
let mode = null;
let running = false, mousePos = {x:0, y:0};
let keys = {};
let lastTime = null;
let lastPaddleBounce = null;

let dayNightProgress = 0; // 0..1, day to night, advances slowly

// === RESPONSIVE BOARD ===
function setBoardSize() {
    BOARD_W = window.innerWidth;
    BOARD_H = window.innerHeight;
    canvas.width = BOARD_W;
    canvas.height = BOARD_H;
    PLAYER_X_RANGE = [0, BOARD_W/2 - PADDLE_MARGIN - PADDLE_W];
    AI_X_RANGE = [BOARD_W/2 + PADDLE_MARGIN, BOARD_W - PADDLE_W];
    Y_RANGE = [0, BOARD_H - PADDLE_H];
}
window.addEventListener('resize', setBoardSize);

function resetGameVars() {
    setBoardSize();
    player1 = {x: PLAYER_X_RANGE[0]+14, y: BOARD_H/2-PADDLE_H/2, color: "#7dcfff", lastX: 0, lastY: 0, vx: 0, vy: 0};
    player2 = {x: AI_X_RANGE[1]-14, y: BOARD_H/2-PADDLE_H/2, color: "#ffd47d", lastX: 0, lastY: 0, vx: 0, vy: 0};
    player1Score = 0; player2Score = 0;
    obstacles = [];
    obstacleTimer = 0;
    spinning = false; spinAngle = 0; spinSpeed = 0; gravity = 0;
    gravityVec = {x:0, y:0};
    gravityTimeout = null; spinTimeout = null; planet = null;
    lastSpinStart = 0;
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
    planetPopup.style.display = 'none';
    spinningIndicator.style.display = 'none';
    scoreboard.style.display = '';
    lastTime = null;
    requestAnimationFrame(gameLoop);
}
function endGame(text) {
    running = false;
    winnerText.textContent = text;
    winnerDiv.style.display = '';
    canvas.style.display = 'none';
    planetPopup.style.display = 'none';
    spinningIndicator.style.display = 'none';
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

//
// ==== ALTO'S ADVENTURE BACKGROUND ====
//

function lerpColor(a, b, t) {
    // a, b: [r,g,b] arrays, t: 0..1
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}
function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

// Palette: [dawn, day, dusk, night], each is [r,g,b]
const SKIES = [
    [ [155,191,230], [245,224,196], [255,151,113], [51,49,89] ], // Top
    [ [204,223,238], [176,222,255], [136,110,176], [22,27,46] ], // Middle
    [ [233,234,209], [124,190,202], [ 66,80,82 ], [13,25,35] ]   // Bottom
];
const SUN_COLOR = [255,220,120];
const MOON_COLOR = [230,230,255];

function drawAltoBackground(progress) {
    // progress: 0..1 (0 = dawn, 0.25 = day, 0.5 = dusk, 0.75 = night)
    // Compute time between 4 keyframes
    let p = (progress % 1 + 1) % 1;
    let k = Math.floor(p * 4);
    let t = (p * 4) % 1;
    // Get gradient colors
    let top = lerpColor(SKIES[0][k], SKIES[0][(k+1)%4], t);
    let mid = lerpColor(SKIES[1][k], SKIES[1][(k+1)%4], t);
    let bot = lerpColor(SKIES[2][k], SKIES[2][(k+1)%4], t);

    // Sky gradient
    let grad = ctx.createLinearGradient(0, 0, 0, BOARD_H);
    grad.addColorStop(0, rgb(top));
    grad.addColorStop(0.5, rgb(mid));
    grad.addColorStop(1, rgb(bot));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    // Parallax mountain layers (darker further)
    drawMountains(BOARD_H, 0.18, 0.15, 32, [80, 105, 142], 0.9, progress * 0.5, 1.0);
    drawMountains(BOARD_H, 0.32, 0.22, 36, [65, 79, 101], 0.92, progress, 0.5);
    drawMountains(BOARD_H, 0.45, 0.33, 40, [39, 52, 77], 0.88, progress*1.5, 0.25);

    // Sun or moon
    let sunMoonT = (progress + 0.04) % 1; // Offset sun so it's not exactly dawn at 0
    let theta = Math.PI * (1 - sunMoonT); // 0=left, 1=right, pi=top
    let cx = BOARD_W/2 + Math.cos(theta)*BOARD_W*0.36;
    let cy = BOARD_H*0.21 - Math.sin(theta)*BOARD_H*0.18;
    let isNight = (k === 3 || (k === 0 && t < 0.2)); // mostly night
    ctx.save();
    ctx.globalAlpha = 0.80;
    ctx.beginPath();
    ctx.arc(cx, cy, isNight ? 40 : 63, 0, Math.PI*2);
    ctx.fillStyle = isNight ? rgb(MOON_COLOR) : rgb(SUN_COLOR);
    ctx.shadowColor = isNight ? "#ccd7ff77" : "#ffeab077";
    ctx.shadowBlur = isNight ? 26 : 48;
    ctx.fill();
    ctx.restore();
    if (isNight) drawStars(ctx, BOARD_W, BOARD_H, 0.15);
}
function drawStars(ctx, w, h, alpha=1) {
    ctx.save();
    ctx.globalAlpha = 0.25*alpha;
    for (let i=0; i<60; ++i) {
        let sx = Math.random()*w;
        let sy = Math.random()*h*0.7;
        let r = Math.random()*1.4+0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI*2);
        ctx.fillStyle = "#fff";
        ctx.fill();
    }
    ctx.restore();
}
function drawMountains(h, topFrac, baseFrac, detail, color, alpha, xshift, parallax) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    let y0 = h*topFrac;
    let y1 = h*baseFrac;
    let w = BOARD_W;
    ctx.moveTo(0, h);
    for (let i = 0; i <= detail; ++i) {
        let t = i / detail;
        let px = t*w;
        let base = y0 + (y1-y0)*Math.pow(Math.sin(Math.PI*t), 3);
        let noise =
            Math.sin(xshift*5 + i*0.6 + Math.cos(xshift*2+t*6)*1.2) * 12 +
            Math.sin(xshift*2.2 + i*1.5) * 18 * (0.5-Math.abs(t-0.5));
        ctx.lineTo(px, base + noise*parallax);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = rgb(color);
    ctx.fill();
    ctx.restore();
}

// === DRAWING ===
function drawPaddle(p, leftSide) {
    ctx.save();
    ctx.translate(p.x + PADDLE_W/2, p.y + PADDLE_H/2);
    let r = 74;
    let startAng, endAng, ccw;
    if (leftSide) {
        startAng = (5 * Math.PI) / 4;
        endAng = (3 * Math.PI) / 4;
        ccw = true;
    } else {
        startAng = -Math.PI / 4;
        endAng = Math.PI / 4;
        ccw = false;
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, startAng, endAng, ccw);
    ctx.lineWidth = PADDLE_W;
    ctx.strokeStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 18;
    ctx.globalAlpha = 0.33;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff6";
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
}

function drawObstacles() {
    for (const ob of obstacles) {
        ctx.save();
        ctx.translate(ob.x+BLOCK_SIZE/2, ob.y+BLOCK_SIZE/2);
        let pulse = 1 + 0.09*Math.sin(performance.now()/230 + ob.x+ob.y);
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        ctx.rect(-BLOCK_SIZE/2, -BLOCK_SIZE/2, BLOCK_SIZE, BLOCK_SIZE);
        ctx.fillStyle = getBlockColor(ob.type);
        ctx.globalAlpha = 0.19;
        ctx.shadowColor = getBlockColor(ob.type);
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.font = "28px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#fff";
        ctx.fillText(getBlockIcon(ob.type), 0, 2);
        ctx.restore();
    }
}

function getBlockColor(type) {
    switch(type) {
        case 'glass': return "#bfe7ed";
        case 'stone': return "#aaa";
        case 'nether': return "#927bb6";
        case 'creeper': return "#69cbb3";
        case 'gravity': return "#fbc97a";
        default: return "#ddd";
    }
}
function getBlockIcon(type){
    switch(type){
        case 'glass': return "🟦";
        case 'stone': return "🪨";
        case 'nether': return "🟣";
        case 'creeper': return "💣";
        case 'gravity': return "🌑";
        default: return "⬜";
    }
}

function drawBall() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI*2);
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = spinning ? "#ffeab0" : "#7dcfff";
    ctx.shadowBlur = spinning ? 44 : 24;
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
    ctx.setLineDash([18, 12]);
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

function drawSpinningBorder(){
    ctx.save();
    ctx.translate(BOARD_W/2, BOARD_H/2);
    ctx.rotate(spinAngle);
    ctx.strokeStyle = "#ffeab0";
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.23 + 0.18*Math.abs(Math.sin(performance.now()/250));
    ctx.beginPath();
    ctx.rect(-BOARD_W/2+6,-BOARD_H/2+6, BOARD_W-12, BOARD_H-12);
    ctx.stroke();
    ctx.restore();
}

function draw() {
    // Alto's Adventure calm background
    drawAltoBackground(dayNightProgress);

    ctx.save();
    ctx.translate(BOARD_W/2, BOARD_H/2);
    if (spinning) ctx.rotate(spinAngle);
    ctx.translate(-BOARD_W/2, -BOARD_H/2);

    drawCenterLine();
    drawPaddle(player1, true);
    drawPaddle(player2, false);
    drawObstacles();
    drawBall();
    drawScore();

    if (spinning) drawSpinningBorder();

    ctx.restore();
}

function resetBall(dir) {
    ball = {
        x: BOARD_W/2,
        y: BOARD_H/2,
        vx: 6*dir,
        vy: 4*(Math.random()>0.5?1:-1),
        stuck: false,
        stuckTimer: 0
    };
    lastPaddleBounce = null;
}

function updatePaddles(dt) {
    // Track paddle velocities for dynamic reflection
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

    // Reduce paddle speed for calmness
    const paddleSpeed = 4.2;
    if (mode==='ai') {
        player1.x = clamp(mousePos.x, PLAYER_X_RANGE[0], PLAYER_X_RANGE[1]);
        player1.y = clamp(mousePos.y, Y_RANGE[0], Y_RANGE[1]);
        let targetY = ball.y - PADDLE_H/2;
        let targetX = clamp(ball.x, AI_X_RANGE[0], AI_X_RANGE[1]);
        player2.y += clamp(targetY - player2.y, -paddleSpeed, paddleSpeed);
        player2.y = clamp(player2.y, Y_RANGE[0], Y_RANGE[1]);
        player2.x += clamp(targetX - player2.x, -paddleSpeed, paddleSpeed);
        player2.x = clamp(player2.x, AI_X_RANGE[0], AI_X_RANGE[1]);
    } else {
        if (keys['w']) player1.y -= paddleSpeed;
        if (keys['s']) player1.y += paddleSpeed;
        if (keys['a']) player1.x -= paddleSpeed;
        if (keys['d']) player1.x += paddleSpeed;
        player1.x = clamp(player1.x, PLAYER_X_RANGE[0], PLAYER_X_RANGE[1]);
        player1.y = clamp(player1.y, Y_RANGE[0], Y_RANGE[1]);
        if (keys['arrowup']) player2.y -= paddleSpeed;
        if (keys['arrowdown']) player2.y += paddleSpeed;
        if (keys['arrowleft']) player2.x -= paddleSpeed;
        if (keys['arrowright']) player2.x += paddleSpeed;
        player2.x = clamp(player2.x, AI_X_RANGE[0], AI_X_RANGE[1]);
        player2.y = clamp(player2.y, Y_RANGE[0], Y_RANGE[1]);
    }
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// Paddle collision check with separation logic to prevent sticking and dynamic velocity
function checkPaddleHit(p, leftSide) {
    let px = ball.x - (p.x + PADDLE_W/2);
    let py = ball.y - (p.y + PADDLE_H/2);
    let r = 74;
    let dist = Math.sqrt(px*px+py*py);
    let angle = Math.atan2(py, px);
    if (leftSide) {
        if (angle < 0) angle += Math.PI*2;
        let startA = (5*Math.PI)/4, endA = (3*Math.PI)/4;
        if (startA < endA) {
            if (angle >= startA || angle <= endA) {
                if (dist > r-BALL_RADIUS-PADDLE_W/2 && dist < r+BALL_RADIUS+PADDLE_W/2) return true;
            }
        } else {
            if (angle >= startA && angle <= Math.PI*2 || angle >= 0 && angle <= endA) {
                if (dist > r-BALL_RADIUS-PADDLE_W/2 && dist < r+BALL_RADIUS+PADDLE_W/2) return true;
            }
        }
    } else {
        if (angle < -Math.PI/4 || angle > Math.PI/4) return false;
        if (dist > r-BALL_RADIUS-PADDLE_W/2 && dist < r+BALL_RADIUS+PADDLE_W/2) return true;
    }
    return false;
}

function dynamicPaddleBounce(p, leftSide) {
    let px = ball.x - (p.x + PADDLE_W/2);
    let py = ball.y - (p.y + PADDLE_H/2);
    let normalAngle = Math.atan2(py, px);

    if (leftSide) {
        if (normalAngle < 0) normalAngle += Math.PI*2;
        let startA = (5*Math.PI)/4, endA = (3*Math.PI)/4;
        if (startA < endA) {
            if (!(normalAngle >= startA || normalAngle <= endA)) normalAngle = (normalAngle < Math.PI) ? endA : startA;
        } else {
            if (!(normalAngle >= startA && normalAngle <= Math.PI*2 || normalAngle >= 0 && normalAngle <= endA))
                normalAngle = (Math.abs(normalAngle-startA) < Math.abs(normalAngle-endA)) ? startA : endA;
        }
    } else {
        if (normalAngle < -Math.PI/4) normalAngle = -Math.PI/4;
        if (normalAngle > Math.PI/4) normalAngle = Math.PI/4;
    }
    let v = { x: ball.vx, y: ball.vy };
    let n = { x: Math.cos(normalAngle), y: Math.sin(normalAngle) };
    let dot = v.x*n.x + v.y*n.y;
    let pvx = p.vx || 0, pvy = p.vy || 0;
    let paddleImpact = pvx * n.x + pvy * n.y;
    let baseReflect = 1.08 + Math.max(0, paddleImpact * 0.38); // Stronger impact for higher paddle speed, more Alto-like
    ball.vx = baseReflect * (v.x - 2*dot*n.x) + 0.45*pvx;
    ball.vy = baseReflect * (v.y - 2*dot*n.y) + 0.45*pvy;

    // Add some randomness/spin for realism
    ball.vy += (Math.random()-0.5)*1.4;

    // Clamp speed for Alto calmness
    let speed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
    let minSpeed = 5.4, maxSpeed = 16;
    speed = Math.max(Math.min(speed, maxSpeed), minSpeed);
    let theta = Math.atan2(ball.vy, ball.vx);
    ball.vx = speed * Math.cos(theta);
    ball.vy = speed * Math.sin(theta);

    // Always away from paddle
    if ((leftSide && ball.vx < 0) || (!leftSide && ball.vx > 0)) ball.vx *= -1;

    // Move ball fully out of paddle arc
    let arcCenterX = p.x + PADDLE_W/2;
    let arcCenterY = p.y + PADDLE_H/2;
    let outRad = 74 + PADDLE_W/2 + BALL_RADIUS + 1.4;
    ball.x = arcCenterX + Math.cos(normalAngle) * outRad;
    ball.y = arcCenterY + Math.sin(normalAngle) * outRad;

    lastPaddleBounce = leftSide ? "left" : "right";
}

function checkBlockHit(ob) {
    let bx = ball.x, by = ball.y;
    if (spinning) {
        let c = Math.cos(-spinAngle), s = Math.sin(-spinAngle);
        let cx = BOARD_W/2, cy = BOARD_H/2;
        let dx = ball.x-cx, dy = ball.y-cy;
        bx = dx*c - dy*s + cx;
        by = dx*s + dy*c + cy;
    }
    return (
        bx + BALL_RADIUS > ob.x &&
        bx - BALL_RADIUS < ob.x + BLOCK_SIZE &&
        by + BALL_RADIUS > ob.y &&
        by - BALL_RADIUS < ob.y + BLOCK_SIZE
    );
}

function handleBlockEffects(ob) {
    switch(ob.type) {
        case 'glass':
            ball.vx *= 1.07; ball.vy *= 1.07;
            break;
        case 'stone':
            ball.vx *= -1;
            break;
        case 'nether':
            let ang = Math.random()*2*Math.PI;
            let spd = 7 + Math.random()*7;
            ball.vx = spd*Math.cos(ang);
            ball.vy = spd*Math.sin(ang);
            break;
        case 'creeper':
            ball.stuck = true;
            ball.stuckTimer = 700 + Math.random()*700;
            setTimeout(()=>{
                let ang2 = Math.random()*2*Math.PI;
                let spd2 = 8 + Math.random()*10;
                ball.vx = spd2*Math.cos(ang2);
                ball.vy = spd2*Math.sin(ang2);
                ball.stuck = false;
            }, ball.stuckTimer);
            break;
        case 'gravity':
            triggerGravitySpin();
            break;
    }
}

function triggerGravitySpin() {
    if (spinning) return;
    planet = EXOPLANETS[Math.floor(Math.random()*EXOPLANETS.length)];
    gravity = planet.gravity;
    spinDir = Math.random()<0.5 ? 1 : -1;
    spinSpeed = 0.75 * spinDir;
    spinning = true;
    spinAngle = 0;
    gravityVec = {x: Math.sin(spinAngle), y: Math.cos(spinAngle)};
    showPlanetPopup();
    spinningIndicator.style.display = '';
    lastSpinStart = Date.now();
    if (spinTimeout) clearTimeout(spinTimeout);
    spinTimeout = setTimeout(()=>{smoothResetSpin();},60000);
}

function showPlanetPopup() {
    planetPopup.style.display = '';
    planetGraphic.innerText = planet.emoji;
    planetLabel.innerText = planet.name;
    gravityLabel.innerText = `Gravity: ${gravity.toFixed(2)} m/s²`;
    planetGraphic.style.animation = "planet-spin 2s linear infinite";
    setTimeout(()=>{
        planetPopup.style.display = 'none';
    }, 1900);
}

function smoothResetSpin() {
    let steps = 25, dAngle = spinAngle/steps;
    let i=0;
    let fade = () => {
        spinAngle -= dAngle;
        i++;
        if (i<steps) setTimeout(fade, 30);
        else { spinning=false; spinAngle=0; spinningIndicator.style.display='none'; }
    };
    fade();
}

function updateObstacles(dt) {
    obstacles = obstacles.filter(ob => (Date.now()<ob.spawned+ob.life));
    while (obstacles.length<MAX_BLOCKS) {
        let tries = 0, valid = false, x=0, y=0;
        while (!valid && tries<30) {
            x = BLOCK_MARGIN + Math.random()*(BOARD_W-2*BLOCK_MARGIN-BLOCK_SIZE);
            y = BLOCK_MARGIN + Math.random()*(BOARD_H-2*BLOCK_MARGIN-BLOCK_SIZE);
            valid = true;
            if (Math.abs(x-BOARD_W/2)<PADDLE_MARGIN+30) valid=false;
            if (rectOverlap(x,y,BLOCK_SIZE,BLOCK_SIZE, player1.x,player1.y,PADDLE_W,PADDLE_H)) valid=false;
            if (rectOverlap(x,y,BLOCK_SIZE,BLOCK_SIZE, player2.x,player2.y,PADDLE_W,PADDLE_H)) valid=false;
            for (const ob2 of obstacles) {
                if (rectOverlap(x,y,BLOCK_SIZE,BLOCK_SIZE, ob2.x,ob2.y,BLOCK_SIZE,BLOCK_SIZE)) valid=false;
            }
            tries++;
        }
        if (valid) {
            let type = BLOCK_TYPES[Math.floor(Math.random()*BLOCK_TYPES.length)];
            obstacles.push({
                x, y, type,
                spawned: Date.now(),
                life: OBSTACLE_LIFE_MIN + Math.random()*(OBSTACLE_LIFE_MAX-OBSTACLE_LIFE_MIN)
            });
        } else break;
    }
}

function rectOverlap(x1,y1,w1,h1, x2,y2,w2,h2){
    return !(x1+w1<x2 || x1>x2+w2 || y1+h1<y2 || y1>y2+h2);
}

function gameLoop(ts) {
    if (!running) return;
    if (!lastTime) lastTime = ts;
    let dt = ts-lastTime;
    lastTime = ts;

    // Day/Night progress (cycles every 180 seconds)
    dayNightProgress += dt/(1000*180);
    if (dayNightProgress > 1) dayNightProgress -= 1;

    updatePaddles(dt);

    if (!ball.stuck) {
        if (spinning) {
            ball.vx += gravity * Math.sin(spinAngle) * dt/1000;
            ball.vy += gravity * Math.cos(spinAngle) * dt/1000;
        }
        ball.x += ball.vx;
        ball.y += ball.vy;
    }

    if (ball.y - BALL_RADIUS < 0) {
        ball.y = BALL_RADIUS;
        ball.vy *= -1;
    } else if (ball.y + BALL_RADIUS > BOARD_H) {
        ball.y = BOARD_H - BALL_RADIUS;
        ball.vy *= -1;
    }

    if (checkPaddleHit(player1,true)) {
        if (ball.vx < 0 && lastPaddleBounce !== "left") {
            dynamicPaddleBounce(player1, true);
        }
    } else if (lastPaddleBounce === "left") {
        lastPaddleBounce = null;
    }

    if (checkPaddleHit(player2,false)) {
        if (ball.vx > 0 && lastPaddleBounce !== "right") {
            dynamicPaddleBounce(player2, false);
        }
    } else if (lastPaddleBounce === "right") {
        lastPaddleBounce = null;
    }

    for (const ob of obstacles) {
        if (checkBlockHit(ob)) {
            handleBlockEffects(ob);
            ob.life = 0;
            break;
        }
    }

    let crossed = false;
    if (!spinning && Math.abs(ball.x-BOARD_W/2)<BALL_RADIUS) crossed=true;
    if (spinning) {
        let cx = BOARD_W/2, cy = BOARD_H/2;
        let bx = (ball.x-cx)*Math.cos(-spinAngle)-(ball.y-cy)*Math.sin(-spinAngle)+cx;
        if (Math.abs(bx-BOARD_W/2)<BALL_RADIUS) crossed=true;
    }
    if (spinning && crossed) {
        let dir = ball.x > BOARD_W/2 ? 1 : -1;
        ball.vx += gravity*0.15*dir;
    }

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

    if (spinning) {
        spinAngle += spinSpeed * dt/1000;
        if (spinAngle > Math.PI*2) spinAngle -= Math.PI*2;
        if (spinAngle < -Math.PI*2) spinAngle += Math.PI*2;
    }

    updateObstacles(dt);

    draw();

    requestAnimationFrame(gameLoop);
}

function scoreReset() {
    resetBall(Math.random()>0.5?1:-1);
    if (spinning) {
        spinning = false;
        spinAngle = 0;
        spinningIndicator.style.display = 'none';
        if (spinTimeout) clearTimeout(spinTimeout);
    }
}
