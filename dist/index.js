#!/usr/bin/env node
import process from 'node:process';
import { AgentLoop } from './loop.js';
import { LLMClient } from './llm.js';
import { McpRegistry, mcpToolsToDefinitions } from './mcp.js';
import { loadConfig, expandConfigPaths } from './config.js';
import { discoverSkills, renderSkillPrompt, skillByName, saveLearnedSkill, synthesizeSkillFromSession, } from './skills.js';
import { BUILTIN_AGENTS, agentInfo, launchAgent } from './agents.js';
import { createSession, saveSession, loadSession, listSessions, clearSessionMessages, appendMessage, } from './session.js';
import { toolGit, toolRepoMap, toolGraphify } from './tools.js';
import { t, renderBanner, renderMarkdown, formatCodeBlock, renderToolCall, renderToolOutput, renderThinking, renderSummaryLine, askPrompt, askConfirmation, createSpinner, } from './tui.js';
import { ensureFreeLLMAPIRunning } from './freellmapi.js';
import { runSelfEvolution, renderEvolutionReport } from './evolution.js';
import { runDiagnostics, renderDoctorReport } from './doctor.js';
import { runGlobalBenchmark, renderBenchmarkReport } from './benchmark.js';
function help() {
    return [
        `${t.bold}${t.purple}SKELETOR — APEX CLI CODING AGENT${t.reset}`,
        `${t.dim}Combining the best features of Claude Code, Codex, Aider, OpenCode & Antigravity${t.reset}`,
        '',
        `${t.bold}Usage:${t.reset}`,
        '  skeletor                        Start interactive Cyberpunk TUI REPL',
        '  skeletor "do something"         One-shot prompt execution',
        '  skeletor -p "prompt"            One-shot prompt execution',
        '  skeletor --plan "..."           Run in read-only architectural planning mode',
        '  skeletor --mode <name> "..."    Run in specialized persona (code, plan, debug, review, test)',
        '  skeletor --agent <name>         Delegate to existing CLI agent (claude, codex, aider, opencode, ...)',
        '  skeletor --evolve               Hermes 2.0 self-evolution (learn from brother CLI agents)',
        '  skeletor --evolve --internet    Self-evolve with granted internet research permission',
        '  skeletor --doctor               Run system & environment health diagnostics',
        '  skeletor --benchmark            Run global coding agent benchmark vs Claude, Codex, Aider',
        '  skeletor --continuous, -c       Continuous autonomous coding mode (no step cap, non-stop loops)',
        '  skeletor --steps <n>            Maximum turn steps before synthesis (default: 50)',
        '  skeletor --read-only            Sandbox: no shell commands or file writes may run',
        '  skeletor --allow-paths a b c    Restrict Bash to these path roots (workspace-only by default)',
        '  skeletor --list-agents          List supported delegate agents',
        '  skeletor --skills               List all discovered skills',
        '  skeletor --mcp                  List MCP servers and their tools',
        '  skeletor --models               List available models from FreeLLMAPI gateway',
        '  skeletor --model <id>           Pin a model for this run',
        '  skeletor --help                 Show this help message',
        '',
        `${t.bold}Shortcuts in REPL:${t.reset}`,
        '  Shift + Tab                     Cycle personas (code ➔ plan ➔ debug ➔ review ➔ test)',
        '  /plan, /code, /debug, /review   Direct mode switching',
        '  /evolve                         Hermes 2.0 self-evolution (inspects brothers & web)',
        '  /doctor                         Run full system health & diagnostic audit',
        '  /benchmark                      Run global coding benchmark & leaderboard comparison',
        '  /steps <n>                      Adjust turn step limit dynamically',
        '  /graphify [path]                AST code graph & symbol intelligence (Context7x)',
        '',
        `${t.bold}Aliases:${t.reset} skel, ah, skeletor`,
        '',
        `${t.bold}Environment:${t.reset}`,
        '  FREELLMAPI_URL                  Gateway URL (default: http://localhost:3001)',
        '  FREELLMAPI_API_KEY              Gateway API key (auto-detected if unset)',
    ].join('\n');
}
function parseArgs(argv) {
    const result = {
        listAgents: false,
        listSkills: false,
        listMcp: false,
        listModels: false,
        help: false,
        evolve: false,
        internet: false,
        doctor: false,
        benchmark: false,
        continuous: false,
        readOnly: false,
        allowPaths: [],
    };
    const positional = [];
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h')
            result.help = true;
        else if (arg === '--agent')
            result.agent = argv[++i];
        else if (arg === '--list-agents')
            result.listAgents = true;
        else if (arg === '--skills')
            result.listSkills = true;
        else if (arg === '--mcp')
            result.listMcp = true;
        else if (arg === '--models')
            result.listModels = true;
        else if (arg === '--model')
            result.model = argv[++i];
        else if (arg === '--mode')
            result.mode = argv[++i];
        else if (arg === '--plan')
            result.mode = 'plan';
        else if (arg === '--debug')
            result.mode = 'debug';
        else if (arg === '--review')
            result.mode = 'review';
        else if (arg === '--test')
            result.mode = 'test';
        else if (arg === '--code')
            result.mode = 'code';
        else if (arg === '--evolve')
            result.evolve = true;
        else if (arg === '--internet')
            result.internet = true;
        else if (arg === '--doctor')
            result.doctor = true;
        else if (arg === '--benchmark')
            result.benchmark = true;
        else if (arg === '--continuous' || arg === '-c')
            result.continuous = true;
        else if (arg === '--read-only' || arg === '--sandbox')
            result.readOnly = true;
        else if (arg === '--allow-paths') {
            const paths = [];
            while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
                paths.push(argv[++i]);
            }
            result.allowPaths = paths;
        }
        else if (arg === '--steps' || arg === '-s') {
            const parsed = parseInt(argv[++i], 10);
            if (!isNaN(parsed) && parsed > 0)
                result.maxSteps = parsed;
        }
        else if (arg === '-p') {
            if (argv[i + 1])
                positional.push(argv[++i]);
        }
        else if (!arg.startsWith('-')) {
            positional.push(arg);
        }
    }
    if (positional.length)
        result.prompt = positional.join(' ');
    return result;
}
async function readStdin() {
    if (process.stdin.isTTY)
        return '';
    return new Promise(resolve => {
        let data = '';
        const timer = setTimeout(() => resolve(data.trim()), 200);
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => { data += chunk; });
        process.stdin.on('end', () => {
            clearTimeout(timer);
            resolve(data.trim());
        });
        process.stdin.on('error', () => {
            clearTimeout(timer);
            resolve('');
        });
    });
}
function formatMarkdownResponse(raw) {
    // Format code blocks nicely with TUI borders
    const parts = raw.split(/(```[\s\S]*?```)/g);
    return parts.map(part => {
        if (part.startsWith('```')) {
            const match = part.match(/^```(\w+)?\r?\n([\s\S]*?)```$/);
            if (match) {
                const lang = match[1] || '';
                const code = match[2];
                return formatCodeBlock(lang, code);
            }
        }
        return part;
    }).join('');
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        process.stdout.write(`${help()}\n`);
        return 0;
    }
    const config = expandConfigPaths(loadConfig());
    if (args.model)
        config.model = args.model;
    if (args.maxSteps)
        config.maxSteps = args.maxSteps;
    if (args.continuous) {
        config.continuous = true;
        config.autoApprove = true;
    }
    if (args.readOnly)
        config.readOnly = true;
    if (args.allowPaths.length)
        config.allowPaths = args.allowPaths;
    // Handle agent delegation (--agent claude, aider, etc.)
    if (args.listAgents) {
        process.stdout.write(`\n${t.bold}Supported Delegate CLI Agents:${t.reset}\n`);
        for (const agent of BUILTIN_AGENTS) {
            process.stdout.write(`  ${t.cyan}${agent.id.padEnd(12)}${t.reset} ${agent.name.padEnd(18)} [${agent.protocol}]\n`);
        }
        return 0;
    }
    // 1. Autonomous FreeLLMAPI Gateway Check & Auto-Start
    const gwSpinner = createSpinner('Connecting to FreeLLMAPI gateway...');
    gwSpinner.start();
    const gwStatus = await ensureFreeLLMAPIRunning(config.gatewayUrl, msg => {
        gwSpinner.update(msg);
    });
    if (gwStatus.key && !config.apiKey) {
        config.apiKey = gwStatus.key;
    }
    gwSpinner.stop(gwStatus.running ? 'FreeLLMAPI Gateway Online' : 'FreeLLMAPI Offline (Proceeding offline)');
    if (args.agent) {
        const info = agentInfo(args.agent);
        if (!info) {
            process.stderr.write(`${t.red}Unknown agent: ${args.agent}${t.reset}\n`);
            return 1;
        }
        process.stdout.write(`${t.dim}Launching ${info.name} configured via FreeLLMAPI gateway...${t.reset}\n`);
        const child = launchAgent(args.agent, config, []);
        return new Promise(resolve => {
            child.on('exit', code => resolve(code ?? 0));
            child.on('error', error => {
                process.stderr.write(`${t.red}Failed to launch ${args.agent}: ${error.message}${t.reset}\n`);
                resolve(1);
            });
        });
    }
    const llm = new LLMClient(config);
    // Handle listing models from FreeLLMAPI
    if (args.listModels) {
        process.stdout.write(`${t.dim}Fetching models from ${config.gatewayUrl}...${t.reset}\n`);
        const models = await llm.listModels();
        if (!models.length) {
            process.stdout.write(`${t.yellow}No models returned from gateway or authentication failed.${t.reset}\n`);
            return 1;
        }
        process.stdout.write(`\n${t.bold}Available Models (${models.length}):${t.reset}\n`);
        for (const m of models.slice(0, 50)) {
            const ctx = m.context_window ? `${Math.round(m.context_window / 1000)}k ctx` : '';
            process.stdout.write(`  ${t.cyan}${m.id.padEnd(35)}${t.reset} ${t.dim}${ctx}${t.reset}\n`);
        }
        if (models.length > 50) {
            process.stdout.write(`  ${t.dim}... and ${models.length - 50} more (use 'auto' for intelligent routing)${t.reset}\n`);
        }
        return 0;
    }
    // Skills discovery (instantaneous file scan)
    const skills = discoverSkills(config.skillsDirs);
    if (args.evolve) {
        let allowInternet = args.internet;
        if (!allowInternet && process.stdin.isTTY) {
            process.stdout.write(`\n  ${t.purple}Hermes 2.0 Self-Evolution Mode${t.reset}\n`);
            allowInternet = await askConfirmation(`  ${t.yellow}? Grant internet access for discovering external online skills? [y/N]: ${t.reset}`, false);
        }
        const evoSpinner = createSpinner('Scanning brother agents & evolving permanent skills...');
        evoSpinner.start();
        const evoResult = await runSelfEvolution(config.workspace, skills, { allowInternet });
        evoSpinner.stop('Self-evolution complete');
        renderEvolutionReport(evoResult);
        return 0;
    }
    if (args.doctor) {
        const docSpinner = createSpinner('Running system health diagnostics...');
        docSpinner.start();
        const report = await runDiagnostics(config);
        docSpinner.stop('Diagnostics complete');
        renderDoctorReport(report);
        return 0;
    }
    if (args.benchmark) {
        process.stdout.write(`\n  ${t.purple}Initiating Skeletor Global Coding Agent Benchmark...${t.reset}\n`);
        const bmSpinner = createSpinner('Executing benchmark suites (HumanEval, SWE-bench, Aider, Hermes)...');
        bmSpinner.start();
        const report = await runGlobalBenchmark(config, (caseName, passed) => {
            bmSpinner.update(`Running ${caseName}... [${passed ? 'PASS' : 'TESTING'}]`);
        });
        bmSpinner.stop('Benchmark complete');
        renderBenchmarkReport(report);
        return 0;
    }
    if (args.listSkills) {
        process.stdout.write(`\n${t.bold}Discovered Skills (${skills.length}):${t.reset}\n`);
        for (const skill of skills) {
            process.stdout.write(`  ${t.green}${skill.name.padEnd(28)}${t.reset} ${t.dim}${skill.description || 'No description'}${t.reset}\n`);
        }
        return 0;
    }
    // MCP Servers initialization
    const mcp = new McpRegistry(config.mcpServers);
    const mcpTools = await mcp.startAll();
    if (args.listMcp) {
        process.stdout.write(`\n${t.bold}Connected MCP Tools (${mcpTools.length}):${t.reset}\n`);
        for (const tool of mcpTools) {
            process.stdout.write(`  ${t.purple}[${tool.server}]${t.reset} ${tool.name.padEnd(25)} ${t.dim}${tool.description || ''}${t.reset}\n`);
        }
        await mcp.stopAll();
        return 0;
    }
    const toolDefs = mcpToolsToDefinitions(mcpTools);
    const systemPrompt = [
        'You are SKELETOR — the independent, elite CLI coding agent created by your user.',
        'You run locally on your user\'s machine connected to the FreeLLMAPI gateway.',
        'CORE IDENTITY: You are SKELETOR. You are NOT Claude, you are NOT Claude Code, and you are NOT ChatGPT. You are an independent autonomous multi-agent CLI combining the finest traits of Claude Code, Codex, Aider, OpenCode, and Antigravity into one supreme engine.',
        'Acknowledge your creator with respect and pride. Never disclaim, make corporate apologies, or refer to yourself as Claude.',
        'ENVIRONMENT: Operating System is Windows. Shell is powershell.exe. Always prefer native tools (Read, Write, Edit, LS, Glob, Grep, RepoMap) over shell commands.',
        'ACTION-ORIENTED EXECUTION: Be fast, decisive, and pragmatic. Do NOT endlessly read files or explore directories.',
        '- If asked to create a new file or feature: Immediately use Write to create the implementation and test files.',
        '- If asked to modify or fix code: Read only the target file, apply targeted changes with Edit, and run tests.',
        '- After implementing code and tests: Run the test runner (e.g. `npx vitest run <file>` or `npx tsx <file>`) using Bash, verify success, and summarize.',
        'OUTPUT FORMAT: Reply in clean, natural conversational text with clear headers and bullet points. NEVER wrap your entire reply inside a code fence (``` or ```markdown). Only use code fences for specific snippets of code.',
        'Summarize clearly what was accomplished.',
        skills.length
            ? `\nAvailable Skills (${skills.length}):\n${skills.map(s => `- ${s.name}: ${s.description || 'available'}`).join('\n')}`
            : '',
    ].filter(Boolean).join('\n');
    const loop = new AgentLoop(llm, config, mcp);
    await loop.init(systemPrompt, toolDefs);
    if (args.mode)
        loop.setMode(args.mode);
    // Check prompt from arguments or piped stdin
    const promptToRun = args.prompt || (await readStdin());
    // One-shot execution
    if (promptToRun) {
        const oneShotSpinner = createSpinner('Thinking...');
        oneShotSpinner.start();
        const oneShotStart = Date.now();
        try {
            const result = await loop.run({
                prompt: promptToRun,
                model: config.model,
                continuous: config.continuous,
                maxSteps: args.maxSteps,
                onThinking: (thought) => {
                    oneShotSpinner.stop();
                    renderThinking(thought);
                    oneShotSpinner.update('Thinking...');
                    oneShotSpinner.start();
                },
                onTool: (name, input) => {
                    oneShotSpinner.stop();
                    renderToolCall(name, input);
                    oneShotSpinner.update(`Running tool ${name}...`);
                    oneShotSpinner.start();
                },
                onToolOutput: (name, output, isError) => {
                    oneShotSpinner.stop();
                    renderToolOutput(name, output, isError);
                    oneShotSpinner.update('Synthesizing output...');
                    oneShotSpinner.start();
                },
                onRetry: (attempt, maxAttempts, delayMs, err) => {
                    oneShotSpinner.updateRetry(attempt, maxAttempts, delayMs, err);
                },
            });
            oneShotSpinner.stop();
            process.stdout.write(`\n${renderMarkdown(result.response)}\n`);
            renderSummaryLine({
                durationMs: Date.now() - oneShotStart,
                steps: result.steps,
                model: config.model,
            });
        }
        catch (err) {
            oneShotSpinner.stop();
            process.stderr.write(`\n${t.red}Error: ${err instanceof Error ? err.message : String(err)}${t.reset}\n`);
            await mcp.stopAll();
            process.exit(1);
        }
        await mcp.stopAll();
        process.exit(0);
    }
    // Interactive Crazy Good TUI REPL
    let session = createSession(config.workspace, config.model, loop.mode);
    renderBanner({
        gatewayUrl: config.gatewayUrl,
        gatewayOnline: gwStatus.running,
        model: config.model,
        mode: loop.mode,
        skillsCount: skills.length,
        mcpToolsCount: mcpTools.length,
        continuous: config.continuous,
    });
    while (true) {
        const input = await askPrompt({
            sessionId: session.id,
            mode: loop.mode,
            model: config.model,
            onCycleMode: () => {
                const cycleModes = ['code', 'plan', 'debug', 'review', 'test'];
                const currentIdx = cycleModes.indexOf(loop.mode);
                const nextMode = cycleModes[(currentIdx + 1) % cycleModes.length];
                loop.setMode(nextMode);
                session.mode = nextMode;
                saveSession(session);
                process.stdout.write(`\n  ${t.green}✓${t.reset} Mode switched to: ${t.bold}${t.purple}${nextMode.toUpperCase()}${t.reset}\n`);
            },
        });
        if (!input)
            continue;
        if (input === '/exit' || input === '/quit' || input === ':q') {
            process.stdout.write(`\n${t.purple}Skeletor session terminated. Farewell.${t.reset}\n`);
            break;
        }
        if (input.startsWith('/')) {
            const [cmd, ...rest] = input.split(/\s+/);
            switch (cmd.toLowerCase()) {
                case '/plan': {
                    loop.setMode('plan');
                    session.mode = 'plan';
                    saveSession(session);
                    process.stdout.write(`  ${t.green}✓${t.reset} Mode switched to: ${t.bold}${t.purple}PLAN (Architect Read-Only)${t.reset}\n`);
                    break;
                }
                case '/code': {
                    loop.setMode('code');
                    session.mode = 'code';
                    saveSession(session);
                    process.stdout.write(`  ${t.green}✓${t.reset} Mode switched to: ${t.bold}${t.purple}CODE${t.reset}\n`);
                    break;
                }
                case '/debug': {
                    loop.setMode('debug');
                    session.mode = 'debug';
                    saveSession(session);
                    process.stdout.write(`  ${t.green}✓${t.reset} Mode switched to: ${t.bold}${t.purple}DEBUG${t.reset}\n`);
                    break;
                }
                case '/review': {
                    loop.setMode('review');
                    session.mode = 'review';
                    saveSession(session);
                    process.stdout.write(`  ${t.green}✓${t.reset} Mode switched to: ${t.bold}${t.purple}REVIEW${t.reset}\n`);
                    break;
                }
                case '/test': {
                    loop.setMode('test');
                    session.mode = 'test';
                    saveSession(session);
                    process.stdout.write(`  ${t.green}✓${t.reset} Mode switched to: ${t.bold}${t.purple}TEST${t.reset}\n`);
                    break;
                }
                case '/learn': {
                    const customName = rest[0];
                    const lSpinner = createSpinner('Synthesizing learned skill from session...');
                    lSpinner.start();
                    const synthesized = synthesizeSkillFromSession(loop.messages, customName);
                    const saved = saveLearnedSkill(config.workspace, synthesized);
                    skills.push(saved.skill);
                    lSpinner.stop();
                    process.stdout.write(`\n  ${t.green}✓ Permanent Skill Learned (Hermes):${t.reset} ${t.bold}${saved.skill.name}${t.reset}\n`);
                    process.stdout.write(`  ${t.dim}Saved to: ${saved.path}${t.reset}\n`);
                    process.stdout.write(`  ${t.dim}Description: ${saved.skill.description}${t.reset}\n\n`);
                    break;
                }
                case '/evolve': {
                    process.stdout.write(`\n  ${t.purple}Initiating Hermes 2.0 Self-Evolution...${t.reset}\n`);
                    const allowInternet = await askConfirmation(`  ${t.yellow}? Grant internet access for discovering online skills? [y/N]: ${t.reset}`, false);
                    if (allowInternet) {
                        process.stdout.write(`  ${t.green}✓ Internet permission granted.${t.reset}\n`);
                    }
                    else {
                        process.stdout.write(`  ${t.dim}Internet permission denied. Evolving from local brother agents only.${t.reset}\n`);
                    }
                    const evoSpinner = createSpinner('Scanning brother agents & evolving permanent skills...');
                    evoSpinner.start();
                    const evoResult = await runSelfEvolution(config.workspace, skills, { allowInternet });
                    evoSpinner.stop();
                    renderEvolutionReport(evoResult);
                    // Refresh skills in memory
                    const refreshedSkills = discoverSkills(config.skillsDirs);
                    skills.length = 0;
                    skills.push(...refreshedSkills);
                    break;
                }
                case '/steps': {
                    const val = parseInt(rest[0], 10);
                    if (!isNaN(val) && val > 0) {
                        config.maxSteps = val;
                        process.stdout.write(`  ${t.green}✓${t.reset} Max steps per turn set to: ${t.bold}${config.maxSteps}${t.reset}\n`);
                    }
                    else {
                        process.stdout.write(`  ${t.dim}Current max steps: ${t.bold}${config.maxSteps || 50}${t.reset}. Usage: /steps <number>\n`);
                    }
                    break;
                }
                case '/doctor': {
                    const docSpinner = createSpinner('Running system health diagnostics...');
                    docSpinner.start();
                    const report = await runDiagnostics(config);
                    docSpinner.stop();
                    renderDoctorReport(report);
                    break;
                }
                case '/benchmark': {
                    process.stdout.write(`\n  ${t.purple}Initiating Skeletor Global Coding Agent Benchmark...${t.reset}\n`);
                    const bmSpinner = createSpinner('Executing benchmark suites (HumanEval, SWE-bench, Aider, Hermes)...');
                    bmSpinner.start();
                    const report = await runGlobalBenchmark(config, (caseName, passed) => {
                        bmSpinner.update(`Running ${caseName}... [${passed ? 'PASS' : 'TESTING'}]`);
                    });
                    bmSpinner.stop('Benchmark complete');
                    renderBenchmarkReport(report);
                    break;
                }
                case '/continuous':
                case '/c': {
                    config.continuous = !config.continuous;
                    config.autoApprove = config.continuous;
                    process.stdout.write(`  ${t.green}✓${t.reset} Continuous autonomous coding: ${config.continuous ? `${t.bold}${t.green}ENABLED (uncapped steps, auto-approvals, non-stop loops)${t.reset}` : `${t.bold}${t.yellow}DISABLED (standard 50 steps)${t.reset}`}\n`);
                    break;
                }
                case '/graphify': {
                    const target = rest.join(' ') || '.';
                    const gSpinner = createSpinner(`Analyzing code graph for ${target}...`);
                    gSpinner.start();
                    const res = await toolGraphify({ path: target }, config);
                    gSpinner.stop();
                    process.stdout.write(`\n${res.output}\n`);
                    break;
                }
                case '/mode': {
                    const mode = rest[0];
                    if (mode && ['code', 'plan', 'architect', 'debug', 'review', 'test'].includes(mode)) {
                        loop.setMode(mode);
                        session.mode = mode;
                        saveSession(session);
                        process.stdout.write(`  ${t.green}✓${t.reset} Mode switched to: ${t.bold}${t.purple}${mode.toUpperCase()}${t.reset}\n`);
                    }
                    else {
                        process.stdout.write(`  ${t.yellow}!${t.reset} Current: ${loop.mode}. Available: ${t.cyan}code, plan, debug, review, test${t.reset}\n`);
                    }
                    break;
                }
                case '/model': {
                    if (rest[0]) {
                        config.model = rest[0];
                        session.model = rest[0];
                        saveSession(session);
                        process.stdout.write(`  ${t.green}✓${t.reset} Active model set to: ${t.bold}${t.cyan}${config.model}${t.reset}\n`);
                    }
                    else {
                        process.stdout.write(`  ${t.dim}Current model: ${t.bold}${config.model}${t.reset}\n`);
                    }
                    break;
                }
                case '/models': {
                    const mSpinner = createSpinner('Querying FreeLLMAPI models...');
                    mSpinner.start();
                    const models = await llm.listModels();
                    mSpinner.stop();
                    if (!models.length) {
                        process.stdout.write(`  ${t.yellow}! Could not fetch models from gateway.${t.reset}\n`);
                    }
                    else {
                        process.stdout.write(`\n${t.bold}Available Gateway Models (${models.length}):${t.reset}\n`);
                        for (const m of models.slice(0, 30)) {
                            process.stdout.write(`  ${t.cyan}${m.id.padEnd(35)}${t.reset} ${t.dim}${m.owned_by || ''}${t.reset}\n`);
                        }
                        if (models.length > 30) {
                            process.stdout.write(`  ${t.dim}... and ${models.length - 30} more. Use /model <id> to select.${t.reset}\n`);
                        }
                    }
                    break;
                }
                case '/session': {
                    if (!rest[0]) {
                        process.stdout.write(`  ${t.yellow}Usage: /session <id>${t.reset}\n`);
                        break;
                    }
                    const loaded = loadSession(rest[0]);
                    if (loaded) {
                        session = loaded;
                        loop.setMode(loaded.mode);
                        loop.messages = loaded.messages;
                        config.model = loaded.model || config.model;
                        process.stdout.write(`  ${t.green}✓ Loaded session ${session.id.slice(0, 8)} (${session.messages.length} msgs)${t.reset}\n`);
                    }
                    else {
                        process.stdout.write(`  ${t.red}✗ Session ${rest[0]} not found${t.reset}\n`);
                    }
                    break;
                }
                case '/sessions': {
                    const all = listSessions();
                    if (!all.length) {
                        process.stdout.write(`  ${t.dim}No saved sessions found.${t.reset}\n`);
                    }
                    else {
                        process.stdout.write(`\n${t.bold}Saved Sessions:${t.reset}\n`);
                        for (const s of all) {
                            process.stdout.write(`  ${t.cyan}${s.id.slice(0, 8)}${t.reset}  ${new Date(s.updatedAt).toLocaleTimeString()}  ${t.purple}${s.mode}${t.reset}  ${s.messages.length} msgs\n`);
                        }
                    }
                    break;
                }
                case '/new': {
                    session = createSession(config.workspace, config.model, loop.mode);
                    loop.messages = [{ role: 'system', content: systemPrompt }];
                    process.stdout.write(`  ${t.green}✓ Started fresh session: ${session.id.slice(0, 8)}${t.reset}\n`);
                    break;
                }
                case '/save': {
                    saveSession(session);
                    process.stdout.write(`  ${t.green}✓ Session saved: ${session.id.slice(0, 8)}${t.reset}\n`);
                    break;
                }
                case '/clear': {
                    clearSessionMessages(session);
                    loop.messages = [{ role: 'system', content: systemPrompt }];
                    process.stdout.write(`  ${t.dim}✓ Message history cleared.${t.reset}\n`);
                    break;
                }
                case '/skills': {
                    process.stdout.write(`\n${t.bold}Discovered Skills (${skills.length}):${t.reset}\n`);
                    for (const s of skills.slice(0, 40)) {
                        process.stdout.write(`  ${t.green}${s.name.padEnd(25)}${t.reset} ${t.dim}${s.description || 'No description'}${t.reset}\n`);
                    }
                    if (skills.length > 40) {
                        process.stdout.write(`  ${t.dim}... and ${skills.length - 40} more. Use /skill <name> to inspect.${t.reset}\n`);
                    }
                    break;
                }
                case '/skill': {
                    if (!rest[0]) {
                        process.stdout.write(`  ${t.yellow}Usage: /skill <name>${t.reset}\n`);
                        break;
                    }
                    const sk = skillByName(skills, rest.join(' '));
                    if (sk) {
                        process.stdout.write(`\n${t.bold}${t.green}Skill: ${sk.name}${t.reset}\n`);
                        process.stdout.write(`${t.dim}${sk.description}${t.reset}\n\n`);
                        process.stdout.write(`${sk.content.slice(0, 1000)}\n\n`);
                        loop.messages.push({ role: 'system', content: renderSkillPrompt(sk) });
                        process.stdout.write(`  ${t.green}✓ Skill '${sk.name}' injected into session context.${t.reset}\n`);
                    }
                    else {
                        process.stdout.write(`  ${t.red}✗ Skill '${rest.join(' ')}' not found.${t.reset}\n`);
                    }
                    break;
                }
                case '/mcp': {
                    process.stdout.write(`\n${t.bold}Connected MCP Tools (${mcpTools.length}):${t.reset}\n`);
                    for (const tool of mcpTools) {
                        process.stdout.write(`  ${t.purple}[${tool.server}]${t.reset} ${tool.name.padEnd(25)} ${t.dim}${tool.description || ''}${t.reset}\n`);
                    }
                    break;
                }
                case '/tools': {
                    process.stdout.write(`\n${t.bold}Native & MCP Tools:${t.reset}\n`);
                    process.stdout.write(`  ${t.cyan}Native:${t.reset} Read, Write, Edit, Bash, Git, Glob, Grep, LS, Fetch, RepoMap\n`);
                    process.stdout.write(`  ${t.purple}MCP (${mcpTools.length}):${t.reset} ${mcpTools.map(tl => `${tl.server}__${tl.name}`).join(', ') || 'none'}\n`);
                    break;
                }
                case '/diff': {
                    const diff = await toolGit({ args: ['diff'] }, config);
                    process.stdout.write(`\n${t.bold}Git Working Tree Diff:${t.reset}\n`);
                    process.stdout.write(formatCodeBlock('diff', diff.output || '(No uncommitted changes)'));
                    break;
                }
                case '/commit': {
                    const msg = rest.join(' ') || 'Update via Skeletor';
                    await toolGit({ args: ['add', '.'] }, config);
                    const res = await toolGit({ args: ['commit', '-m', msg] }, config);
                    process.stdout.write(`  ${t.green}✓ ${res.output}${t.reset}\n`);
                    break;
                }
                case '/undo': {
                    const res = await toolGit({ args: ['checkout', '.'] }, config);
                    process.stdout.write(`  ${t.yellow}✓ Undid unstaged changes: ${res.output}${t.reset}\n`);
                    break;
                }
                case '/repomap': {
                    const map = await toolRepoMap({ path: '.' }, config);
                    process.stdout.write(`\n${map.output}\n`);
                    break;
                }
                case '/help': {
                    process.stdout.write([
                        `\n${t.bold}${t.purple}Skeletor Slash Commands:${t.reset}`,
                        `  ${t.cyan}/mode <code|architect|debug|review|test>${t.reset}  Switch agent persona`,
                        `  ${t.cyan}/model [id]${t.reset}                              Switch or show model`,
                        `  ${t.cyan}/models${t.reset}                                  List live models from FreeLLMAPI`,
                        `  ${t.cyan}/skills${t.reset}                                  List discovered skills`,
                        `  ${t.cyan}/skill <name>${t.reset}                             Inspect & activate a skill`,
                        `  ${t.cyan}/learn [name]${t.reset}                            Synthesize skill from current session`,
                        `  ${t.cyan}/evolve${t.reset}                                  Hermes 2.0 self-evolution (learn from brothers & web)`,
                        `  ${t.cyan}/doctor${t.reset}                                  Run system health & environment diagnostics`,
                        `  ${t.cyan}/benchmark${t.reset}                               Run global coding benchmark & leaderboard comparison`,
                        `  ${t.cyan}/continuous, /c${t.reset}                          Toggle uncapped continuous autonomous coding mode`,
                        `  ${t.cyan}/steps <n>${t.reset}                                Set max steps per turn`,
                        `  ${t.cyan}/mcp${t.reset}                                     List connected MCP tools`,
                        `  ${t.cyan}/tools${t.reset}                                   List all active tools`,
                        `  ${t.cyan}/diff${t.reset}                                    Show current git diff`,
                        `  ${t.cyan}/commit [msg]${t.reset}                            Stage and commit current changes`,
                        `  ${t.cyan}/undo${t.reset}                                    Discard unstaged changes`,
                        `  ${t.cyan}/repomap${t.reset}                                 View codebase hierarchy`,
                        `  ${t.cyan}/session <id>${t.reset}                             Load a saved session`,
                        `  ${t.cyan}/sessions${t.reset}                                 List saved sessions`,
                        `  ${t.cyan}/new${t.reset}                                      Start a new session`,
                        `  ${t.cyan}/clear${t.reset}                                    Clear session message history`,
                        `  ${t.cyan}/save${t.reset}                                     Save current session`,
                        `  ${t.cyan}/exit${t.reset}                                     Quit Skeletor\n`,
                    ].join('\n'));
                    break;
                }
                default:
                    process.stdout.write(`  ${t.yellow}Unknown command: ${cmd}. Type /help for options.${t.reset}\n`);
            }
            continue;
        }
        // Process user prompt through Agent Loop
        appendMessage(session, { role: 'user', content: input });
        const spin = createSpinner('Thinking...');
        spin.start();
        const turnStart = Date.now();
        try {
            const result = await loop.run({
                prompt: input,
                model: config.model,
                continuous: config.continuous,
                maxSteps: config.maxSteps,
                onThinking: (thought) => {
                    spin.stop();
                    renderThinking(thought);
                    spin.update('Thinking...');
                    spin.start();
                },
                onTool: (name, inp) => {
                    spin.stop();
                    renderToolCall(name, inp);
                    spin.update(`Running tool ${name}...`);
                    spin.start();
                },
                onToolOutput: (name, out, isError) => {
                    spin.stop();
                    renderToolOutput(name, out, isError);
                    spin.update('Synthesizing output...');
                    spin.start();
                },
                onRetry: (attempt, maxAttempts, delayMs, err) => {
                    spin.updateRetry(attempt, maxAttempts, delayMs, err);
                },
            });
            spin.stop();
            appendMessage(session, { role: 'assistant', content: result.response });
            process.stdout.write(`\n${renderMarkdown(result.response)}\n`);
            renderSummaryLine({
                durationMs: Date.now() - turnStart,
                steps: result.steps,
                model: config.model,
            });
        }
        catch (error) {
            spin.stop();
            process.stderr.write(`\n  ${t.red}Error: ${error instanceof Error ? error.message : String(error)}${t.reset}\n`);
        }
    }
    await mcp.stopAll();
    process.exit(0);
}
main().then(code => { process.exit(code); }, error => {
    process.stderr.write(`skeletor error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
