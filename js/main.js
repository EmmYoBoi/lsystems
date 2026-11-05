
"use strict";

document.addEventListener("DOMContentLoaded", () => {

    // --------------------------------------------------
    // ELEMENTS
    // --------------------------------------------------

    const canvas = document.getElementById("canvas");
    const editor = document.getElementById("rulesEditor");
    const log = document.getElementById("log");

    const generationLabel =
        document.getElementById("generationLabel");

    const symbolCount =
        document.getElementById("symbolCount");

    const fileStatus =
        document.getElementById("fileStatus");

    const generationInput =
        document.getElementById("generationInput");

    const speedInput =
        document.getElementById("speedInput");

    const progressBar =
        document.getElementById("progressBar");

    const playBtn = document.getElementById("playBtn");
    const previousBtn = document.getElementById("previousBtn");
    const nextBtn = document.getElementById("nextBtn");
    const resetBtn = document.getElementById("resetBtn");

    const loadBtn = document.getElementById("loadBtn");
    const applyBtn = document.getElementById("applyBtn");
    const saveBtn = document.getElementById("saveBtn");
    const fileInput = document.getElementById("fileInput");

    // --------------------------------------------------
    // APPLICATION STATE
    // --------------------------------------------------

    let result = null;
    let currentGeneration = 0;

    LSystemDisplay.initialize(canvas);
    LSystemDisplay.setSpeed(speedInput.value);

    // --------------------------------------------------
    // LOGGING
    // --------------------------------------------------

    function writeLog(message, type = "") {
        const line = document.createElement("div");

        if (type) {
            line.className = "log-" + type;
        }

        line.textContent = message;
        log.appendChild(line);

        log.scrollTop = log.scrollHeight;
    }

    function clearLog() {
        log.replaceChildren();
    }

    // --------------------------------------------------
    // LOAD A GENERATION
    // --------------------------------------------------

    function showGeneration(index) {
        if (!result) return;

        currentGeneration = Math.max(
            0,
            Math.min(index, result.history.length - 1)
        );

        const tokens = result.history[currentGeneration];

        const string = LSystem.stringify(tokens);

        const info = LSystemDisplay.load(
            tokens,
            result.config
        );

        generationLabel.textContent =
            "Generation " + currentGeneration;

        symbolCount.textContent =
            tokens.length.toLocaleString() + " symbols";

        generationInput.value = currentGeneration;

        progressBar.style.width = "0%";

        // Update the development log.

        clearLog();

        writeLog(
            "GENERATION " + currentGeneration,
            "success"
        );

        writeLog("--------------------------------");

        writeLog("System type: " + result.config.type);
        writeLog("Symbols: " + tokens.length);
        writeLog("Drawing segments: " + info.segmentCount);

        writeLog("");
        writeLog("CURRENT STRING:");

        // Avoid flooding the interface with huge strings.
        const displayString = string.length > 5000
            ? string.slice(0, 5000) +
              "\n... (truncated in display)"
            : string;

        writeLog(displayString);

        if (currentGeneration > 0) {
            const selected =
                result.selectedRules[currentGeneration - 1];

            writeLog("");
            writeLog("REWRITING:");

            writeLog(
                selected.length + " production applications."
            );

            // Display a few applied rules.
            selected.slice(0, 20).forEach(item => {
                writeLog(
                    item.symbol + " -> " + item.successor
                );
            });

            if (selected.length > 20) {
                writeLog("... additional rules omitted.");
            }
        }

        writeLog("");
        writeLog("Interpretation ready.");
    }

    // --------------------------------------------------
    // CALCULATE SYSTEM
    // --------------------------------------------------

    function calculate() {
        try {
            LSystemDisplay.stop();

            clearLog();

            writeLog("Parsing system definition...");

            const config = LSystem.parse(editor.value);

            writeLog("Configuration validated.", "success");
            writeLog("Generating system...");

            result = LSystem.generate(config);

            currentGeneration = 0;

            generationInput.max = config.iterations;

            showGeneration(0);

            writeLog("");
            writeLog("CALCULATION COMPLETE", "success");

            writeLog(
                result.history.length + " generations calculated."
            );

            writeLog(
                "Final generation: " +
                result.history[result.history.length - 1].length +
                " symbols."
            );

            fileStatus.textContent = "System loaded";

        } catch (error) {
            result = null;

            LSystemDisplay.stop();

            clearLog();

            writeLog("ERROR: " + error.message, "error");

            fileStatus.textContent = "Invalid system";
            generationLabel.textContent = "No generation";
            symbolCount.textContent = "0 symbols";
        }
    }

    // --------------------------------------------------
    // GENERATION NAVIGATION
    // --------------------------------------------------

    nextBtn.addEventListener("click", () => {
        if (result) {
            showGeneration(currentGeneration + 1);
        }
    });

    previousBtn.addEventListener("click", () => {
        if (result) {
            showGeneration(currentGeneration - 1);
        }
    });

    generationInput.addEventListener("input", () => {
        if (result) {
            showGeneration(Number(generationInput.value));
        }
    });

    // --------------------------------------------------
    // TURTLE ANIMATION
    // --------------------------------------------------

    playBtn.addEventListener("click", () => {
        if (!result) return;

        if (LSystemDisplay.isPlaying()) {
            LSystemDisplay.pause();
            playBtn.textContent = "▶ Play";
        } else {
            LSystemDisplay.play();
            playBtn.textContent = "Ⅱ Pause";
        }
    });

    resetBtn.addEventListener("click", () => {
        if (!result) return;

        LSystemDisplay.reset();
        playBtn.textContent = "▶ Play";
        progressBar.style.width = "0%";
    });

    speedInput.addEventListener("input", () => {
        LSystemDisplay.setSpeed(speedInput.value);
    });

    // --------------------------------------------------
    // ANIMATION PROGRESS MONITOR
    // --------------------------------------------------

    function updateProgress() {
        if (result) {
            const progress = LSystemDisplay.getProgress();

            progressBar.style.width =
                (progress * 100) + "%";

            if (!LSystemDisplay.isPlaying()) {
                playBtn.textContent = "▶ Play";
            }
        }

        requestAnimationFrame(updateProgress);
    }

    requestAnimationFrame(updateProgress);

    // --------------------------------------------------
    // LOAD TXT FILE
    // --------------------------------------------------

    loadBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", event => {
        const file = event.target.files[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            editor.value = reader.result;

            fileStatus.textContent = file.name;

            writeLog("Loaded: " + file.name, "success");

            calculate();
        };

        reader.onerror = () => {
            writeLog("Could not read selected file.", "error");
        };

        reader.readAsText(file);

        // Allow selecting the same file again.
        fileInput.value = "";
    });

    // --------------------------------------------------
    // EXPORT TXT FILE
    // --------------------------------------------------

    saveBtn.addEventListener("click", () => {
        const blob = new Blob(
            [editor.value],
            { type: "text/plain;charset=utf-8" }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = "rules.txt";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    });

    // --------------------------------------------------
    // APPLY CHANGES
    // --------------------------------------------------

    applyBtn.addEventListener("click", calculate);

    // --------------------------------------------------
    // AUTOMATIC INITIAL FILE LOADING
    // --------------------------------------------------

    async function initialize() {
        try {
            const response = await fetch("./rules.txt");

            if (!response.ok) {
                throw new Error("rules.txt not found");
            }

            editor.value = await response.text();

            fileStatus.textContent = "rules.txt";

            calculate();

        } catch (error) {
            fileStatus.textContent = "No default file";

            writeLog(
                "Select rules.txt manually or write a system in the editor.",
                "error"
            );
        }
    }

    initialize();

});
