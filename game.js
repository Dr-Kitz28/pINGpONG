// Alto's Adventure Pong - Complete, ready-to-run, all features as requested

const WIN_SCORE = 10;
const PADDLE_W = 18, PADDLE_H = 120, BALL_RADIUS = 13;

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
const title = document.querySelector('.minecraft-title');

let player1, player2, ball;
let player1Score, player2Score;
let mode = null;
let running = false, mousePos = {x:0, y:0};
let keys = {};
let lastTime = null;
let lastPaddleBounce = null;
let dayNightProgress = 0;

let birds = [], herds = [], horsemen = [], wolves = [], villagers = [], riverCurve = [];
let moonPhase = 0, fullMoonEvent = false, wolfEventProgress = 0;

// --- Game Setup ---
function setBoardSize() {
    BOARD_W = window.innerWidth;
    BOARD_H = window.innerHeight;
    canvas.width = BOARD_W;
    canvas.height = BOARD_H;
    PLAYER_X_RANGE = [0, BOARD_W/2 - 36 - PADDLE_W];
    AI_X_RANGE = [BOARD_W/2 + 36, BOARD_W - PADDLE_W];
    Y_RANGE = [0, BOARD_H - PADDLE_H];
}
window.addEventListener('resize', () => { setBoardSize(); spawnRiver(); });

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function resetGameVars() {
    setBoardSize();
    player1 = {x: PLAYER_X_RANGE[0]+12, y: BOARD_H/2-PADDLE_H/2, color: "#93e7fc", vx: 0, vy: 0, targetX: PLAYER_X_RANGE[0]+12, targetY: BOARD_H/2-PADDLE_H/2};
    player2 = {x: AI_X_RANGE[1]-12, y: BOARD_H/2-PADDLE_H/2, color: "#ffd47d", vx: 0, vy: 0, targetX: AI_X_RANGE[1]-12, targetY: BOARD_H/2-PADDLE_H/2};
    player1Score = 0; player2Score = 0;
    lastPaddleBounce = null;
    spawnBirds(); spawnRiver(); spawnHerds(); spawnHorsemen();
    wolves = []; villagers = []; wolfEventProgress = 0; fullMoonEvent = false;
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
    if (title) title.style.display = 'none';
    lastTime = null;
    requestAnimationFrame(gameLoop);
}
function endGame(text) {
    running = false;
    winnerText.textContent = text;
    winnerDiv.style.display = '';
    canvas.style.display = 'none';
    scoreboard.style.display = 'none';
    if (title) title.style.display = '';
}

canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left - PADDLE_W/2;
    mousePos.y = e.clientY - rect.top - PADDLE_H/2;
    if (running && mode==="ai") {
        player1.targetX = clamp(mousePos.x, PLAYER_X_RANGE[0], PLAYER_X_RANGE[1]);
        player1.targetY = clamp(mousePos.y, Y_RANGE[0], Y_RANGE[1]);
    }
});
document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
restartBtn.onclick = () => {
    winnerDiv.style.display = 'none';
    menu.style.display = '';
    canvas.style.display = 'none';
    if (title) title.style.display = '';
};
aiBtn.onclick = () => startGame('ai');
pvpBtn.onclick = () => startGame('pvp');

// --- Colors/Gradients ---
function lerpColor(a, b, t) {
    return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t)
    ];
}
function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
const SKIES = [
    [ [106,159,176], [177,220,203], [239,232,191], [72,108,120] ],
    [ [166,196,196], [102,144,172], [63,84,102], [30,44,62] ],
    [ [50,60,70], [44,61,82], [29,38,56], [17,20,31] ]
];
const SUN_COLOR = [254,212,68];

// --- Mountains, River, Sun ---
function drawMountains(h, topFrac, baseFrac, detail, color, alpha, xshift, parallax, occlusionLayer=false, progress=0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    let y0 = h*topFrac, y1 = h*baseFrac, w = BOARD_W;
    ctx.moveTo(0, h);
    let mtPts = [];
    for (let i = 0; i <= detail; ++i) {
        let t = i / detail, px = t*w;
        let base = y0 + (y1-y0)*Math.pow(Math.sin(Math.PI*t), 3);
        let noise =
            Math.sin(xshift*5 + i*0.6 + Math.cos(xshift*2+t*6)*1.2) * 12 +
            Math.sin(xshift*2.2 + i*1.5) * 18 * (0.5-Math.abs(t-0.5));
        let py = base + noise*parallax;
        ctx.lineTo(px, py);
        if (occlusionLayer) mtPts.push({x: px, y: py});
    }
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = rgb(color);
    ctx.fill(); ctx.restore();

    if (occlusionLayer) {
        window.__alto_mountain_profile = mtPts;
        window.__alto_mountain_progress = progress;
    }
}

