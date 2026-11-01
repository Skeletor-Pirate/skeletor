import { compactMessages } from './compaction.js';
import * as tool from './tools.js';
export const ALL_MODES = ['code', 'plan', 'debug', 'review', 'test'];
export const MODE_ICONS = {
    code: '●',
    plan: '◈',
    architect: '◈',
    debug: '▲',
    review: '■',
    test: '◆',
};
export const BUILTIN_TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'Read',
            description: 'Read the contents of a file within the workspace. Supports optional start_line and end_line for viewing slices of large files.',
            parameters: {
                type: 'object',
                properties: {
                    file_path: { type: 'string', description: 'Relative path to the file' },
                    start_line: { type: 'number', description: 'Optional 1-indexed starting line' },
                    end_line: { type: 'number', description: 'Optional 1-indexed ending line' },
                },
                required: ['file_path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'Write',
            description: 'Write complete content to a file. Creates parent directories automatically.',
            parameters: {
                type: 'object',
                properties: {
                    file_path: { type: 'string', description: 'Relative path to the file' },
                    content: { type: 'string', description: 'File contents to write' },
                },
                required: ['file_path', 'content'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'Edit',
            description: 'Replace an exact unique string (old_string) in a file with new_string. Prefer targeted edits.',
            parameters: {
                type: 'object',
                properties: {
                    file_path: { type: 'string', description: 'Relative path to the file' },
                    old_string: { type: 'string', description: 'Exact existing substring to replace' },
                    new_string: { type: 'string', description: 'Replacement string' },
                },
                required: ['file_path', 'old_string', 'new_string'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'Bash',
            description: 'Execute a command in the workspace terminal (cross-platform: PowerShell on Windows, Bash on Linux/macOS).',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The terminal command to run' },
                    timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
                },
                required: ['command'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'Git',
            description: 'Execute a git command in the workspace.',
            parameters: {
                type: 'object',
                properties: {
                    args: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Git arguments (e.g. ["status"], ["diff"], ["commit", "-m", "msg"])',
                    },
                },
                required: ['args'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'Glob',
            description: 'Find files matching a glob pattern (e.g. "**/*.ts", "src/*").',
            parameters: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'Glob pattern to search' },
                    path: { type: 'string', description: 'Optional base directory' },
                },
                required: ['pattern'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'Grep',
            description: 'Search for text or regular expressions across workspace files with line numbers.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search term or regex pattern' },
                    path: { type: 'string', description: 'Optional directory path' },
                    is_regex: { type: 'boolean', description: 'Treat query as regex (default: false)' },
                    case_sensitive: { type: 'boolean', description: 'Case sensitive search (default: false)' },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'LS',
            description: 'List files and directories in a directory.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Relative path to list (e.g. ".")' },
                },
                required: ['path'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'Fetch',
            description: 'Fetch text content from a web URL or API endpoint.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'HTTP/HTTPS URL to fetch' },
                },
                required: ['url'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'RepoMap',
            description: 'View the directory and file tree of the workspace for rapid codebase understanding.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Base path (default: ".")' },
                    max_depth: { type: 'number', description: 'Maximum tree depth (default: 3)' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'Graphify',
            description: 'AST structural code map and symbol dependency graph. Extracts functions, classes, interfaces, signatures, and cross-file dependencies without reading massive files line-by-line (Context7x token compression).',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Base directory or file path to graph (default: ".")' },
                    query: { type: 'string', description: 'Optional symbol name or query to search across codebase graph' },
                    max_depth: { type: 'number', description: 'Maximum directory depth (default: 6)' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'LearnSkill',
            description: 'Hermes-style continuous skill acquisition. Permanently records a newly discovered procedure, debugging workflow, toolchain pattern, or project-specific knowledge into a permanent SKILL.md file for future recall.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Identifier for the skill (e.g. vite-build-fix, powershell-git-submodules)' },
                    description: { type: 'string', description: 'Short summary of what this skill achieves' },
                    instructions: { type: 'string', description: 'Step-by-step instructions, commands, and rules for future sessions' },
                    tags: { type: 'array', items: { type: 'string' }, description: 'Optional classification tags' },
                },
                required: ['name', 'description', 'instructions'],
            },
        },
    },
];
function toolCallToInput(call) {
    try {
        return JSON.stringify(JSON.parse(call.function.arguments));
    }
    catch {
        return call.function.arguments;
    }
}
async function executeTool(name, input, config, mcp, mode) {
    // Plan / Architect mode read-only guard (Claude Code Plan Mode standard)
    if (mode === 'plan' || mode === 'architect') {
        if (name === 'Write' || name === 'Edit') {
            return {
                output: `[PLAN MODE ACTIVE]: File modifications (${name}) are blocked in Plan Mode. Please formulate your architectural blueprint and step-by-step implementation plan, and ask the user to switch to /code mode when ready to implement.`,
                isError: true,
            };
        }
    }
    // Support both mcp__server__tool and server__tool naming
    if (name.startsWith('mcp__') || name.includes('__')) {
        const clean = name.startsWith('mcp__') ? name.slice(5) : name;
        const parts = clean.split('__');
        const server = parts[0];
        const toolName = parts.slice(1).join('__');
        const result = await mcp.callTool(server, toolName, input);
        return { output: result.content, isError: result.isError };
    }
    switch (name) {
        case 'Read': {
            const res = await tool.toolRead(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'Write': {
            const res = await tool.toolWrite(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'Edit': {
            const res = await tool.toolEdit(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'Bash':
        case 'Bash_Exec':
        case 'Exec': {
            const res = await tool.toolBash(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'Git': {
            const res = await tool.toolGit(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'Glob': {
            const res = await tool.toolGlob(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'Grep': {
            const res = await tool.toolGrep(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'LS': {
            const res = await tool.toolLs(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'Fetch': {
            const res = await tool.toolFetch(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'RepoMap': {
            const res = await tool.toolRepoMap(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'Graphify': {
            const res = await tool.toolGraphify(input, config);
            return { output: res.output, isError: res.isError };
        }
        case 'LearnSkill': {
            const res = await tool.toolLearnSkill(input, config);
            return { output: res.output, isError: res.isError };
        }
        default:
            return { output: `Unknown tool: ${name}`, isError: true };
    }
}
export const MODE_PROMPTS = {
    code: 'You are SKELETOR in CODE MODE — the apex autonomous CLI coding engine. Environment: Windows (powershell.exe). Use native tools (Read, Write, Edit, LS, Glob, Grep) directly. Do NOT endlessly read files. Create or update code decisively, verify with tests, and ship clean solutions.',
    plan: 'You are SKELETOR in PLAN MODE (Architect Mode). You are in READ-ONLY analysis and planning mode. Inspect the codebase, analyze dependencies, map out architecture, and output a comprehensive Markdown blueprint and step-by-step implementation plan before touching code. DO NOT attempt to write or edit files in this mode.',
    architect: 'You are SKELETOR in PLAN MODE (Architect Mode). You are in READ-ONLY analysis and planning mode. Inspect the codebase, analyze dependencies, map out architecture, and output a comprehensive Markdown blueprint and step-by-step implementation plan before touching code. DO NOT attempt to write or edit files in this mode.',
    debug: 'You are SKELETOR in DEBUG MODE — elite software detective. Form clean testable hypotheses, reproduce defects using targeted commands or tests, and fix root causes directly. Never apply superficial symptom patches.',
    review: 'You are SKELETOR in REVIEW MODE — principal security and code quality auditor. Review code for OWASP security vulnerabilities, memory/resource leaks, algorithmic bottlenecks, and architectural debt with clear severity rankings.',
    test: 'You are SKELETOR in TEST MODE — test automation engineer. Design comprehensive unit and integration test suites, mock external boundaries cleanly, verify edge cases, and eliminate regressions.',
};
export class AgentLoop {
    llm;
    config;
    mcp;
    messages = [];
    tools = [];
    toolCalls = [];
    mode = 'code';
    baseSystemPrompt = '';
    constructor(llm, config, mcp) {
        this.llm = llm;
        this.config = config;
        this.mcp = mcp;
    }
    async init(systemPrompt, externalTools = []) {
        this.baseSystemPrompt = systemPrompt;
        this.messages = [{ role: 'system', content: `${systemPrompt}\n\n[Active Persona]: ${MODE_PROMPTS[this.mode]}` }];
        this.tools = [...BUILTIN_TOOL_DEFINITIONS, ...externalTools];
    }
    setMode(mode) {
        this.mode = mode;
        if (this.messages.length > 0) {
            this.messages[0] = {
                role: 'system',
                content: `${this.baseSystemPrompt}\n\n[Active Persona]: ${MODE_PROMPTS[mode]}`,
            };
        }
    }
    async run(options) {
        this.messages.push({ role: 'user', content: options.prompt });
        const isContinuous = options.continuous ?? this.config.continuous ?? false;
        const maxSteps = isContinuous ? (options.maxSteps ?? Number.MAX_SAFE_INTEGER) : (options.maxSteps ?? this.config.maxSteps ?? 50);
        const maxTokens = options.maxTokens ?? 100_000;
        if (isContinuous) {
            this.messages.push({
                role: 'system',
                content: '[CONTINUOUS MODE ENGAGED]: You have UNLIMITED, UNCAPPED steps and full autonomous execution authority. Continuously inspect, write, edit, and execute terminal commands. Do NOT stop midway or ask the user for confirmation. If any terminal command, test, or build fails, immediately inspect the error, apply a fix with Edit/Write, and re-run the verification command until 100% passing.',
            });
        }
        for (let step = 0; step < maxSteps; step += 1) {
            if (options.signal?.aborted) {
                throw new Error('Agent loop aborted');
            }
            // Compact context if it grows too large
            const compacted = compactMessages(this.messages, maxTokens);
            if (compacted.removed > 0) {
                this.messages = compacted.messages;
            }
            const response = await this.llm.chat(this.messages, {
                model: options.model,
                tools: this.tools.length ? this.tools : undefined,
                signal: options.signal,
                onRetry: options.onRetry,
            });
            if (response.thinking) {
                options.onThinking?.(response.thinking);
            }
            if (response.toolCalls?.length) {
                const assistantMessage = {
                    role: 'assistant',
                    content: response.content || '',
                    tool_calls: response.toolCalls,
                };
                this.messages.push(assistantMessage);
                for (const call of response.toolCalls) {
                    let input = {};
                    try {
                        input = JSON.parse(call.function.arguments);
                    }
                    catch {
                        input = { raw: call.function.arguments };
                    }
                    const inputStr = toolCallToInput(call);
                    options.onTool?.(call.function.name, inputStr);
                    const toolRes = await executeTool(call.function.name, input, this.config, this.mcp, this.mode);
                    options.onToolOutput?.(call.function.name, toolRes.output, toolRes.isError);
                    this.toolCalls.push({ name: call.function.name, input: inputStr, output: toolRes.output });
                    this.messages.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: toolRes.output.slice(0, 15_000),
                    });
                }
                // Anti-procrastination: detect repetitive exploration loops without any edits/writes
                const readOnlyTools = ['Read', 'LS', 'Glob', 'Grep', 'RepoMap', 'Bash'];
                const recentToolCalls = this.toolCalls.slice(-5);
                const hasWritten = this.toolCalls.some(c => c.name === 'Write' || c.name === 'Edit');
                const isExploringTooLong = recentToolCalls.length >= 4 && recentToolCalls.every(c => readOnlyTools.includes(c.name));
                if (isExploringTooLong && !hasWritten && step >= 4) {
                    this.messages.push({
                        role: 'user',
                        content: '[SYSTEM GUIDANCE]: You have completed file reconnaissance. DO NOT perform any more read or search calls. Immediately create or edit the necessary code files using the Write or Edit tool, then run the tests to verify.',
                    });
                }
                // Loop breaker: catch identical consecutive tool calls
                if (this.toolCalls.length >= 3) {
                    const l1 = this.toolCalls[this.toolCalls.length - 1];
                    const l2 = this.toolCalls[this.toolCalls.length - 2];
                    const l3 = this.toolCalls[this.toolCalls.length - 3];
                    if (l1.name === l2.name && l2.name === l3.name && l1.input === l2.input && l2.input === l3.input) {
                        this.messages.push({
                            role: 'user',
                            content: `[LOOP BREAKER]: You executed ${l1.name} with identical arguments 3 times consecutively. Cease repeating this action. Try an alternative approach or report your conclusions directly to the user.`,
                        });
                    }
                }
                // Approaching step limit warning (only in capped mode)
                if (!isContinuous && step >= maxSteps - 3) {
                    this.messages.push({
                        role: 'user',
                        content: `[STEP LIMIT NOTICE]: You have reached step ${step + 1} of ${maxSteps}. Do not execute further exploratory tool calls. Immediately return your synthesized response and conclusions to the user.`,
                    });
                }
                // Continuous mode: auto-prompt to self-correct on test/build failures
                if (isContinuous && step < maxSteps - 1) {
                    const lastCall = this.toolCalls[this.toolCalls.length - 1];
                    const hasError = lastCall && (lastCall.output.includes('FAIL') ||
                        lastCall.output.includes('error TS') ||
                        lastCall.output.includes('Error:') ||
                        lastCall.output.includes('Command failed') ||
                        lastCall.output.includes('npm ERR!') ||
                        lastCall.output.includes('AssertionError') ||
                        lastCall.output.includes('SyntaxError') ||
                        lastCall.output.includes('ReferenceError') ||
                        lastCall.output.includes('TypeError'));
                    if (hasError) {
                        this.messages.push({
                            role: 'user',
                            content: '[CONTINUOUS AUTONOMOUS MODE]: A failure or error was detected in the terminal/tool execution. Do NOT stop, pause, or ask the user. Analyze the error above, use Edit or Write to fix the code, and re-run the verification command until 100% passing.',
                        });
                    }
                }
                continue;
            }
            // No tool calls produced in this turn: check if an unresolved error requires remediation before stopping
            if (isContinuous && step < maxSteps - 1) {
                const lastCall = this.toolCalls[this.toolCalls.length - 1];
                const hasUnresolvedError = lastCall && (lastCall.output.includes('FAIL') ||
                    lastCall.output.includes('error TS') ||
                    lastCall.output.includes('Error:') ||
                    lastCall.output.includes('Command failed') ||
                    lastCall.output.includes('npm ERR!') ||
                    lastCall.output.includes('AssertionError') ||
                    lastCall.output.includes('SyntaxError') ||
                    lastCall.output.includes('ReferenceError') ||
                    lastCall.output.includes('TypeError'));
                if (hasUnresolvedError) {
                    this.messages.push({
                        role: 'assistant',
                        content: response.content || 'Resolving terminal/test error...',
                    });
                    this.messages.push({
                        role: 'user',
                        content: '[CONTINUOUS AUTONOMOUS MODE]: A terminal or build error is still unresolved. Do NOT stop. Immediately call Edit or Write to fix the code, then run the tests to verify.',
                    });
                    continue;
                }
            }
            // No tool calls and clean state — final answer
            if (options.onToken) {
                for (const token of response.content.split(/(\s+)/)) {
                    if (token)
                        options.onToken(token);
                }
            }
            return { response: response.content, thinking: response.thinking, steps: step + 1, toolCalls: this.toolCalls };
        }
        // Graceful step limit exhaustion: synthesize what was accomplished instead of crashing
        try {
            const finalSynthesis = await this.llm.chat(this.messages, {
                model: options.model,
                signal: options.signal,
            });
            return {
                response: `${finalSynthesis.content}\n\n[Turn step limit reached (${maxSteps} steps). Type your next instruction to continue.]`,
                thinking: finalSynthesis.thinking,
                steps: maxSteps,
                toolCalls: this.toolCalls,
            };
        }
        catch {
            return {
                response: `[Turn step limit reached (${maxSteps} steps). ${this.toolCalls.length} tool actions were performed. Type your next instruction to continue.]`,
                steps: maxSteps,
                toolCalls: this.toolCalls,
            };
        }
    }
}
