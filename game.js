// Alto's Adventure pINGpONG: Ultra-responsive paddle, sun/moon crossfade, moon phases, wolves/villagers event, birds, trees, houses, lights, NO drag bug

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

// Birds, wind, trees, houses, wolves/villagers
let birds = [], winds = [], trees = [], houses = [], wolves = [], villagers = [];
let moonPhase = 0; // 0=new, 0.5=half, 1=full
let moonPhaseTarget = 0;
let moonPhaseAngle = 0;
let fullMoonEvent = false;
let wolfEventProgress = 0;

// --- Responsive ---
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
    spawnBirds();
    spawnWinds();
    spawnTrees();
    spawnHouses();
    wolves = [];
    villagers = [];
    wolfEventProgress = 0;
    fullMoonEvent = false;
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
    // Instant paddle control – NO drag lag!
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left - PADDLE_W/2;
    mousePos.y = e.clientY - rect.top - PADDLE_H/2;
    if (running && mode==="ai") {
        player1.x = clamp(mousePos.x, PLAYER_X_RANGE[0], PLAYER_X_RANGE[1]);
        player1.y = clamp(mousePos.y, Y_RANGE[0], Y_RANGE[1]);
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

// --- Alto's background ---
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

// --- Mountain profile for sun and birds ---
function getMountainProfilePoints(yBase, yPeak, n, offset=0, width=BOARD_W) {
    let pts = [];
    for (let i=0; i<=n; ++i) {
        let t = i/n, x = offset + width*t;
        let y = yBase - Math.pow(Math.sin(Math.PI*t), 2.3)*(yBase-yPeak)*1.18
            + Math.sin(offset*2+t*7)*16 + Math.cos(offset*3+t*11)*10;
        pts.push({x, y});
    }
    return pts;
}

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

    // Parallax mountain layers, foreground last
    drawMountains(BOARD_H, 0.23, 0.19, 32, [80, 105, 142], 0.7, progress*0.5, 1.0);
    drawMountains(BOARD_H, 0.36, 0.28, 36, [65, 79, 101], 0.86, progress, 0.5);

    // Foreground mountain for sun/bird occlusion
    drawMountains(BOARD_H, 0.53, 0.36, 55, [39, 52, 77], 1.0, progress*1.5, 0.23, true, progress);

    // Trees & Houses (drawn on front mountain)
    drawTreesAndHouses();

    // Sun/Moon - crossfade, phases, in between mountains
    drawSunMoonBetweenMountains(progress);

    // Wolves/villagers event at full moon
    drawWolvesAndVillagers();

    drawWinds();
    drawBirds();
}

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

// --- Sun/Moon crossfade and phase ---
function drawSunMoonBetweenMountains(progress) {
    // Sun/Moon both emerge between mountains, moon follows phase
    if (!window.__alto_mountain_profile) return;
    let mountain = window.__alto_mountain_profile;
    let n = mountain.length;
    let sunT = 1 - Math.abs((progress*2)%2-1); // 0 (night), 1 (noon), back to 0

    // X always center, Y between peaks
    let sunX = BOARD_W/2;
    let closest = mountain.slice().sort((a,b)=>Math.abs(a.x-sunX)-Math.abs(b.x-sunX))[0];
    let minY = closest.y;
    let maxY = BOARD_H*0.10;
    let sunY = minY - (minY-maxY)*Math.pow(sunT,1.6);

    // Sun/Moon crossfade
    let moonY = sunY;
    let moonX = sunX;
    let moonAlpha = 0, sunAlpha = 0;
    // Sun is up 0.11..0.89, moon is up 0..0.175, 0.825..1
    if (progress < 0.12) {
        sunAlpha = Math.max(0, (progress-0.01)/0.11);
        moonAlpha = 1-sunAlpha;
    } else if (progress > 0.88) {
        sunAlpha = Math.max(0, (1-progress-0.01)/0.11);
        moonAlpha = 1-sunAlpha;
    } else {
        sunAlpha = 1;
        moonAlpha = 0;
    }

    // Sun: large, glowy, always behind mountains, up to 2.5x default
    let sunR = 55*2.5;
    ctx.save();
    ctx.globalAlpha = sunAlpha*0.96;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI*2);
    ctx.fillStyle = rgb(SUN_COLOR);
    ctx.shadowColor = "#ffeab077";
    ctx.shadowBlur = 74;
    ctx.fill();
    ctx.restore();

    // Moon: same position, phase mask
    updateMoonPhase(progress);
    ctx.save();
    ctx.globalAlpha = moonAlpha*0.96;
    ctx.beginPath();
    ctx.arc(moonX, moonY, sunR*0.92, 0, Math.PI*2);
    ctx.fillStyle = rgb(MOON_COLOR);
    ctx.shadowColor = "#ccd7ffbb";
    ctx.shadowBlur = 40;
    ctx.fill();
    // Phase: mask out for waxing/waning
    if (moonPhase < 0.98) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        let phaseR = sunR*0.92;
        // The phase shape: a horizontally offset disk
        let offset = (moonPhase-0.5)*phaseR*2.4;
        ctx.arc(moonX+offset, moonY, phaseR, 0, Math.PI*2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
}

