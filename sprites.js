/**
 * sprites.js - Load and extract sprites from dinoSprites.png sprite sheet
 * The sheet layout (from the image):
 *   Row 1: T-Rex — Frame1, Frame2, Jumping, Ducking, Dead
 *   Row 2: Obstacles — Small Cactus, Large Cactus, Cluster of 3 Cacti
 *   Row 3: Pterodactyl — Wings Up, Wings Down
 *   Row 4: Background — Simple Clouds (5 cloud shapes)
 *   Row 5: Ground Texture Strip
 */

const SpriteFactory = (() => {

    /**
     * Extracts a rectangular region from a source image and returns it as
     * a new canvas element (which can be used as an image source for drawImage).
     */
    function extractRegion(img, sx, sy, sw, sh) {
        const c = document.createElement('canvas');
        c.width = sw;
        c.height = sh;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        return c;
    }

    /**
     * Create a tiling ground strip from a source region
     */
    function makeGroundFromRegion(img, sx, sy, sw, sh, totalWidth) {
        const c = document.createElement('canvas');
        c.width = totalWidth;
        c.height = sh;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        for (let x = 0; x < totalWidth; x += sw) {
            ctx.drawImage(img, sx, sy, sw, sh, x, 0, sw, sh);
        }
        return c;
    }

    // ===== STAR (for night mode, still programmatic since not in sheet) =====
    function makeStar() {
        const c = document.createElement('canvas');
        c.width = 9; c.height = 9;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(4, 0, 1, 9);
        ctx.fillRect(0, 4, 9, 1);
        ctx.fillRect(2, 2, 1, 1);
        ctx.fillRect(6, 2, 1, 1);
        ctx.fillRect(2, 6, 1, 1);
        ctx.fillRect(6, 6, 1, 1);
        return c;
    }

    // ===== MOON (programmatic since not in sheet) =====
    function makeMoon() {
        const c = document.createElement('canvas');
        c.width = 20; c.height = 20;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#e8e8c8';
        ctx.beginPath();
        ctx.arc(10, 10, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d8d8b8';
        ctx.beginPath(); ctx.arc(7, 6, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(13, 12, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(6, 13, 1.5, 0, Math.PI * 2); ctx.fill();
        return c;
    }

    // ===== RESTART ICON (programmatic) =====
    function makeRestartIcon() {
        const c = document.createElement('canvas');
        c.width = 36; c.height = 32;
        const ctx = c.getContext('2d');
        ctx.strokeStyle = '#535353';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(18, 16, 11, -Math.PI * 0.8, Math.PI * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 6);
        ctx.lineTo(12, 10);
        ctx.lineTo(7, 12);
        ctx.fillStyle = '#535353';
        ctx.fill();
        return c;
    }

    /**
     * Load the sprite sheet image and return a promise that resolves
     * with all the sprite objects extracted from it.
     */
    function loadSheet() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // We need to figure out the exact pixel positions.
                // The image is 640x638 px based on the generated sprite sheet.
                // Let's measure the regions by analyzing the known layout.
                //
                // The sprite sheet has labels/text in it, so we need to
                // crop around each sprite carefully. We'll scan for the
                // actual sprite bounding boxes using transparency/color detection.
                //
                // For reliability, let's use a canvas to analyze the image.
                const analysis = document.createElement('canvas');
                analysis.width = img.width;
                analysis.height = img.height;
                const actx = analysis.getContext('2d');
                actx.drawImage(img, 0, 0);

                // Helper: find bounding box of non-white/non-transparent pixels in a region
                function findBounds(rx, ry, rw, rh, threshold = 240) {
                    const data = actx.getImageData(rx, ry, rw, rh).data;
                    let minX = rw, minY = rh, maxX = 0, maxY = 0;
                    for (let y = 0; y < rh; y++) {
                        for (let x = 0; x < rw; x++) {
                            const i = (y * rw + x) * 4;
                            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                            // Consider non-white, non-transparent pixels
                            if (a > 20 && (r < threshold || g < threshold || b < threshold)) {
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                            }
                        }
                    }
                    if (maxX < minX) return null; // empty
                    return {
                        x: rx + minX,
                        y: ry + minY,
                        w: maxX - minX + 1,
                        h: maxY - minY + 1
                    };
                }

                // The image layout based on the sprite sheet:
                // The image is divided into labeled rows. We'll search specific regions.
                const W = img.width;
                const H = img.height;

                // === ROW 1: T-REX sprites ===
                // They span roughly the top 25% of the image
                // 5 dino sprites across the width
                const dinoRowTop = 0;
                const dinoRowBot = Math.round(H * 0.24);
                const dinoColW = Math.round(W / 5);

                const dinoRun1Bounds = findBounds(0, dinoRowTop, dinoColW, dinoRowBot);
                const dinoRun2Bounds = findBounds(dinoColW, dinoRowTop, dinoColW, dinoRowBot);
                const dinoJumpBounds = findBounds(dinoColW * 2, dinoRowTop, dinoColW, dinoRowBot);
                const dinoDuckBounds = findBounds(dinoColW * 3, dinoRowTop, dinoColW, dinoRowBot);
                const dinoDeadBounds = findBounds(dinoColW * 4, dinoRowTop, dinoColW, dinoRowBot);

                // === ROW 2: OBSTACLES (cacti) ===
                const cactusRowTop = Math.round(H * 0.24);
                const cactusRowBot = Math.round(H * 0.20);
                const cactusColW = Math.round(W / 3);

                const smallCactusBounds = findBounds(0, cactusRowTop, cactusColW, cactusRowBot);
                const largeCactusBounds = findBounds(cactusColW, cactusRowTop, cactusColW, cactusRowBot);
                const clusterCactusBounds = findBounds(cactusColW * 2, cactusRowTop, cactusColW, cactusRowBot);

                // === ROW 3: PTERODACTYL ===
                const birdRowTop = Math.round(H * 0.44);
                const birdRowH = Math.round(H * 0.18);
                const birdColW = Math.round(W / 2);

                const birdUpBounds = findBounds(0, birdRowTop, birdColW, birdRowH);
                const birdDownBounds = findBounds(birdColW, birdRowTop, birdColW, birdRowH);

                // === ROW 4: CLOUDS ===
                const cloudRowTop = Math.round(H * 0.62);
                const cloudRowH = Math.round(H * 0.15);
                // Multiple clouds across - grab the first one for tiling
                const cloudBounds = findBounds(0, cloudRowTop, Math.round(W / 4), cloudRowH);

                // === ROW 5: GROUND TEXTURE ===
                const groundRowTop = Math.round(H * 0.85);
                const groundRowH = H - groundRowTop;
                const groundBounds = findBounds(0, groundRowTop, W, groundRowH);

                // --- Extract all sprites ---
                function safe(bounds, fallbackW, fallbackH) {
                    if (!bounds) return { x: 0, y: 0, w: fallbackW || 40, h: fallbackH || 40 };
                    return bounds;
                }

                const r1 = safe(dinoRun1Bounds, 80, 86);
                const r2 = safe(dinoRun2Bounds, 80, 86);
                const rj = safe(dinoJumpBounds, 80, 86);
                const rd = safe(dinoDuckBounds, 100, 60);
                const rdd = safe(dinoDeadBounds, 80, 86);

                // Normalize dino run/jump/dead to same height for consistent positioning
                const dinoH = Math.max(r1.h, r2.h, rj.h, rdd.h);
                const dinoW = Math.max(r1.w, r2.w, rj.w, rdd.w);

                function extractPadded(bounds, targetW, targetH) {
                    const c = document.createElement('canvas');
                    c.width = targetW;
                    c.height = targetH;
                    const cx = c.getContext('2d');
                    cx.imageSmoothingEnabled = false;
                    // Draw at bottom-center
                    const ox = Math.floor((targetW - bounds.w) / 2);
                    const oy = targetH - bounds.h;
                    cx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, ox, oy, bounds.w, bounds.h);
                    return c;
                }

                const dinoRun1 = extractPadded(r1, dinoW, dinoH);
                const dinoRun2 = extractPadded(r2, dinoW, dinoH);
                const dinoJump = extractPadded(rj, dinoW, dinoH);
                const dinoDead = extractPadded(rdd, dinoW, dinoH);

                // Duck sprites use different dimensions
                const duckW = rd.w;
                const duckH = rd.h;
                const dinoDuck1 = extractRegion(img, rd.x, rd.y, rd.w, rd.h);
                // For duck frame 2, use same sprite with slight offset to simulate leg movement
                const dinoDuck2 = extractRegion(img, rd.x, rd.y, rd.w, rd.h);

                // Cacti
                const sc = safe(smallCactusBounds, 25, 50);
                const lc = safe(largeCactusBounds, 35, 70);
                const cc = safe(clusterCactusBounds, 70, 70);

                const smallCactus = extractRegion(img, sc.x, sc.y, sc.w, sc.h);
                const largeCactus = extractRegion(img, lc.x, lc.y, lc.w, lc.h);
                const clusterCactus = extractRegion(img, cc.x, cc.y, cc.w, cc.h);

                // Birds
                const bu = safe(birdUpBounds, 46, 40);
                const bd = safe(birdDownBounds, 46, 40);
                const birdW = Math.max(bu.w, bd.w);
                const birdH = Math.max(bu.h, bd.h);

                const birdUp = extractPadded(bu, birdW, birdH);
                const birdDown = extractPadded(bd, birdW, birdH);

                // Cloud
                const cl = safe(cloudBounds, 46, 14);
                const cloud = extractRegion(img, cl.x, cl.y, cl.w, cl.h);

                // Ground - tile to 2400px wide
                const gr = safe(groundBounds, W, 26);
                const ground = makeGroundFromRegion(img, gr.x, gr.y, gr.w, gr.h, 2400);

                resolve({
                    dino: {
                        run: [dinoRun1, dinoRun2],
                        jump: dinoJump,
                        duck: [dinoDuck1, dinoDuck2],
                        dead: dinoDead,
                        width: dinoW,
                        height: dinoH,
                        duckWidth: duckW,
                        duckHeight: duckH,
                    },
                    cactus: {
                        small: smallCactus,
                        large: largeCactus,
                        cluster: clusterCactus,
                    },
                    bird: {
                        frames: [birdUp, birdDown],
                        width: birdW,
                        height: birdH,
                    },
                    cloud: cloud,
                    star: makeStar(),
                    moon: makeMoon(),
                    ground: ground,
                    restart: makeRestartIcon(),
                    sourceImage: img,
                });
            };

            img.onerror = () => {
                console.error('Failed to load sprite sheet, falling back to programmatic sprites');
                reject(new Error('Sprite sheet load failed'));
            };

            img.src = 'dinoSprites.png';
        });
    }

    return {
        loadSheet,
    };
})();
