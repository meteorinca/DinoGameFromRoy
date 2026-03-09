/**
 * sprites.js - Load individual sprites from assets folder
 */

const SpriteFactory = (() => {

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

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load ' + src));
            img.src = src;
        });
    }

    // A simple dagger for the birds to shoot
    function makeDagger() {
        const c = document.createElement('canvas');
        c.width = 20; c.height = 6;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#888';
        ctx.fillRect(5, 2, 15, 2);
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.lineTo(5, 0);
        ctx.lineTo(5, 6);
        ctx.fill();
        return c;
    }

    async function loadSheet() {
        try {
            const [
                dinoRun1, dinoRun2, dinoJump, dinoDuck, dinoDead,
                smallCactus, largeCactus, clusterCactus,
                birdUp, birdDown,
                cloud1,
                groundImg
            ] = await Promise.all([
                loadImage('assets/dino_run1.png'),
                loadImage('assets/dino_run2.png'),
                loadImage('assets/dino_jump.png'),
                loadImage('assets/dino_duck.png'),
                loadImage('assets/dino_dead.png'),
                loadImage('assets/cactus_small.png'),
                loadImage('assets/cactus_large.png'),
                loadImage('assets/cactus_cluster.png'),
                loadImage('assets/bird_up.png'),
                loadImage('assets/bird_down.png'),
                loadImage('assets/cloud_1.png'),
                loadImage('assets/ground.png')
            ]);

            const dinoW = Math.max(dinoRun1.width, dinoRun2.width, dinoJump.width, dinoDead.width);
            const dinoH = Math.max(dinoRun1.height, dinoRun2.height, dinoJump.height, dinoDead.height);
            const duckW = dinoDuck.width;
            const duckH = dinoDuck.height;

            const birdW = Math.max(birdUp.width, birdDown.width);
            const birdH = Math.max(birdUp.height, birdDown.height);

            // Ground tiling
            const ground = document.createElement('canvas');
            ground.width = 2400;
            ground.height = groundImg.height;
            const gCtx = ground.getContext('2d');
            for (let x = 0; x < 2400; x += groundImg.width) {
                gCtx.drawImage(groundImg, x, 0);
            }

            return {
                dino: {
                    run: [dinoRun1, dinoRun2],
                    jump: dinoJump,
                    duck: [dinoDuck, dinoDuck],
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
                cloud: cloud1,
                star: makeStar(),
                moon: makeMoon(),
                ground: ground,
                restart: makeRestartIcon(),
                dagger: makeDagger(), // Added dagger for attacks
                sourceImage: null,
            };
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    return {
        loadSheet,
    };
})();