function spawnRiver() {
    riverCurve = [];
    let y = BOARD_H*0.84;
    for (let i=0;i<=40;++i) {
        let t = i/40;
        let x = t*BOARD_W;
        let noise = Math.sin(t*6+dayNightProgress*8)*18+Math.cos(t*13+dayNightProgress*2)*13;
        riverCurve.push({x, y: y+noise});
    }
}
function drawRiver() {
    if (!riverCurve.length) return;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.moveTo(riverCurve[0].x, riverCurve[0].y);
    for (let i=1;i<riverCurve.length;++i)
        ctx.lineTo(riverCurve[i].x, riverCurve[i].y);
    ctx.lineTo(BOARD_W, BOARD_H);
    ctx.lineTo(0, BOARD_H);
    ctx.closePath();
    let grad = ctx.createLinearGradient(0, riverCurve[0].y, 0, BOARD_H);
    grad.addColorStop(0, "#a8e3f7");
    grad.addColorStop(0.7, "#60a8c6");
    grad.addColorStop(1, "#2c5477");
    ctx.fillStyle = grad;
    ctx.shadowColor = "#d4f6ff";
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.globalAlpha = 0.23;
    for (let j=0;j<3;++j) {
        ctx.beginPath();
        for (let i=0;i<riverCurve.length;++i) {
            let t = i/(riverCurve.length-1);
            let x = riverCurve[i].x;
            let y = riverCurve[i].y-10-j*7+Math.sin(dayNightProgress*8+t*7+j)*5;
            if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.lineWidth = 2.2-0.7*j;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
    }
    ctx.restore();
}

function drawSunBetweenMountains(progress) {
    if (!window.__alto_mountain_profile) return;
    let mountain = window.__alto_mountain_profile;
    let sunT = 1 - Math.abs((progress*2)%2-1);
    let sunX = BOARD_W/2;
    let closest = mountain.slice().sort((a,b)=>Math.abs(a.x-sunX)-Math.abs(b.x-sunX))[0];
    let minY = closest.y;
    let maxY = BOARD_H*0.10;
    let sunY = minY - (minY-maxY)*Math.pow(sunT,1.6);

    let sunAlpha = Math.max(0, Math.min(1, (progress-0.07)/0.13));
    let sunR = 55*2.5;

    ctx.save();
    ctx.globalAlpha = sunAlpha*0.99;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI*2);
    ctx.fillStyle = rgb(SUN_COLOR);
    ctx.shadowColor = "#ffeab077";
    ctx.shadowBlur = 74;
    ctx.fill();
    ctx.globalCompositeOperation = "destination-out";
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(mountain[0].x, mountain[0].y);
    for (let i=1;i<mountain.length;++i) ctx.lineTo(mountain[i].x, mountain[i].y);
    ctx.lineTo(BOARD_W, BOARD_H); ctx.lineTo(0, BOARD_H); ctx.closePath();
    ctx.clip();
    ctx.rect(0, 0, BOARD_W, BOARD_H);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
}

// --- Alto Background ---
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

    drawMountains(BOARD_H, 0.23, 0.19, 32, [48,72,80], 0.8, progress*0.5, 1.0, false);
    drawMountains(BOARD_H, 0.36, 0.28, 36, [26,48,54], 0.9, progress, 0.5, false);
    drawMountains(BOARD_H, 0.53, 0.36, 70, [31,34,42], 1.1, progress*1.5, 0.23, true, progress);

    drawRiver();
    drawSunBetweenMountains(progress);
    drawHerds();
    drawHorsemen();
    drawBirds();
}

