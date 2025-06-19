// === EXOPLANET LIST: Sample, gravity <= 15m/s^2 ===
// (For a real game, fetch a larger list from an exoplanet API or data file)
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
    { name: "55 Cancri e", emoji: "🔵", gravity: 14.2 },
    // Add more as needed (all <= 15m/s^2)
];

const WIN_SCORE = 10;
const PADDLE_W = 24, PADDLE_H = 120;
const PADDLE_MARGIN = 40; // min dist from center
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

let player1, player2, ball, obstacles, obstacleTimer, spinning, spinDir, spinAngle, spinSpeed, gravity, gravityVec, gravityTimeout, spinTimeout, planet, lastSpinStart;
let player1Score, player2Score;
let mode = null;
let running = false, mousePos = {x:0, y:0};
let keys = {};
let lastTime = null;

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
    player1 = {x: PLAYER_X_RANGE[0]+14, y: BOARD_H/2-PADDLE_H/2, color: "#0af"};
    player2 = {x: AI_X_RANGE[1]-14, y: BOARD_H/2-PADDLE_H/2, color: "#fa0"};
    player1Score = 0; player2Score = 0;
    obstacles = [];
    obstacleTimer = 0;
    spinning = false; spinAngle = 0; spinSpeed = 0; gravity = 0;
    gravityVec = {x:0, y:0};
    gravityTimeout = null; spinTimeout = null; planet = null;
    lastSpinStart = 0;
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
    lastTime = null;
    requestAnimationFrame(gameLoop);
}

// === INPUT HANDLERS ===
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

// === DRAWING ===
function drawPaddle(p, leftSide) {
    ctx.save();
    ctx.translate(p.x + PADDLE_W/2, p.y + PADDLE_H/2);
    let startAng, endAng;
    // Both paddles are arcs of 180deg facing center
    if (leftSide) {
        // Left: arc from 225deg to 315deg, concave faces right
        startAng = (5*Math.PI/4);
        endAng = (7*Math.PI/4);
    } else {
        // Right: arc from -45deg to 45deg, concave faces left
        startAng = (-Math.PI/4);
        endAng = (Math.PI/4);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 74, startAng, endAng, false);
    ctx.lineWidth = PADDLE_W;
    ctx.strokeStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
}

function drawObstacles() {
    for (const ob of obstacles) {
        ctx.save();
        ctx.translate(ob.x+BLOCK_SIZE/2, ob.y+BLOCK_SIZE/2);
        ctx.beginPath();
        ctx.rect(-BLOCK_SIZE/2, -BLOCK_SIZE/2, BLOCK_SIZE, BLOCK_SIZE);
        ctx.fillStyle = getBlockColor(ob.type);
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.font = "28px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(getBlockIcon(ob.type), 0, 2);
        ctx.restore();
    }
}

