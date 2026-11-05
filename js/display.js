
"use strict";

window.LSystemDisplay = (() => {

    let canvas;
    let ctx;

    let segments = [];
    let animationFrame = null;
    let currentProgress = 0;
    let speed = 50;
    let playing = false;

    let config = null;
    let bounds = null;

    function initialize(canvasElement) {
        canvas = canvasElement;
        ctx = canvas.getContext("2d");

        resize();
        window.addEventListener("resize", resize);
    }

    function resize() {
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        render(currentProgress);
    }

    function clear() {
        const rect = canvas.getBoundingClientRect();

        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.fillStyle = "#10131a";
        ctx.fillRect(0, 0, rect.width, rect.height);
    }

    // --------------------------------------------------
    // TURTLE INTERPRETER
    // --------------------------------------------------

    function interpret(tokens, settings) {
        const angleStep = settings.angle * Math.PI / 180;
        const stepLength = settings.length;

        let x = 0;
        let y = 0;
        let angle = settings.startAngle * Math.PI / 180;

        const stack = [];
        const result = [];

        let minX = 0;
        let maxX = 0;
        let minY = 0;
        let maxY = 0;

        function updateBounds() {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }

        for (const token of tokens) {
            const symbol = token.symbol;

            // Optional numerical distance:
            // F(5), f(2), etc.

            let distance = stepLength;

            if (token.args.length > 0) {
                const value = Number(token.args[0]);

                if (Number.isFinite(value)) {
                    distance *= value;
                }
            }

            switch (symbol) {

                case "F": {
                    const nx = x + Math.cos(angle) * distance;
                    const ny = y + Math.sin(angle) * distance;

                    result.push({
                        x1: x,
                        y1: y,
                        x2: nx,
                        y2: ny
                    });

                    x = nx;
                    y = ny;

                    updateBounds();
                    break;
                }

                case "f":
                    x += Math.cos(angle) * distance;
                    y += Math.sin(angle) * distance;

                    updateBounds();
                    break;

                case "+":
                case "\\":
                    angle += angleStep;
                    break;

                case "-":
                case "/":
                    angle -= angleStep;
                    break;

                case "|":
                    angle += Math.PI;
                    break;

                case "&":
                    angle += angleStep;
                    break;

                case "^":
                    angle -= angleStep;
                    break;

                case "[":
                    stack.push({ x, y, angle });
                    break;

                case "]": {
                    if (!stack.length) {
                        throw new Error(
                            "Turtle stack underflow: unmatched ]"
                        );
                    }

                    const state = stack.pop();

                    x = state.x;
                    y = state.y;
                    angle = state.angle;
                    break;
                }

                default:
                    // Non-turtle symbols are ignored.
                    break;
            }
        }

        if (stack.length) {
            throw new Error(
                "Turtle stack error: " + stack.length +
                " unclosed branch(es)"
            );
        }

        return {
            segments: result,
            bounds: { minX, maxX, minY, maxY }
        };
    }

    // --------------------------------------------------
    // CAMERA / FITTING
    // --------------------------------------------------

    function getTransform() {
        const rect = canvas.getBoundingClientRect();

        const width = rect.width;
        const height = rect.height;

        const padding = 35;

        const dx = Math.max(1, bounds.maxX - bounds.minX);
        const dy = Math.max(1, bounds.maxY - bounds.minY);

        const scale = Math.min(
            (width - padding * 2) / dx,
            (height - padding * 2) / dy
        );

        return {
            scale,
            offsetX: (width - dx * scale) / 2 - bounds.minX * scale,
            offsetY: (height - dy * scale) / 2 - bounds.minY * scale
        };
    }

    // --------------------------------------------------
    // RENDERING
    // --------------------------------------------------

    function render(progress = 1) {
        if (!canvas || !config || !bounds) return;

        clear();

        const transform = getTransform();

        const count = Math.floor(
            segments.length * Math.max(0, Math.min(1, progress))
        );

        ctx.save();

        ctx.translate(
            transform.offsetX,
            transform.offsetY
        );

        ctx.scale(
            transform.scale,
            transform.scale
        );

        ctx.lineWidth = config.lineWidth / transform.scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.strokeStyle = "#8bc7ff";

        ctx.beginPath();

        for (let i = 0; i < count; i++) {
            const s = segments[i];

            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
        }

        ctx.stroke();
        ctx.restore();

        currentProgress = progress;
    }

    // --------------------------------------------------
    // LOAD GENERATION
    // --------------------------------------------------

    function load(tokens, settings) {
        stop();

        config = settings;

        const result = interpret(tokens, settings);

        segments = result.segments;
        bounds = result.bounds;

        currentProgress = 0;
        render(0);

        return {
            segmentCount: segments.length,
            bounds
        };
    }

    // --------------------------------------------------
    // ANIMATION
    // --------------------------------------------------

    function play() {
        if (playing || !config) return;

        if (currentProgress >= 1) {
            currentProgress = 0;
        }

        playing = true;

        const start = performance.now();
        const initial = currentProgress;

        const duration = 10000 / Math.max(1, speed);

        function frame(now) {
            if (!playing) return;

            const elapsed = now - start;
            const progress = Math.min(
                1,
                initial + elapsed / duration
            );

            render(progress);

            if (progress >= 1) {
                playing = false;
                animationFrame = null;
                return;
            }

            animationFrame = requestAnimationFrame(frame);
        }

        animationFrame = requestAnimationFrame(frame);
    }

    function pause() {
        stop();
    }

    function stop() {
        playing = false;

        if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
    }

    function reset() {
        stop();
        render(0);
    }

    function setSpeed(value) {
        speed = Number(value);
    }

    function setProgress(value) {
        stop();
        render(value);
    }

    function getProgress() {
        return currentProgress;
    }

    function isPlaying() {
        return playing;
    }

    return {
        initialize,
        load,
        play,
        pause,
        stop,
        reset,
        setSpeed,
        setProgress,
        getProgress,
        isPlaying
    };

})();
