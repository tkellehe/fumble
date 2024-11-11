(async () => {
    // Function to initialize and get the engine
    async function initializeEngine(model, temperature = 0.8, top_p = 1, max_tokens = 300, onLoadingCallback) {
        const engineName = `${model}-${temperature}-${top_p}-${max_tokens}`;
        if (window[engineName]) {
            return window[engineName];
        }

        try {
            const webllm = await import("https://esm.run/@mlc-ai/web-llm");
            const engine = new webllm.MLCEngine();
            engine.setInitProgressCallback((report) => {
                console.log("Initializing:", report.progress);
                if (onLoadingCallback) {
                    onLoadingCallback(report.text);
                }
            });

            const config = { temperature, top_p, max_tokens };
            await engine.reload(model, config);
            console.log('Model loaded successfully');
            window[engineName] = engine;
            return engine;
        } catch (error) {
            console.error('Error loading model:', error);
            return null;
        }
    }

    // Function to get streaming response from the engine
    async function fetchStreamingResponse(engine, systemMessage, userMessage, onSummarizingCallback) {
        const messages = [
            { content: systemMessage, role: "system" },
            { content: userMessage, role: "user" },
        ];

        console.log("Messages:", messages);

        const chunks = await engine.chat.completions.create({
            messages,
            stream: true,
            stream_options: { include_usage: true },
        });

        for await (const chunk of chunks) {
            const chunkContent = chunk.choices[0]?.delta?.content || "";
            if (onSummarizingCallback) {
                await onSummarizingCallback(chunkContent);
            }
            if (chunk.usage) {
                console.log("Usage:", chunk.usage);
            }
        }

        const fullReply = await engine.getMessage();
        console.log("Full Reply:", fullReply);

        return fullReply;
    }

    const DEFAULT_MODEL = "Qwen2.5-Coder-7B-Instruct-q4f32_1-MLC";
    const DEFAULT_TEMPERATURE = 0.1;
    const DEFAULT_TOP_P = 1;
    const DEFAULT_MAX_TOKENS = 1000;

    // Find all divs with class "fumble-v0"
    const terminalDivs = document.querySelectorAll('.fumble-v0');

    // Create a terminal in each div
    terminalDivs.forEach(async (terminalDiv) => {
        terminalDiv.innerHTML = '';

        // Create input field
        const inputElement = document.createElement('input');
        inputElement.style.cssText = `
            font-family: monospace;
            border: 1px solid black;
            padding: 5px;
            color: white;
            background-color: black;
            width: 100%;
            box-sizing: border-box;
            margin: 0;
            display: block;
            overflow: auto;
            height: 100px;
            overflow-y: scroll;
            overflow-x: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
            resize: both;
            outline: none;
        `;
        inputElement.placeholder = "Type here...";
        terminalDiv.appendChild(inputElement);

        // Create output display div
        const outputElement = document.createElement('div');
        outputElement.style.cssText = `
            font-family: monospace;
            border: 1px solid black;
            padding: 5px;
            color: white;
            background-color: black;
            width: 100%;
            box-sizing: border-box;
            margin: 0;
            display: block;
            overflow: auto;
            height: 200px;
            overflow-y: scroll;
            overflow-x: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
        `;
        terminalDiv.appendChild(outputElement);

        // Get code from the "code" attribute of the div
        const code = terminalDiv.getAttribute('code') || 'P?Hlo Wrld';
        inputElement.value = code;

        const prompt = `You are an AI assistant that writes JavaScript code. You translate input text from the provided instructions below into JavaScript code.
Remember you only need to return the JavaScript code that can be executed in the browser.

Instructions are characters that indicate actions and context that must be translated into JavaScript code:

- "P" indicates to print something within the context of the code by calling the \`printme\` function.
- "#" followed by a number or in context of a number means to assign the context as a number.
- "+" implies something to be added or concatenated in the context.
- "-" implies something to be subtracted or removed from the context.
- "@" import a list of some kind to be constructed from the context.
- "?" implies to construct a string of some kind by reading the context and giving it a best guess from the code to be written to the context. This could grab to the end of the code block or to another context beginner like this.
   - \`?Hlo Wrld\` would be translated to \`"Hello World"\`.
`;

        const engine = await initializeEngine(DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_TOP_P, DEFAULT_MAX_TOKENS, (text) => {
            outputElement.innerHTML = text;
        });

        window.printme = (text) => {
            outputElement.innerHTML += text;
        }

        // Create execute button
        const executeButton = document.createElement('button');
        executeButton.innerHTML = 'Execute';
        terminalDiv.appendChild(executeButton);

        // Function to execute the code
        async function executeCode() {
            const code = inputElement.value;
            const output = await fetchStreamingResponse(engine, prompt, code, (text) => {
                outputElement.innerHTML += text;
            });

            console.log("Output:", output);

            // Extract JavaScript code from the output
            const cleanedOutput = output.match(/