function updateMoonPhase(progress) {
    // Progress: 0 = midnight, 0.5 = noon, 1 = next midnight
    // Moon phase cycles every 8 "days" (for demo): new→wax→full→wan→new
    let moonDay = Math.floor(progress*8);
    let t = (progress*8)%1; // 0..1 in phase
    if (moonDay%4===0) { moonPhase = t; } // waxing
    else if (moonDay%4===1) { moonPhase = 1; } // full
    else if (moonDay%4===2) { moonPhase = 1-t; } // waning
    else { moonPhase = 0; } // new

    // Trigger wolf event at full moon
    if (moonPhase > 0.97 && !fullMoonEvent && (progress < 0.2 || progress > 0.8)) {
        fullMoonEvent = true;
        wolfEventProgress = 0;
        spawnWolvesAndVillagers();
    }
    // End wolf event when moon passes
    if (moonPhase < 0.5 && fullMoonEvent) {
        fullMoonEvent = false;
        wolves = [];
        villagers = [];
        wolfEventProgress = 0;
    }
}

// --- Trees & Houses ---
function spawnTrees() {
    trees = [];
    if (!window.__alto_mountain_profile) return;
    let pts = window.__alto_mountain_profile;
    for (let i=3; i<pts.length-3; i+=Math.round(5+Math.random()*5)) {
        let x = pts[i].x+Math.random()*8-4;
        let y = pts[i].y;
        trees.push({x, y, scale: 0.7+Math.random()*0.7});
    }
}
function spawnHouses() {
    houses = [];
    if (!window.__alto_mountain_profile) return;
    let pts = window.__alto_mountain_profile;
    for (let i=7; i<pts.length-7; i+=Math.round(18+Math.random()*14)) {
        let x = pts[i].x+Math.random()*9-4;
        let y = pts[i].y;
        houses.push({x, y, scale: 0.9+Math.random()*0.5, lit: false});
    }
}
function drawTreesAndHouses() {
    // Draw trees
    for (let t of trees) {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.scale, t.scale);
        // Trunk
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 12);
        ctx.strokeStyle = "#3d3b3b";
        ctx.lineWidth = 2.3;
        ctx.stroke();
        // Foliage (conifer)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-7, 9); ctx.lineTo(7, 9); ctx.closePath();
        ctx.fillStyle = "#2a3738";
        ctx.globalAlpha = 0.83;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    }
    // Draw houses
    let isNight = (dayNightProgress < 0.18 || dayNightProgress > 0.82);
    for (let h of houses) {
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.scale(h.scale, h.scale);
        // Base
        ctx.beginPath();
        ctx.rect(-10, -15, 20, 15);
        ctx.fillStyle = "#f8f5e0";
        ctx.globalAlpha = 0.93;
        ctx.fill();
        // Roof
        ctx.beginPath();
        ctx.moveTo(-12, -15);
        ctx.lineTo(0, -26);
        ctx.lineTo(12, -15);
        ctx.closePath();
        ctx.fillStyle = "#a03424";
        ctx.globalAlpha = 0.92;
        ctx.fill();
        // Windows (lit at night)
        ctx.globalAlpha = 1;
        ctx.fillStyle = isNight ? "#fffec0" : "#cbbd8b";
        ctx.fillRect(-6, -10, 5, 7);
        ctx.fillRect(1, -10, 5, 7);
        ctx.restore();
    }
}

