
"use strict";

window.LSystem = (() => {

    // --------------------------------------------------
    // SEEDED RANDOM NUMBER GENERATOR
    // --------------------------------------------------

    function makeRandom(seed) {
        let state = seed >>> 0;

        return function () {
            state = (state + 0x6D2B79F5) >>> 0;

            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // --------------------------------------------------
    // MATHEMATICAL EXPRESSION PARSER
    // No eval() or arbitrary JavaScript execution.
    // --------------------------------------------------

    function evaluate(expression, variables = {}) {
        const tokens = String(expression).match(
            /(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z_]\w*|<=|>=|==|!=|&&|\|\||[+\-*/%^(),<>!]/gi
        );

        if (!tokens) {
            throw new Error("Invalid expression: " + expression);
        }

        let position = 0;

        function peek() {
            return tokens[position];
        }

        function take() {
            return tokens[position++];
        }

        function expect(value) {
            if (take() !== value) {
                throw new Error("Expected " + value);
            }
        }

        function primary() {
            const token = take();

            if (!token) {
                throw new Error("Unexpected end of expression");
            }

            if (token === "(") {
                const value = logicalOr();
                expect(")");
                return value;
            }

            if (token === "-") return -unary();
            if (token === "+") return unary();
            if (token === "!") return !unary();

            if (!isNaN(Number(token))) {
                return Number(token);
            }

            if (/^[A-Za-z_]\w*$/.test(token)) {
                const name = token.toLowerCase();

                if (peek() === "(") {
                    take();

                    const args = [];

                    if (peek() !== ")") {
                        args.push(logicalOr());

                        while (peek() === ",") {
                            take();
                            args.push(logicalOr());
                        }
                    }

                    expect(")");

                    const functions = {
                        sqrt: Math.sqrt,
                        sin: Math.sin,
                        cos: Math.cos,
                        tan: Math.tan,
                        asin: Math.asin,
                        acos: Math.acos,
                        atan: Math.atan,
                        exp: Math.exp,
                        log: Math.log,
                        abs: Math.abs,
                        floor: Math.floor,
                        ceil: Math.ceil,
                        round: Math.round,
                        min: Math.min,
                        max: Math.max,
                        pow: Math.pow
                    };

                    if (!functions[name]) {
                        throw new Error("Unknown function: " + name);
                    }

                    return functions[name](...args);
                }

                if (name === "pi") return Math.PI;
                if (name === "e") return Math.E;
                if (name === "true") return true;
                if (name === "false") return false;

                if (Object.prototype.hasOwnProperty.call(
                    variables, token
                )) {
                    return variables[token];
                }

                throw new Error("Unknown variable: " + token);
            }

            throw new Error("Unexpected token: " + token);
        }

        function unary() {
            return primary();
        }

        function power() {
            let a = unary();

            if (peek() === "^") {
                take();
                a = Math.pow(a, power());
            }

            return a;
        }

        function multiplication() {
            let a = power();

            while (["*", "/", "%"].includes(peek())) {
                const op = take();
                const b = power();

                if (op === "*") a *= b;
                if (op === "/") a /= b;
                if (op === "%") a %= b;
            }

            return a;
        }

        function addition() {
            let a = multiplication();

            while (["+", "-"].includes(peek())) {
                const op = take();
                const b = multiplication();

                a = op === "+" ? a + b : a - b;
            }

            return a;
        }

        function comparison() {
            let a = addition();

            while (["<", ">", "<=", ">=", "==", "!="].includes(peek())) {
                const op = take();
                const b = addition();

                switch (op) {
                    case "<": a = a < b; break;
                    case ">": a = a > b; break;
                    case "<=": a = a <= b; break;
                    case ">=": a = a >= b; break;
                    case "==": a = a === b; break;
                    case "!=": a = a !== b; break;
                }
            }

            return a;
        }

        function logicalAnd() {
            let a = comparison();

            while (peek() === "AND" || peek() === "&&") {
                take();
                const b = comparison();
                a = Boolean(a) && Boolean(b);
            }

            return a;
        }

        function logicalOr() {
            let a = logicalAnd();

            while (peek() === "OR" || peek() === "||") {
                take();
                const b = logicalAnd();
                a = Boolean(a) || Boolean(b);
            }

            return a;
        }

        const result = logicalOr();

        if (position !== tokens.length) {
            throw new Error("Unexpected token: " + peek());
        }

        return result;
    }

    // --------------------------------------------------
    // TOP-LEVEL SPLITTER
    // Splits commas without breaking nested expressions.
    // --------------------------------------------------

    function splitTopLevel(text, separator = ",") {
        const result = [];
        let depth = 0;
        let current = "";

        for (const char of text) {
            if (char === "(" || char === "[") depth++;
            if (char === ")" || char === "]") depth--;

            if (char === separator && depth === 0) {
                result.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }

        if (current.trim()) result.push(current.trim());

        return result;
    }

    // --------------------------------------------------
    // SYMBOL TOKENIZER
    // --------------------------------------------------

    function tokenize(source) {
        const result = [];
        let i = 0;

        while (i < source.length) {
            if (/\s/.test(source[i])) {
                i++;
                continue;
            }

            const start = i;

            if (/[A-Za-z_]/.test(source[i])) {
                i++;

                while (i < source.length &&
                       /[A-Za-z0-9_]/.test(source[i])) {
                    i++;
                }

                const name = source.slice(start, i);
                const args = [];

                if (source[i] === "(") {
                    i++;
                    let depth = 1;
                    let argStart = i;

                    while (i < source.length && depth > 0) {
                        if (source[i] === "(") depth++;
                        if (source[i] === ")") depth--;

                        if (depth === 0) {
                            const content = source.slice(argStart, i);

                            if (content.trim()) {
                                args.push(...splitTopLevel(content));
                            }

                            i++;
                            break;
                        }

                        i++;
                    }

                    if (depth !== 0) {
                        throw new Error("Unclosed parameter list");
                    }
                }

                result.push({ symbol: name, args });
            } else if ("+-[]&^\\/|!".includes(source[i])) {
                result.push({
                    symbol: source[i],
                    args: []
                });
                i++;
            } else {
                throw new Error(
                    "Invalid symbol '" + source[i] + "' at position " + i
                );
            }
        }

        return result;
    }

    // --------------------------------------------------
    // RULE PARSER
    // --------------------------------------------------

    function parsePredecessor(text) {
        const match = text.trim().match(
            /^([A-Za-z_]\w*)\s*(?:\((.*)\))?$/
        );

        if (!match) {
            throw new Error("Invalid predecessor: " + text);
        }

        return {
            symbol: match[1],
            parameters: match[2]
                ? splitTopLevel(match[2])
                : []
        };
    }

    function parseRules(lines) {
        const rules = [];

        for (const line of lines) {
            const arrow = line.indexOf("->");

            if (arrow < 0) continue;

            const left = line.slice(0, arrow).trim();
            const right = line.slice(arrow + 2).trim();

            let predecessor = left;
            let condition = null;

            const colon = left.indexOf(":");

            if (colon >= 0) {
                predecessor = left.slice(0, colon).trim();
                condition = left.slice(colon + 1).trim();
            }

            const parsed = parsePredecessor(predecessor);

            let probability = 1;
            let successor = right;

            const probabilityMatch = right.match(
                /^(\d*\.?\d+(?:e[+-]?\d+)?)\s*:\s*(.*)$/i
            );

            if (probabilityMatch) {
                probability = Number(probabilityMatch[1]);
                successor = probabilityMatch[2];
            }

            if (probability < 0 || !Number.isFinite(probability)) {
                throw new Error("Invalid probability in: " + line);
            }

            rules.push({
                ...parsed,
                condition,
                probability,
                successor,
                original: line
            });
        }

        return rules;
    }

    // --------------------------------------------------
    // CONFIGURATION PARSER
    // --------------------------------------------------

    function parse(source) {
        const config = {
            type: "deterministic",
            axiom: "F",
            iterations: 3,
            angle: 25,
            length: 10,
            startAngle: -90,
            lineWidth: 1.5,
            seed: 42,
            rules: []
        };

        const lines = source.split(/\r?\n/);
        const ruleLines = [];

        for (const rawLine of lines) {
            const line = rawLine.split("#")[0].trim();

            if (!line) continue;

            const match = line.match(/^([A-Z_]+)\s*:\s*(.*)$/);

            if (match && match[1] !== "TYPE") {
                const key = match[1];
                const value = match[2];

                switch (key) {
                    case "AXIOM":
                        config.axiom = value;
                        break;

                    case "ITERATIONS":
                        config.iterations = Number(value);
                        break;

                    case "ANGLE":
                        config.angle = Number(value);
                        break;

                    case "LENGTH":
                        config.length = Number(value);
                        break;

                    case "START_ANGLE":
                        config.startAngle = Number(value);
                        break;

                    case "LINE_WIDTH":
                        config.lineWidth = Number(value);
                        break;

                    case "SEED":
                        config.seed = Number(value);
                        break;
                }

                continue;
            }

            if (/^TYPE\s*:/i.test(line)) {
                config.type = line.split(":")[1].trim().toLowerCase();
                continue;
            }

            if (line.includes("->")) {
                ruleLines.push(line);
            }
        }

        if (!["deterministic", "stochastic",
              "parametric", "generalized"].includes(config.type)) {
            throw new Error("Unknown L-system type: " + config.type);
        }

        if (!Number.isInteger(config.iterations) ||
            config.iterations < 0 || config.iterations > 12) {
            throw new Error("ITERATIONS must be an integer from 0 to 12.");
        }

        for (const key of ["angle", "length", "startAngle", "lineWidth"]) {
            if (!Number.isFinite(config[key])) {
                throw new Error("Invalid numeric setting: " + key);
            }
        }

        if (config.length <= 0 || config.lineWidth <= 0) {
            throw new Error("LENGTH and LINE_WIDTH must be positive.");
        }

        if (!Number.isInteger(config.seed)) {
            throw new Error("SEED must be an integer.");
        }

        config.rules = parseRules(ruleLines);
        config.axiomTokens = tokenize(config.axiom);

        if (!config.rules.length && config.iterations > 0) {
            throw new Error("No production rules were defined.");
        }

        return config;
    }

    // --------------------------------------------------
    // PARAMETER MATCHING
    // --------------------------------------------------

    function bindParameters(rule, token) {
        if (rule.symbol !== token.symbol) return null;

        if (rule.parameters.length !== token.args.length) {
            if (rule.parameters.length === 0 &&
                token.args.length === 0) {
                return {};
            }

            return null;
        }

        const variables = {};

        for (let i = 0; i < rule.parameters.length; i++) {
            const name = rule.parameters[i].trim();

            if (!/^[A-Za-z_]\w*$/.test(name)) {
                throw new Error("Invalid parameter name: " + name);
            }

            variables[name] = evaluate(token.args[i]);
        }

        return variables;
    }

    // --------------------------------------------------
    // SUCCESSOR EXPANSION
    // --------------------------------------------------

    function expand(successor, variables) {
        const tokens = tokenize(successor);

        return tokens.map(token => ({
            symbol: token.symbol,
            args: token.args.map(expression => {
                const value = evaluate(expression, variables);

                if (typeof value !== "number" ||
                    !Number.isFinite(value)) {
                    throw new Error("Parameter must evaluate to a finite number.");
                }

                return String(Number(value.toPrecision(12)));
            })
        }));
    }

    // --------------------------------------------------
    // RULE SELECTION
    // --------------------------------------------------

    function chooseRule(candidates, random) {
        if (!candidates.length) return null;

        const total = candidates.reduce(
            (sum, rule) => sum + rule.probability, 0
        );

        if (total <= 0) {
            throw new Error("Production probabilities sum to zero.");
        }

        let value = random() * total;

        for (const rule of candidates) {
            value -= rule.probability;

            if (value < 0) return rule;
        }

        return candidates[candidates.length - 1];
    }

    // --------------------------------------------------
    // GENERATION ENGINE
    // --------------------------------------------------

    function generate(config) {
        const random = makeRandom(config.seed);

        const history = [config.axiomTokens];
        const selectedRules = [];

        let current = config.axiomTokens;

        for (let generation = 0;
             generation < config.iterations;
             generation++) {

            const next = [];
            const selected = [];

            for (const token of current) {
                const candidates = [];

                for (const rule of config.rules) {
                    const variables = bindParameters(rule, token);

                    if (variables === null) continue;

                    if (rule.condition) {
                        if (!evaluate(rule.condition, variables)) {
                            continue;
                        }
                    }

                    candidates.push({ rule, variables });
                }

                if (!candidates.length) {
                    next.push(token);
                    continue;
                }

                const chosen = chooseRule(
                    candidates.map(item => ({
                        ...item.rule,
                        variables: item.variables
                    })),
                    random
                );

                const replacement = expand(
                    chosen.successor,
                    chosen.variables
                );

                next.push(...replacement);

                selected.push({
                    original: chosen.original,
                    symbol: token.symbol,
                    successor: chosen.successor
                });
            }

            current = next;

            if (current.length > 500000) {
                throw new Error(
                    "Generation exceeded 500,000 symbols. Calculation stopped."
                );
            }

            history.push(current);
            selectedRules.push(selected);
        }

        return {
            config,
            history,
            selectedRules
        };
    }

    // --------------------------------------------------
    // STRING REPRESENTATION
    // --------------------------------------------------

    function stringify(tokens) {
        return tokens.map(token => {
            if (!token.args.length) return token.symbol;

            return token.symbol + "(" + token.args.join(",") + ")";
        }).join("");
    }

    return {
        parse,
        generate,
        evaluate,
        tokenize,
        stringify
    };

})();