// --- Herds (sheep) ---
function spawnHerds() {
    herds = [];
    let riverY = BOARD_H*0.84;
    for (let i=0;i<2;++i) {
        let baseX = BOARD_W*0.2 + i*BOARD_W*0.45;
        let baseY = riverY-26-Math.random()*35;
        let dx = 1.5 + Math.random()*1.5;
        let sheep = [];
        for (let j=0;j<7+Math.floor(Math.random()*5);++j) {
            sheep.push({x: baseX-Math.random()*55+j*12, y: baseY+Math.random()*7});
        }
        herds.push({x: baseX, y: baseY, dx, sheep, herder: {x: baseX-30, y: baseY-12}});
    }
}
function drawHerds() {
    let isNight = (dayNightProgress < 0.18 || dayNightProgress > 0.82);
    for (let h of herds) {
        if (!isNight) {
            for (let s of h.sheep) {
                s.x += (Math.random()-0.5)*0.6 + h.dx/60;
                s.y += (Math.random()-0.5)*0.4;
                if (s.x > BOARD_W-40) s.x = 40;
                if (s.x < 30) s.x = BOARD_W-30;
            }
            h.herder.x += h.dx/55 + (Math.random()-0.5)*0.5;
        } else {
            for (let s of h.sheep) {
                s.x += (h.x-s.x)*0.01;
                s.y += (h.y-s.y)*0.01;
            }
            h.herder.x += (h.x-h.herder.x)*0.008;
        }
        for (let s of h.sheep) {
            ctx.save();
            ctx.globalAlpha = 0.87;
            ctx.translate(s.x, s.y);
            ctx.beginPath();
            ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI*2);
            ctx.fillStyle = "#fff";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(11, -3, 3.5, 0, Math.PI*2);
            ctx.fillStyle = "#bdb9b1";
            ctx.fill();
            for (let i=0;i<2;++i) {
                ctx.save();
                let legSwing = Math.sin(performance.now()/260+s.x*0.01+i)*3;
                ctx.beginPath();
                ctx.moveTo(-3+i*6,7); ctx.lineTo(-3+i*6,15+legSwing);
                ctx.lineWidth = 2;
                ctx.strokeStyle = "#aaa";
                ctx.stroke();
                ctx.restore();
            }
            ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.translate(h.herder.x, h.herder.y);
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI*2);
        ctx.fillStyle = "#c9b27b";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -8, 3.8, 0, Math.PI*2);
        ctx.fillStyle = "#f6e8ce";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(7, -2); ctx.lineTo(15, 14);
        ctx.strokeStyle = "#7a6a44";
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.restore();
    }
}

// --- Horses (llama style) ---
function spawnHorsemen() {
    horsemen = [];
    let riverY = BOARD_H*0.84;
    for (let i=0;i<2;++i) {
        let baseX = BOARD_W*0.3 + i*BOARD_W*0.3;
        let baseY = riverY-46-Math.random()*30;
        let dx = (Math.random()>0.5?1:-1)*(1.1+Math.random());
        horsemen.push({x: baseX, y: baseY, dx});
    }
}
function drawHorsemen() {
    let isNight = (dayNightProgress < 0.18 || dayNightProgress > 0.82);
    for (let h of horsemen) {
        if (!isNight) {
            h.x += h.dx/47;
            if (h.x > BOARD_W-70) h.dx *= -1;
            if (h.x < 45) h.dx *= -1;
        } else {
            let targetX = BOARD_W*0.5;
            h.x += (targetX-h.x)*0.01;
        }
        ctx.save();
        ctx.globalAlpha = 0.97;
        ctx.translate(h.x, h.y);
        ctx.scale(h.dx>0?1:-1,1);
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI*2);
        ctx.fillStyle = "#bba06b";
        ctx.fill();
        for (let i=0;i<4;++i) {
            ctx.save();
            let legSwing = Math.sin(performance.now()/260+h.x*0.01+i)*4;
            ctx.beginPath();
            ctx.moveTo(-7+i*5,7); ctx.lineTo(-7+i*5,19+legSwing);
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#bba06b";
            ctx.stroke();
            ctx.restore();
        }
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(13,-2); ctx.lineTo(23,-23);
        ctx.lineWidth = 9;
        ctx.strokeStyle = "#bba06b";
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(25,-26,7,6,0,0,Math.PI*2);
        ctx.fillStyle = "#d6bc7c";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(27,-32); ctx.lineTo(29,-38); ctx.lineTo(25,-32);
        ctx.closePath();
        ctx.fillStyle = "#ece0a9";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(21,-31); ctx.lineTo(19,-37); ctx.lineTo(23,-31);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-17,4); ctx.bezierCurveTo(-26,14,-13,16,-17,4);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#a89d79";
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.translate(2, -15);
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI*2);
        ctx.fillStyle = "#f6e8ce";
        ctx.fill();
        ctx.restore();
        ctx.restore();
    }
}