function getBlockColor(type) {
    switch(type) {
        case 'glass': return "#4fd3ff";
        case 'stone': return "#bbb";
        case 'nether': return "#920";
        case 'creeper': return "#3c5";
        case 'gravity': return "#ffb300";
        default: return "#888";
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
    ctx.fillStyle = "#fff";
    ctx.shadowColor = spinning ? "#ff0" : "#0af";
    ctx.shadowBlur = spinning ? 16 : 8;
    ctx.fill();
    ctx.restore();
}

function drawCenterLine(){
    ctx.save();
    ctx.strokeStyle = "#fff8";
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
    ctx.font = "38px Arial";
    ctx.fillStyle = "#fff";
    ctx.fillText(player1Score, BOARD_W/2 - 78, 54);
    ctx.fillText(player2Score, BOARD_W/2 + 54, 54);
}

function drawSpinningBorder(){
    ctx.save();
    ctx.translate(BOARD_W/2, BOARD_H/2);
    ctx.rotate(spinAngle);
    ctx.strokeStyle = "#ff0";
    ctx.lineWidth = 10;
    ctx.globalAlpha = 0.5 + 0.5*Math.abs(Math.sin(performance.now()/250));
    ctx.beginPath();
    ctx.rect(-BOARD_W/2+6,-BOARD_H/2+6, BOARD_W-12, BOARD_H-12);
    ctx.stroke();
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);

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

// === GAME LOGIC ===
function resetBall(dir) {
    ball = {
        x: BOARD_W/2,
        y: BOARD_H/2,
        vx: 6*dir,
        vy: 4*(Math.random()>0.5?1:-1),
        stuck: false,
        stuckTimer: 0
    };
}

function updatePaddles(dt) {
    if (mode==='ai') {
        player1.x = clamp(mousePos.x, PLAYER_X_RANGE[0], PLAYER_X_RANGE[1]);
        player1.y = clamp(mousePos.y, Y_RANGE[0], Y_RANGE[1]);
        let targetY = ball.y - PADDLE_H/2;
        let targetX = clamp(ball.x, AI_X_RANGE[0], AI_X_RANGE[1]);
        player2.y += clamp(targetY - player2.y, -6, 6);
        player2.y = clamp(player2.y, Y_RANGE[0], Y_RANGE[1]);
        player2.x += clamp(targetX - player2.x, -4, 4);
        player2.x = clamp(player2.x, AI_X_RANGE[0], AI_X_RANGE[1]);
    } else {
        if (keys['w']) player1.y -= 8;
        if (keys['s']) player1.y += 8;
        if (keys['a']) player1.x -= 8;
        if (keys['d']) player1.x += 8;
        player1.x = clamp(player1.x, PLAYER_X_RANGE[0], PLAYER_X_RANGE[1]);
        player1.y = clamp(player1.y, Y_RANGE[0], Y_RANGE[1]);
        if (keys['arrowup']) player2.y -= 8;
        if (keys['arrowdown']) player2.y += 8;
        if (keys['arrowleft']) player2.x -= 8;
        if (keys['arrowright']) player2.x += 8;
        player2.x = clamp(player2.x, AI_X_RANGE[0], AI_X_RANGE[1]);
        player2.y = clamp(player2.y, Y_RANGE[0], Y_RANGE[1]);
    }
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// Improved arc paddle collision & normal calculation
function checkPaddleHit(p, leftSide) {
    // Transform ball to paddle local
    let px = ball.x - (p.x + PADDLE_W/2);
    let py = ball.y - (p.y + PADDLE_H/2);
    let r = 74;
    let dist = Math.sqrt(px*px+py*py);
    let angle = Math.atan2(py, px);
    // Left paddle: arc from 225deg to 315deg
    // Right paddle: arc from -45deg to 45deg
    if (leftSide) {
        if (
            dist > r-BALL_RADIUS-PADDLE_W/2 && dist < r+BALL_RADIUS+PADDLE_W/2 &&
            angle >= 5*Math.PI/4 && angle <= 7*Math.PI/4
        ) return true;
    } else {
        if (
            dist > r-BALL_RADIUS-PADDLE_W/2 && dist < r+BALL_RADIUS+PADDLE_W/2 &&
            (angle >= -Math.PI/4 && angle <= Math.PI/4)
        ) return true;
    }
    return false;
}

// Reflect about the correct normal for arc paddle
function applyPaddleBounce(p, leftSide) {
    let px = ball.x - (p.x + PADDLE_W/2);
    let py = ball.y - (p.y + PADDLE_H/2);
    let normalAngle = Math.atan2(py, px);
    // For left paddle, clamp normal to arc range
    if (leftSide) {
        if (normalAngle < 5*Math.PI/4) normalAngle = 5*Math.PI/4;
        if (normalAngle > 7*Math.PI/4) normalAngle = 7*Math.PI/4;
    } else {
        if (normalAngle < -Math.PI/4) normalAngle = -Math.PI/4;
        if (normalAngle > Math.PI/4) normalAngle = Math.PI/4;
    }
    let v = { x: ball.vx, y: ball.vy };
    // Normal vector
    let n = { x: Math.cos(normalAngle), y: Math.sin(normalAngle) };
    // v dot n
    let dot = v.x*n.x + v.y*n.y;
    // Reflect v: v' = v - 2(v·n)n
    ball.vx = v.x - 2*dot*n.x;
    ball.vy = v.y - 2*dot*n.y;
    // Add some randomness/spin
    ball.vy += (Math.random()-0.5)*2;
    let speed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
    let minSpeed = 7, maxSpeed = 15;
    speed = clamp(speed, minSpeed, maxSpeed);
    let theta = Math.atan2(ball.vy, ball.vx);
    ball.vx = speed * Math.cos(theta);
    ball.vy = speed * Math.sin(theta);
    // Make sure ball points away from paddle
    if ((leftSide && ball.vx < 0) || (!leftSide && ball.vx > 0))
        ball.vx *= -1;
}

// Obstacle collision
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
    spinSpeed = 1 * spinDir; // 1 rad/s
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

// Spawns obstacles at random valid locations
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
        ball.x = player1.x+PADDLE_W+BALL_RADIUS;
        applyPaddleBounce(player1, true);
    }
    if (checkPaddleHit(player2,false)) {
        ball.x = player2.x-BALL_RADIUS;
        applyPaddleBounce(player2, false);
    }

    for (const ob of obstacles) {
        if (checkBlockHit(ob)) {
            handleBlockEffects(ob);
            ob.life = 0;
            break;
        }
    }

    // Ball crossing center (for gravity effect)
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

function endGame(text) {
    running = false;
    winnerText.textContent = text;
    winnerDiv.style.display = '';
    canvas.style.display = 'none';
    planetPopup.style.display = 'none';
    spinningIndicator.style.display = 'none';
}