// --- Wolves & Villagers event at full moon ---
function spawnWolvesAndVillagers() {
    if (!window.__alto_mountain_profile) return;
    wolves = [];
    villagers = [];
    let pts = window.__alto_mountain_profile;
    let peak = pts[Math.floor(pts.length/2)];
    // Wolves: leader and 3-5 followers, left of peak
    let baseX = peak.x-90, baseY = peak.y+4;
    let nWolves = 4+Math.floor(Math.random()*2);
    for (let i=0;i<nWolves;++i)
        wolves.push({x: baseX-i*18, y: baseY, howl: false, chased: false, alpha: 1});
    // Villagers/herdsmen, right of wolves
    for (let i=0;i<4;++i)
        villagers.push({x: baseX+95+i*13, y: baseY+13+Math.random()*10, chasing: false, alpha: 1});
    wolfEventProgress = 0;
}
function drawWolvesAndVillagers() {
    if (!wolves.length) return;
    // Animation progress: 0..1 = approach, 1..1.3 = howling, then chase
    wolfEventProgress += 1/60;
    // Wolves howling: leader first, then each delays by 0.09
    for (let i=0;i<wolves.length;++i) {
        if (wolfEventProgress > 1.0 + i*0.09) wolves[i].howl = true;
        // After 1.3, chased!
        if (wolfEventProgress > 1.4) wolves[i].chased = true;
        // If chased, run left
        if (wolves[i].chased) wolves[i].x -= 2.5;
    }
    // Villagers chase after 1.5
    if (wolfEventProgress > 1.5) villagers.forEach(v=>{v.chasing=true;});
    // Villagers move toward wolves
    for (let v of villagers) {
        if (v.chasing) v.x -= 2.4;
    }
    // Draw wolves
    for (let i=wolves.length-1;i>=0;--i) {
        let w = wolves[i];
        ctx.save();
        ctx.globalAlpha = w.alpha;
        ctx.translate(w.x, w.y);
        ctx.scale(1.15, 1.15);
        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI*2);
        ctx.fillStyle = "#202025";
        ctx.globalAlpha = 0.95;
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.ellipse(9, -6, 5, 3.5, -0.3, 0, Math.PI*2);
        ctx.fill();
        // Tail
        ctx.beginPath();
        ctx.moveTo(-11,2); ctx.lineTo(-19,0); ctx.lineTo(-11,-1);
        ctx.closePath();
        ctx.fill();
        // Legs
        ctx.beginPath();
        ctx.moveTo(-4,5); ctx.lineTo(-4,12);
        ctx.moveTo(2,5); ctx.lineTo(2,12);
        ctx.strokeStyle = "#202025";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Howl pose: leader raises head
        if (w.howl) {
            ctx.save();
            ctx.rotate(-0.32);
            ctx.beginPath();
            ctx.arc(15,-15,3,0,Math.PI*2);
            ctx.fillStyle = "#fff";
            ctx.globalAlpha = 0.13;
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }
    // Draw villagers/herdsmen
    for (let v of villagers) {
        ctx.save();
        ctx.globalAlpha = v.alpha;
        ctx.translate(v.x, v.y);
        ctx.scale(1,1);
        // Body
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI*2);
        ctx.fillStyle = "#b8a683";
        ctx.globalAlpha = 0.96;
        ctx.fill();
        // Head
        ctx.beginPath();
        ctx.arc(0, -8, 3.2, 0, Math.PI*2);
        ctx.fillStyle = "#f6e8ce";
        ctx.fill();
        // Stick
        ctx.beginPath();
        ctx.moveTo(7, -2); ctx.lineTo(13, 7);
        ctx.strokeStyle = "#4b3d23";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

// --- Birds ---
function spawnBirds() {
    birds = [];
    let nFlocks = 1 + Math.floor(Math.random()*2);
    for (let f=0; f<nFlocks; ++f) {
        let n = 3 + Math.floor(Math.random()*5); // up to 7 birds
        let t0 = Math.random()*0.7+0.1;
        let leftToRight = Math.random() > 0.5;
        let baseY = BOARD_H*0.28 + Math.random()*BOARD_H*0.16;
        let arcHeight = 60+Math.random()*60;
        let speed = (0.13+Math.random()*0.18)*(leftToRight?1:-1);
        for (let i=0; i<n; ++i) {
            birds.push({
                t: t0-i*0.07,
                arcY: baseY+Math.random()*9,
                arcHeight: arcHeight+Math.random()*13,
                speed,
                leftToRight,
                offset: Math.random()*Math.PI*2,
                spread: 14+Math.random()*10,
                size: 13+Math.random()*6,
                alpha: 0.15+Math.random()*0.20,
                wing: Math.random()*Math.PI*2
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
        // Path: low arc, center region
        let px = BOARD_W*(b.leftToRight?b.t:1-b.t);
        let py = b.arcY - Math.sin(b.t*Math.PI)*b.arcHeight;
        // Wing animation
        let now = performance.now()/550 + b.offset;
        let wingAngle = Math.sin(now)*0.74 + 0.17*Math.cos(now*0.7+b.offset);
        b.wing = wingAngle;
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.translate(px, py);
        ctx.scale(b.leftToRight?1:-1,1);
        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, b.size*0.7, b.size*0.32, 0, 0, Math.PI*2);
        ctx.fillStyle = "#1a151a";
        ctx.fill();
        // Wings: animated up/down
        ctx.save();
        ctx.rotate(-b.wing*0.9);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(-b.size*1.1, -b.size*0.7);
        ctx.lineWidth = 2.7;
        ctx.strokeStyle = "#16151a";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 2;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.rotate(b.wing*0.9);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(b.size*1.1, -b.size*0.7);
        ctx.lineWidth = 2.7;
        ctx.strokeStyle = "#16151a";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 2;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }
    // Randomly respawn flocks every 8-12 seconds
    if (Math.random()<0.0015) spawnBirds();
}

// --- Wind ---
function spawnWinds() {
    winds = [];
    let n = 4 + Math.floor(Math.random()*2);
    for (let i=0;i<n;++i) {
        winds.push({
            t: Math.random(),
            y: BOARD_H*0.2 + Math.random()*BOARD_H*0.4,
            speed: 0.10+Math.random()*0.06,
            amp: 25+Math.random()*22,
            len: BOARD_W*0.42+Math.random()*BOARD_W*0.26,
            offset: Math.random()*Math.PI*2,
            alpha: 0.09+Math.random()*0.09
        });
    }
}
function drawWinds() {
    for (let w of winds) {
        w.t += w.speed/600;
        if (w.t > 1) w.t = -0.1;
        let x0 = -w.len + w.t*(BOARD_W+w.len*2);
        ctx.save();
        ctx.globalAlpha = w.alpha;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i=0;i<=40;++i) {
            let t = i/40;
            let x = x0 + t*w.len;
            let y = w.y + Math.sin(w.offset+t*3.5+performance.now()/2300)*w.amp*Math.sin(Math.PI*t);
            if (i===0) ctx.moveTo(x,y);
            else ctx.lineTo(x,y);
        }
        ctx.stroke();
        ctx.restore();
    }
}

// --- Drawing ---
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

// --- Pong logic ---
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

function updatePaddles(dt) {
    // Ultra-responsive: always update from input, no lag
    if (mode==='ai') {
        // Mouse paddle is set directly in mousemove handler
    } else {
        const paddleSpeed = 7.4;
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

// Swept collision for fast ball/paddle movement
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
    ball.vx = baseVx + (p.vx||0)*0.3;
    ball.vy = baseVy;
    if (leftPaddle) ball.x = p.x + PADDLE_W + BALL_RADIUS + 1;
    else ball.x = p.x - BALL_RADIUS - 1;
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

function scoreReset() {
    resetBall(Math.random()>0.5?1:-1);
}
