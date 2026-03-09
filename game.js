/**
 * game.js - Dino Runner Game Engine
 * Full Chrome dino game with day/night cycle, obstacles, scoring, sounds,
 * and pterodactyl attacks using sprites from dinoSprites.png
 */

(function () {
    'use strict';

    // ===== CONSTANTS =====
    const CANVAS_WIDTH = 750;
    const CANVAS_HEIGHT = 250;
    const GROUND_Y = 176;
    const GRAVITY = 0.45;
    const JUMP_FORCE = -10.5;
    const INITIAL_SPEED = 4.5;
    const MAX_SPEED = 12;
    const SPEED_INCREMENT = 0.0006;
    const MIN_OBSTACLE_GAP = 300;
    const NIGHT_SCORE = 700;
    const MILESTONE_INTERVAL = 100;
    const BIRD_MIN_SCORE = 150;          // birds start appearing at score 150
    const BIRD_ATTACK_MIN_SCORE = 400;   // dive-bombing birds after score 400

    // ===== AUDIO ENGINE (Web Audio API) =====
    const AudioEngine = (() => {
        let audioCtx = null;

        function getCtx() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            return audioCtx;
        }

        function playJump() {
            try {
                const ctx = getCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'square';
                osc.frequency.setValueAtTime(400, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.12);
            } catch (e) { }
        }

        function playScore() {
            try {
                const ctx = getCtx();
                const notes = [523, 659, 784];
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'square';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.06);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.1);
                    osc.start(ctx.currentTime + i * 0.06);
                    osc.stop(ctx.currentTime + i * 0.06 + 0.1);
                });
            } catch (e) { }
        }

        function playDie() {
            try {
                const ctx = getCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'square';
                osc.frequency.setValueAtTime(300, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.35);
            } catch (e) { }
        }

        function playSwoop() {
            try {
                const ctx = getCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.06, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.25);
            } catch (e) { }
        }

        return { playJump, playScore, playDie, playSwoop };
    })();

    // ===== DOM =====
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const startScreen = document.getElementById('start-screen');
    const startBtn = document.getElementById('start-btn');

    // Scale for HiDPI
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = CANVAS_WIDTH + 'px';
    canvas.style.height = CANVAS_HEIGHT + 'px';
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    // ===== GAME STATE =====
    let sprites = null; // loaded async
    let gameState = 'loading'; // loading, idle, playing, gameover
    let score = 0;
    let highScore = parseInt(localStorage.getItem('dinoHighScore')) || 0;
    let speed = INITIAL_SPEED;
    let frameCount = 0;
    let lastMilestone = 0;
    let nightMode = false;
    let nightTransition = 0;
    let distanceSinceLastObstacle = 0;
    let flashTimer = 0;
    let shakeTimer = 0;
    let shakeIntensity = 0;
    let timeSinceLastBird = 0;
    let lives = 0;
    let maxLives = 0;
    let invincibleTimer = 0;
    let obstacleLagTimer = 0;
    let difficulty = 'med';

    const difficultySelect = document.getElementById('difficulty');

    // ===== DINO =====
    const dino = {
        x: 50,
        y: GROUND_Y,
        vy: 0,
        width: 44,
        height: 47,
        ducking: false,
        jumping: false,
        animFrame: 0,
        animTimer: 0,
        grounded: true,
    };

    // ===== OBSTACLES =====
    let obstacles = [];

    function createObstacle() {
        const type = Math.random();
        let obs;

        if (type < 0.30) {
            // Small cactus
            const s = sprites.cactus.small;
            obs = {
                type: 'cactus',
                sprite: s,
                x: CANVAS_WIDTH + 20,
                y: GROUND_Y + dino.height - s.height,
                width: s.width,
                height: s.height,
                hitboxShrink: 8,
            };
        } else if (type < 0.55) {
            // Large cactus
            const s = sprites.cactus.large;
            obs = {
                type: 'cactus',
                sprite: s,
                x: CANVAS_WIDTH + 20,
                y: GROUND_Y + dino.height - s.height,
                width: s.width,
                height: s.height,
                hitboxShrink: 10,
            };
        } else if (type < 0.75) {
            // Cactus cluster
            const s = sprites.cactus.cluster;
            obs = {
                type: 'cactus',
                sprite: s,
                x: CANVAS_WIDTH + 20,
                y: GROUND_Y + dino.height - s.height,
                width: s.width,
                height: s.height,
                hitboxShrink: 10,
            };
        } else {
            // Bird / Pterodactyl
            if (score < BIRD_MIN_SCORE) return createObstacle();
            timeSinceLastBird = 0;

            // Decide if it's a dive-bombing attack bird or normal bird
            const isAttackBird = score >= BIRD_ATTACK_MIN_SCORE && Math.random() < 0.35;

            if (isAttackBird) {
                // Attack bird: starts high and swoops down toward the dino
                AudioEngine.playSwoop();
                obs = {
                    type: 'bird',
                    subtype: 'attack',
                    x: CANVAS_WIDTH + 20,
                    y: 20 + Math.random() * 30, // starts high
                    targetY: GROUND_Y + dino.height - sprites.bird.height + 5, // swoops to ground level
                    swoopSpeed: 0,
                    swoopPhase: 'approach', // approach -> dive -> level
                    swoopTriggerX: CANVAS_WIDTH * 0.5 + Math.random() * 100, // x position to start dive
                    width: sprites.bird.width,
                    height: sprites.bird.height,
                    animFrame: 0,
                    animTimer: 0,
                    hitboxShrink: 10,
                };
            } else {
                // Normal bird at random heights
                const heights = [
                    GROUND_Y + dino.height - sprites.bird.height + 5,  // low (ground level)
                    GROUND_Y - 20,                                       // mid
                    GROUND_Y - 55,                                       // high
                ];
                const birdY = heights[Math.floor(Math.random() * heights.length)];
                obs = {
                    type: 'bird',
                    subtype: 'normal',
                    x: CANVAS_WIDTH + 20,
                    y: birdY,
                    width: sprites.bird.width,
                    height: sprites.bird.height,
                    animFrame: 0,
                    animTimer: 0,
                    hitboxShrink: 10,
                };
            }
        }

        obstacles.push(obs);
    }

    // ===== BACKGROUND ELEMENTS =====
    let clouds = [];
    let stars = [];
    let groundX = 0;

    function initClouds() {
        clouds = [];
        for (let i = 0; i < 5; i++) {
            clouds.push({
                x: Math.random() * CANVAS_WIDTH,
                y: 20 + Math.random() * 60,
                speed: 0.5 + Math.random() * 0.8,
            });
        }
    }

    function initStars() {
        stars = [];
        for (let i = 0; i < 20; i++) {
            stars.push({
                x: Math.random() * CANVAS_WIDTH,
                y: 10 + Math.random() * 100,
                twinkle: Math.random() * Math.PI * 2,
            });
        }
    }

    // ===== PARTICLES =====
    let particles = [];

    function spawnDustParticles() {
        for (let i = 0; i < 4; i++) {
            particles.push({
                x: dino.x + 5,
                y: GROUND_Y + dino.height - 2,
                vx: -1 - Math.random() * 2,
                vy: -0.5 - Math.random() * 1.5,
                life: 15 + Math.random() * 10,
                maxLife: 25,
                size: 2 + Math.random() * 2,
            });
        }
    }

    function spawnDeathParticles() {
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            particles.push({
                x: dino.x + dino.width / 2,
                y: dino.y + dino.height / 2,
                vx: Math.cos(angle) * (2 + Math.random() * 3),
                vy: Math.sin(angle) * (2 + Math.random() * 3),
                life: 25 + Math.random() * 15,
                maxLife: 40,
                size: 2 + Math.random() * 3,
            });
        }
    }

    // ===== COLLISION =====
    function checkCollision(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    // ===== GAME LOGIC =====
    function resetGame() {
        score = 0;
        speed = INITIAL_SPEED;
        frameCount = 0;
        lastMilestone = 0;
        obstacles = [];
        particles = [];
        distanceSinceLastObstacle = 999;
        timeSinceLastBird = 0;
        flashTimer = 0;
        shakeTimer = 0;
        nightMode = false;
        nightTransition = 0;
        invincibleTimer = 0;
        lives = maxLives;

        dino.y = GROUND_Y;
        dino.vy = 0;
        dino.ducking = false;
        dino.jumping = false;
        dino.grounded = true;
        dino.animFrame = 0;

        initClouds();
        initStars();
    }

    function startGame() {
        if (difficultySelect) {
            difficulty = difficultySelect.value;
        }
        if (difficulty === 'easy') {
            maxLives = 5;
            obstacleLagTimer = 180; // longer wait before start
        } else if (difficulty === 'med') {
            maxLives = 3;
            obstacleLagTimer = 120;
        } else {
            maxLives = 1;
            obstacleLagTimer = 60; // shorter wait
        }
        lives = maxLives;

        startScreen.classList.add('hidden');
        resetGame();
        gameState = 'playing';
        loop();
    }

    function gameOver() {
        gameState = 'gameover';
        AudioEngine.playDie();
        spawnDeathParticles();
        shakeTimer = 15;
        shakeIntensity = 6;

        if (score > highScore) {
            highScore = score;
            localStorage.setItem('dinoHighScore', highScore);
        }
    }

    function jump() {
        if (dino.grounded && gameState === 'playing') {
            dino.vy = JUMP_FORCE;
            dino.jumping = true;
            dino.grounded = false;
            dino.ducking = false;
            AudioEngine.playJump();
            spawnDustParticles();
        }
    }

    function duckStart() {
        if (gameState === 'playing') {
            dino.ducking = true;
            if (dino.jumping && dino.vy < 0) {
                dino.vy = 2; // Fast fall
            }
        }
    }

    function duckEnd() {
        dino.ducking = false;
    }

    // ===== UPDATE =====
    function update() {
        frameCount++;

        // Adjust speed curve base on difficulty
        const diffSpeedMult = difficulty === 'hard' ? 1.2 : (difficulty === 'easy' ? 0.8 : 1.0);
        speed = Math.min(MAX_SPEED * diffSpeedMult, (INITIAL_SPEED + frameCount * SPEED_INCREMENT) * diffSpeedMult);
        score = Math.floor(frameCount * speed * 0.01);

        if (invincibleTimer > 0) invincibleTimer--;
        if (obstacleLagTimer > 0) obstacleLagTimer--;

        // Milestone sound
        const currentMilestone = Math.floor(score / MILESTONE_INTERVAL);
        if (currentMilestone > lastMilestone) {
            lastMilestone = currentMilestone;
            AudioEngine.playScore();
            flashTimer = 15;
        }

        // Day/night cycle
        const cyclePos = Math.floor(score / NIGHT_SCORE);
        const shouldBeNight = cyclePos % 2 === 1;
        if (shouldBeNight && nightTransition < 1) {
            nightTransition = Math.min(1, nightTransition + 0.02);
        } else if (!shouldBeNight && nightTransition > 0) {
            nightTransition = Math.max(0, nightTransition - 0.02);
        }
        nightMode = nightTransition > 0.5;

        // Dino physics
        if (!dino.grounded) {
            dino.vy += GRAVITY;
            dino.y += dino.vy;

            if (dino.y >= GROUND_Y) {
                dino.y = GROUND_Y;
                dino.vy = 0;
                dino.grounded = true;
                dino.jumping = false;
                spawnDustParticles();
            }
        }

        // Dino animation
        dino.animTimer++;
        if (dino.animTimer > 6) {
            dino.animTimer = 0;
            dino.animFrame = (dino.animFrame + 1) % 2;
        }

        // Ground scroll
        groundX = (groundX + speed) % sprites.ground.width;

        // Clouds
        clouds.forEach(c => {
            c.x -= c.speed;
            if (c.x < -60) {
                c.x = CANVAS_WIDTH + Math.random() * 100;
                c.y = 20 + Math.random() * 60;
            }
        });

        // Stars twinkle
        stars.forEach(s => {
            s.twinkle += 0.05;
        });

        // Track time since last bird
        timeSinceLastBird++;

        // Obstacle spawning
        if (obstacleLagTimer <= 0) {
            distanceSinceLastObstacle += speed;
            const gap = MIN_OBSTACLE_GAP - speed * 8;
            if (distanceSinceLastObstacle > Math.max(gap, 200)) {
                if (Math.random() < 0.02 * speed) {
                    createObstacle();
                    distanceSinceLastObstacle = 0;
                }
            }
        }

        // Update obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obs = obstacles[i];
            obs.x -= speed;

            if (obs.type === 'bird') {
                // Wing flap animation
                obs.animTimer = (obs.animTimer || 0) + 1;
                if (obs.animTimer > 12) {
                    obs.animTimer = 0;
                    obs.animFrame = (obs.animFrame + 1) % 2;
                }

                // Attack bird swooping behavior
                if (obs.subtype === 'attack') {
                    if (obs.swoopPhase === 'approach' && obs.x <= obs.swoopTriggerX) {
                        obs.swoopPhase = 'dive';
                        obs.swoopSpeed = 0;
                    }
                    if (obs.swoopPhase === 'dive') {
                        obs.swoopSpeed = Math.min(obs.swoopSpeed + 0.3, 4);
                        obs.y += obs.swoopSpeed;
                        if (obs.y >= obs.targetY) {
                            obs.y = obs.targetY;
                            obs.swoopPhase = 'level';
                        }
                    }
                    // In 'level' phase, bird just flies straight at ground level
                }

                // Birds occasionally shoot daggers (more often on hard)
                const shootChance = difficulty === 'hard' ? 0.02 : (difficulty === 'med' ? 0.01 : 0.005);
                if (obs.x > 100 && obs.x < CANVAS_WIDTH && Math.random() < shootChance && !obs.hasShot) {
                    obs.hasShot = true; // limit to one shot just to not spam
                    obstacles.push({
                        type: 'dagger',
                        sprite: sprites.dagger,
                        x: obs.x,
                        y: obs.y + obs.height / 2,
                        width: 20,
                        height: 6,
                        hitboxShrink: 0,
                    });
                }
            }

            if (obs.type === 'dagger') {
                obs.x -= speed * 1.5; // Daggers move faster
            } else {
                obs.x -= speed;
            }

            // Remove off-screen
            if (obs.x + obs.width < -20) {
                obstacles.splice(i, 1);
                continue;
            }

            // Collision detection with hitbox shrinking for fairness
            if (invincibleTimer <= 0) {
                const s = obs.hitboxShrink || 0;
                const dinoHitbox = {
                    x: dino.x + 12,
                    y: dino.y + (dino.ducking ? dino.height - sprites.dino.duckHeight + 8 : 8),
                    width: (dino.ducking ? sprites.dino.duckWidth : dino.width) - 24,
                    height: (dino.ducking ? sprites.dino.duckHeight : dino.height) - 16,
                };

                const obsHitbox = {
                    x: obs.x + s,
                    y: obs.y + s,
                    width: obs.width - s * 2,
                    height: obs.height - s * 2,
                };

                if (checkCollision(dinoHitbox, obsHitbox)) {
                    lives--;
                    if (lives <= 0) {
                        gameOver();
                        return;
                    } else {
                        // Take down the obstacle that was hit and grant i-frames
                        obstacles.splice(i, 1);
                        invincibleTimer = 60;
                        AudioEngine.playDie(); // plays a hit sound
                        shakeTimer = 5;
                        shakeIntensity = 3;
                        spawnDustParticles();
                        continue;
                    }
                }
            }
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life--;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Screen shake
        if (shakeTimer > 0) shakeTimer--;
    }

    // ===== RENDER =====
    function render() {
        ctx.save();

        // Screen shake
        if (shakeTimer > 0) {
            const sx = (Math.random() - 0.5) * shakeIntensity;
            const sy = (Math.random() - 0.5) * shakeIntensity;
            ctx.translate(sx, sy);
        }

        // Background color (day/night transition)
        const dayR = 247, dayG = 247, dayB = 247;
        const nightR = 30, nightG = 30, nightB = 50;
        const bgR = Math.round(dayR + (nightR - dayR) * nightTransition);
        const bgG = Math.round(dayG + (nightG - dayG) * nightTransition);
        const bgB = Math.round(dayB + (nightB - dayB) * nightTransition);
        ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Score flash
        if (flashTimer > 0) {
            flashTimer--;
            ctx.fillStyle = nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        // Stars (night)
        if (nightTransition > 0.2) {
            const starAlpha = Math.min(1, (nightTransition - 0.2) / 0.3);
            stars.forEach(s => {
                const twinkle = 0.4 + Math.sin(s.twinkle) * 0.6;
                ctx.globalAlpha = starAlpha * twinkle;
                ctx.drawImage(sprites.star, s.x, s.y);
            });
            ctx.globalAlpha = starAlpha;
            ctx.drawImage(sprites.moon, CANVAS_WIDTH - 70, 20);
            ctx.globalAlpha = 1;
        }

        // Clouds
        clouds.forEach(c => {
            ctx.globalAlpha = nightMode ? 0.15 : 0.6;
            ctx.drawImage(sprites.cloud, c.x, c.y);
        });
        ctx.globalAlpha = 1;

        // Ground
        const groundY = GROUND_Y + dino.height;
        if (nightMode) {
            ctx.globalAlpha = 0.7;
            ctx.filter = 'invert(1)';
        }
        ctx.drawImage(sprites.ground, -groundX, groundY);
        ctx.drawImage(sprites.ground, -groundX + sprites.ground.width, groundY);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;

        // Obstacles
        obstacles.forEach(obs => {
            if (nightMode) ctx.filter = 'invert(1)';

            if (obs.type === 'bird') {
                const birdSprite = sprites.bird.frames[obs.animFrame || 0];
                ctx.drawImage(birdSprite, obs.x, obs.y);

                // Draw warning indicator for attack birds that are diving
                if (obs.subtype === 'attack' && obs.swoopPhase === 'dive') {
                    ctx.filter = 'none';
                    ctx.globalAlpha = 0.6 + Math.sin(frameCount * 0.3) * 0.4;
                    ctx.fillStyle = '#ff4444';
                    ctx.font = 'bold 14px "Press Start 2P", monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText('!', obs.x + obs.width / 2, obs.y - 8);
                    ctx.textAlign = 'left';
                    ctx.globalAlpha = 1;
                    if (nightMode) ctx.filter = 'invert(1)';
                }
            } else {
                ctx.drawImage(obs.sprite, obs.x, obs.y);
            }

            ctx.filter = 'none';
        });

        // Dino
        let dinoSprite;
        let drawX = dino.x;
        let drawY = dino.y;

        if (gameState === 'gameover') {
            dinoSprite = sprites.dino.dead;
        } else if (dino.jumping || !dino.grounded) {
            dinoSprite = sprites.dino.jump;
        } else if (dino.ducking) {
            dinoSprite = sprites.dino.duck[dino.animFrame];
            drawY = dino.y + dino.height - sprites.dino.duckHeight;
        } else {
            dinoSprite = sprites.dino.run[dino.animFrame];
        }

        if (nightMode) ctx.filter = 'invert(1)';
        // Make dino blink if invincible
        if (invincibleTimer === 0 || Math.floor(invincibleTimer / 5) % 2 === 0) {
            ctx.drawImage(dinoSprite, drawX, drawY);
        }
        ctx.filter = 'none';

        // Particles
        particles.forEach(p => {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = nightMode ? '#fff' : '#535353';
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        ctx.globalAlpha = 1;

        // HUD
        renderHUD();

        // Game Over overlay
        if (gameState === 'gameover') {
            renderGameOver();
        }

        ctx.restore();
    }

    function renderHUD() {
        const textColor = nightMode ? '#e0e0e0' : '#535353';
        ctx.fillStyle = textColor;
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.textAlign = 'right';

        // High Score
        if (highScore > 0) {
            ctx.fillStyle = nightMode ? '#888' : '#aaa';
            ctx.fillText('HI ' + String(highScore).padStart(5, '0'), CANVAS_WIDTH - 100, 25);
        }

        // Current Score (blink on milestone)
        if (flashTimer > 0 && flashTimer % 4 < 2) {
            ctx.fillStyle = 'transparent';
        } else {
            ctx.fillStyle = textColor;
        }
        ctx.fillText(String(score).padStart(5, '0'), CANVAS_WIDTH - 15, 25);

        // Draw Lives
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.fillText(`LIVES: ${lives}`, 15, 25);
    }

    function renderGameOver() {
        ctx.textAlign = 'center';

        ctx.fillStyle = nightMode ? '#e0e0e0' : '#535353';
        ctx.font = '20px "Press Start 2P", monospace';
        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

        // Restart icon
        const iconX = CANVAS_WIDTH / 2 - 18;
        const iconY = CANVAS_HEIGHT / 2;
        if (nightMode) ctx.filter = 'invert(1)';
        ctx.drawImage(sprites.restart, iconX, iconY);
        ctx.filter = 'none';

        ctx.textAlign = 'left';
    }

    // ===== GAME LOOP =====
    let rafId = null;

    function loop() {
        if (gameState === 'playing') {
            update();
        }
        render();

        // Update particles even in gameover
        if (gameState === 'gameover') {
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.1;
                p.life--;
                if (p.life <= 0) particles.splice(i, 1);
            }
            if (shakeTimer > 0) shakeTimer--;
        }

        rafId = requestAnimationFrame(loop);
    }

    // ===== INPUT HANDLING =====
    const keys = {};

    document.addEventListener('keydown', (e) => {
        if (keys[e.code]) return;
        keys[e.code] = true;

        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (gameState === 'idle') {
                startGame();
            } else if (gameState === 'playing') {
                jump();
            } else if (gameState === 'gameover') {
                resetGame();
                gameState = 'playing';
            }
        }

        if (e.code === 'ArrowDown') {
            e.preventDefault();
            if (gameState === 'playing') {
                duckStart();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
        if (e.code === 'ArrowDown') {
            duckEnd();
        }
    });

    // Touch support
    let touchStartY = 0;

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchStartY = e.touches[0].clientY;
        if (gameState === 'idle') {
            startGame();
        } else if (gameState === 'gameover') {
            resetGame();
            gameState = 'playing';
        } else if (gameState === 'playing') {
            jump();
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const dy = e.touches[0].clientY - touchStartY;
        if (dy > 30 && gameState === 'playing') {
            duckStart();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        duckEnd();
    }, { passive: false });

    canvas.addEventListener('click', (e) => {
        if (gameState === 'gameover') {
            resetGame();
            gameState = 'playing';
        }
    });

    startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (gameState === 'idle') {
            startGame();
        }
    });

    // ===== IDLE ANIMATION =====
    function idleLoop() {
        if (gameState !== 'idle' || !sprites) return;

        ctx.fillStyle = '#f7f7f7';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw ground
        const groundY2 = GROUND_Y + dino.height;
        ctx.drawImage(sprites.ground, 0, groundY2);

        // Draw standing dino
        ctx.drawImage(sprites.dino.run[0], dino.x, dino.y);

        requestAnimationFrame(idleLoop);
    }

    // ===== LOADING SCREEN =====
    function renderLoading() {
        ctx.fillStyle = '#f7f7f7';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#535353';
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Loading...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.textAlign = 'left';
    }

    // ===== RESPONSIVE RESIZE =====
    function handleResize() {
        const maxW = Math.min(window.innerWidth - 20, CANVAS_WIDTH);
        const scale = maxW / CANVAS_WIDTH;
        if (scale < 1) {
            canvas.style.width = maxW + 'px';
            canvas.style.height = (CANVAS_HEIGHT * scale) + 'px';
        } else {
            canvas.style.width = CANVAS_WIDTH + 'px';
            canvas.style.height = CANVAS_HEIGHT + 'px';
        }
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    // ===== INITIALIZE =====
    renderLoading();

    SpriteFactory.loadSheet().then((loadedSprites) => {
        sprites = loadedSprites;

        // Update dino dimensions from actual sprite data
        dino.width = sprites.dino.width;
        dino.height = sprites.dino.height;

        gameState = 'idle';
        idleLoop();
    }).catch((err) => {
        console.error('Sprite loading failed:', err);
        // Show error on canvas
        ctx.fillStyle = '#f7f7f7';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#cc0000';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Failed to load dinoSprites.png', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
        ctx.fillText('Make sure the file is in the same folder', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 10);
        ctx.textAlign = 'left';
    });

})();