// --- Birds: Alto-style, smooth wave wings, flocking ---
function spawnBirds() {
    birds = [];
    let nFlocks = 1 + Math.floor(Math.random()*2);
    let yBase = BOARD_H*0.28 + Math.random()*BOARD_H*0.16;
    for (let f=0; f<nFlocks; ++f) {
        let n = 2 + Math.floor(Math.random()*6);
        let t0 = Math.random()*0.7+0.1;
        let leftToRight = Math.random() > 0.5;
        let arcHeight = 60+Math.random()*60;
        let speed = (0.13+Math.random()*0.18)*(leftToRight?1:-1);
        for (let i=0; i<n; ++i) {
            birds.push({
                t: t0-i*0.09,
                arcY: yBase+Math.random()*11,
                arcHeight: arcHeight+Math.random()*13,
                speed,
                leftToRight,
                offset: Math.random()*Math.PI*2,
                spread: 14+Math.random()*10,
                size: 13+Math.random()*6,
                alpha: 0.21+Math.random()*0.15,
                waveSeed: Math.random()*Math.PI*2
            });
        }
    }
}
function drawBirds() {
    if (!birds.length) return;
    for (let b of birds) {
        b.t += b.speed/120;
        if (b.t > 1.2) b.t = -0.2;
        if (b.t < -0.2) b.t = 1.2;
        let px = BOARD_W*(b.leftToRight?b.t:1-b.t);
        let py = b.arcY - Math.sin(b.t*Math.PI)*b.arcHeight;
        let now = performance.now()/590 + b.offset;
        let wingAngle = Math.sin(now+b.waveSeed)*0.88 + 0.13*Math.cos(now*0.7+b.waveSeed*1.2);
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.translate(px, py);
        ctx.scale(b.leftToRight?1:-1,1);
        ctx.beginPath();
        ctx.ellipse(0, 0, b.size*0.7, b.size*0.32, 0, 0, Math.PI*2);
        ctx.fillStyle = "#1a151a";
        ctx.fill();
        for (let dir of [-1,1]) {
            ctx.save();
            ctx.rotate(dir*wingAngle*0.72);
            ctx.beginPath();
            ctx.moveTo(0,0);
            for (let j=1;j<=6;++j) {
                let t = j/6;
                let wx = dir*b.size*(0.7*t+0.5*t*t);
                let wy = -b.size*0.6*t*(1-t) + Math.sin(now*2+dir*j+b.waveSeed)*0.8;
                ctx.lineTo(wx,wy);
            }
            ctx.lineWidth = 2.0;
            ctx.strokeStyle = "#19181a";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 2;
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }
    if (Math.random()<0.0015) spawnBirds();
}

// --- Paddle/ball/score logic ---
function resetBall(dir) {
    ball = {
        x: BOARD_W/2,
        y: BOARD_H/2,
        prevX: BOARD_W/2,
        prevY: BOARD_H/2,
        vx: 5.0*dir,
        vy: 2 + Math.random()*2*(Math.random()>0.5?1:-1)
    };
    lastPaddleBounce = null;
}
function sweptPaddleBounce(p, leftPaddle) {
    let minX = p.x, maxX = p.x + PADDLE_W;
    let minY = p.y, maxY = p.y + PADDLE_H;
    let dx = ball.x - ball.prevX;
    let dy = ball.y - ball.prevY;
    let steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (BALL_RADIUS * 0.7));
    steps = Math.max(1, steps);
    for (let i = 1; i <= steps; ++i) {
        let t = i / steps;
        let cx = ball.prevX + dx * t;
        let cy = ball.prevY + dy * t;
        if (
            cx + BALL_RADIUS > minX && cx - BALL_RADIUS < maxX &&
            cy + BALL_RADIUS > minY && cy - BALL_RADIUS < maxY
        ) {
            ball.x = cx;
            ball.y = cy;
            return true;
        }
    }
    return false;
}
function dynamicPaddleBounce(p, leftPaddle) {
    let impact = (ball.y-(p.y+PADDLE_H/2))/(PADDLE_H/2);
    let paddleSpeed = p.vy || 0;
    let baseVy = impact*7 + paddleSpeed*0.5 + (Math.random()-0.5)*1.1;
    let baseVx = leftPaddle ? Math.abs(ball.vx) : -Math.abs(ball.vx);
    baseVx *= 1.1; baseVy *= 1.1; // 10% speed up
    ball.vx = baseVx + (p.vx||0)*0.3;
    ball.vy = baseVy;
    if (leftPaddle) ball.x = p.x + PADDLE_W + BALL_RADIUS + 1;
    else ball.x = p.x - BALL_RADIUS - 1;
    let speed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
    let minSpeed = 4.7, maxSpeed = 18.5;
    speed = Math.max(Math.min(speed, maxSpeed), minSpeed);
    let theta = Math.atan2(ball.vy, ball.vx);
    ball.vx = speed * Math.cos(theta);
    ball.vy = speed * Math.sin(theta);
    lastPaddleBounce = leftPaddle ? "left" : "right";
}
function updatePaddles(dt) {
    if (mode==='ai') {
        player1.x += (player1.targetX-player1.x)*0.45;
        player1.y += (player1.targetY-player1.y)*0.45;
    } else {
        const paddleSpeed = 7.4;
        if (keys['w']) player1.y -= paddleSpeed;
        if (keys['s']) player1.y += paddleSpeed;
        player1.x = clamp(player1.x, PLAYER_X_RANGE[0], PLAYER_X_RANGE[1]);
        player1.y = clamp(player1.y, Y_RANGE[0], Y_RANGE[1]);
    }
    if (mode==='ai') {
        let predictY = ball.y - PADDLE_H/2;
        player2.y += (predictY - player2.y)*0.19;
        player2.y = clamp(player2.y, Y_RANGE[0], Y_RANGE[1]);
        player2.x = AI_X_RANGE[1]-12;
    } else {
        const paddleSpeed = 7.4;
        if (keys['arrowup']) player2.y -= paddleSpeed;
        if (keys['arrowdown']) player2.y += paddleSpeed;
        player2.x = clamp(player2.x, AI_X_RANGE[0], AI_X_RANGE[1]);
        player2.y = clamp(player2.y, Y_RANGE[0], Y_RANGE[1]);
    }
}
function draw() {
    drawAltoBackground(dayNightProgress);
    drawCenterLine();
    drawPaddle(player1);
    drawPaddle(player2);
    drawBall();
    drawScore();
}
function drawPaddle(p) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, PADDLE_W, PADDLE_H);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.41;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#fff7";
    ctx.stroke();
    ctx.restore();
}
function drawBall() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI*2);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#ffd76d";
    ctx.shadowBlur = 23;
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
    ctx.globalAlpha = 0.91;
    ctx.fillText(player1Score, BOARD_W/2 - 78, 54);
    ctx.fillText(player2Score, BOARD_W/2 + 54, 54);
    ctx.restore();
    score1El.textContent = player1Score;
    score2El.textContent = player2Score;
}

function gameLoop(ts) {
    if (!running) return;
    if (!lastTime) lastTime = ts;
    let dt = ts-lastTime;
    lastTime = ts;

    dayNightProgress += dt/(1000*180);
    if (dayNightProgress > 1) dayNightProgress -= 1;

    updatePaddles(dt);

    ball.prevX = ball.x;
    ball.prevY = ball.y;
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
    if (sweptPaddleBounce(player1, true)) {
        if (ball.vx < 0 && lastPaddleBounce !== "left") {
            dynamicPaddleBounce(player1, true);
        }
    } else if (lastPaddleBounce === "left") {
        lastPaddleBounce = null;
    }
    // Right paddle
    if (sweptPaddleBounce(player2, false)) {
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
function scoreReset() { resetBall(Math.random()>0.5?1:-1); }
