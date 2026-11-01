import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export class McpClient {
    name;
    config;
    process = null;
    nextId = 1;
    pending = new Map();
    tools = [];
    rl = null;
    constructor(name, config) {
        this.name = name;
        this.config = config;
    }
    async start() {
        // 1. If HTTP or SSE transport is specified, connect via HTTP JSON-RPC
        if (this.config.url || this.config.transport === 'http' || this.config.transport === 'sse') {
            await this.startHttp();
            return;
        }
        // 2. Otherwise start stdio process
        if (!this.config.command) {
            throw new Error(`MCP server ${this.name} has neither command nor url defined`);
        }
        const isWin = process.platform === 'win32';
        const commandToRun = isWin
            ? [this.config.command, ...(this.config.args ?? [])].map(a => a.includes(' ') ? `"${a}"` : a).join(' ')
            : this.config.command;
        const proc = isWin
            ? spawn(commandToRun, {
                env: { ...process.env, ...(this.config.env ?? {}) },
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: true,
            })
            : spawn(this.config.command, this.config.args ?? [], {
                env: { ...process.env, ...(this.config.env ?? {}) },
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        this.process = proc;
        this.rl = createInterface({ input: proc.stdout });
        proc.stderr?.on('data', (data) => {
            // Diagnostic output from MCP server
            const msg = data.toString().trim();
            if (process.env.DEBUG_MCP) {
                process.stderr.write(`[mcp:${this.name}] ${msg}\n`);
            }
        });
        proc.on('exit', () => {
            for (const { reject } of this.pending.values()) {
                reject(new Error(`MCP server ${this.name} exited`));
            }
            this.pending.clear();
        });
        this.rl.on('line', (line) => {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('{'))
                return;
            try {
                const msg = JSON.parse(trimmed);
                if (msg.id === undefined || msg.id === null)
                    return;
                const entry = this.pending.get(Number(msg.id));
                if (!entry)
                    return;
                this.pending.delete(Number(msg.id));
                if (msg.error) {
                    entry.reject(new Error(msg.error.message));
                }
                else {
                    entry.resolve(msg.result);
                }
            }
            catch {
                // Ignore non-JSON lines.
            }
        });
        // Initialize MCP session
        await this.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'agenthub', version: '1.0.0' },
        });
        try {
            await this.request('notifications/initialized', {});
        }
        catch {
            // Non-fatal if server does not require initialized notification
        }
        const result = (await this.request('tools/list', {}));
        this.tools = result?.tools ?? [];
    }
    async startHttp() {
        const url = this.config.url;
        const headers = {
            'Content-Type': 'application/json',
            ...(this.config.headers ?? {}),
        };
        // Send initialize request via HTTP
        const initRes = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: this.nextId++,
                method: 'initialize',
                params: {
                    protocolVersion: '2025-06-18',
                    capabilities: {},
                    clientInfo: { name: 'agenthub', version: '1.0.0' },
                },
            }),
        });
        if (!initRes.ok) {
            throw new Error(`HTTP MCP initialize failed: ${initRes.status} ${initRes.statusText}`);
        }
        // Fetch tool list
        const toolsRes = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: this.nextId++,
                method: 'tools/list',
                params: {},
            }),
        });
        if (toolsRes.ok) {
            const data = await toolsRes.json();
            this.tools = data?.result?.tools ?? [];
        }
    }
    request(method, params) {
        if (this.config.url) {
            return this.requestHttp(method, params);
        }
        return new Promise((resolve, reject) => {
            if (!this.process?.stdin) {
                reject(new Error(`MCP server ${this.name} not started`));
                return;
            }
            const id = this.nextId++;
            const req = { jsonrpc: '2.0', id, method, params };
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`MCP server ${this.name} timed out on method ${method}`));
            }, 30_000);
            this.pending.set(id, {
                resolve: val => {
                    clearTimeout(timer);
                    resolve(val);
                },
                reject: err => {
                    clearTimeout(timer);
                    reject(err);
                },
            });
            this.process.stdin.write(`${JSON.stringify(req)}\n`);
        });
    }
    async requestHttp(method, params) {
        const res = await fetch(this.config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.config.headers ?? {}),
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: this.nextId++,
                method,
                params,
            }),
        });
        if (!res.ok) {
            throw new Error(`HTTP MCP request error: ${res.status}`);
        }
        const data = await res.json();
        if (data.error)
            throw new Error(data.error.message);
        return data.result;
    }
    listTools() {
        return this.tools;
    }
    async callTool(toolName, args) {
        try {
            const result = (await this.request('tools/call', {
                name: toolName,
                arguments: args,
            }));
            const text = (result?.content ?? [])
                .map(c => (typeof c.text === 'string' ? c.text : JSON.stringify(c)))
                .join('\n');
            return { content: text || 'Tool call completed without output.', isError: result?.isError };
        }
        catch (err) {
            return {
                content: `MCP error calling ${toolName}: ${err instanceof Error ? err.message : String(err)}`,
                isError: true,
            };
        }
    }
    async stop() {
        this.pending.forEach((_, id) => this.pending.get(id)?.reject(new Error('MCP client stopped')));
        this.pending.clear();
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
        if (this.process) {
            const proc = this.process;
            this.process = null;
            try {
                proc.stdin?.end();
                proc.stdout?.destroy();
                proc.stderr?.destroy();
                if (process.platform === 'win32' && proc.pid) {
                    try {
                        spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
                    }
                    catch {
                        proc.kill();
                    }
                }
                else {
                    proc.kill('SIGTERM');
                }
            }
            catch {
                // Ignore kill errors
            }
        }
    }
}
export class McpRegistry {
    servers;
    clients = new Map();
    constructor(servers) {
        this.servers = servers;
    }
    async startAll(timeoutMs = 6000) {
        const tools = [];
        const promises = Object.entries(this.servers).map(async ([name, config]) => {
            const client = new McpClient(name, config);
            try {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`MCP server ${name} start timed out (${timeoutMs}ms)`)), timeoutMs));
                await Promise.race([client.start(), timeoutPromise]);
                this.clients.set(name, client);
                return client.listTools().map(tool => ({ ...tool, server: name }));
            }
            catch (error) {
                if (process.env.DEBUG_MCP) {
                    process.stderr.write(`[mcp] failed to start ${name}: ${error instanceof Error ? error.message : String(error)}\n`);
                }
                return [];
            }
        });
        const results = await Promise.allSettled(promises);
        for (const r of results) {
            if (r.status === 'fulfilled') {
                tools.push(...r.value);
            }
        }
        return tools;
    }
    getTools() {
        const tools = [];
        for (const client of this.clients.values()) {
            for (const tool of client.listTools()) {
                tools.push({ ...tool, server: client.name });
            }
        }
        return tools;
    }
    async callTool(server, toolName, args) {
        const client = this.clients.get(server);
        if (!client)
            throw new Error(`MCP server '${server}' is not running or not found`);
        return client.callTool(toolName, args);
    }
    async stopAll() {
        for (const client of this.clients.values()) {
            await client.stop();
        }
        this.clients.clear();
    }
}
export function mcpToolsToDefinitions(tools) {
    return tools.map(t => ({
        type: 'function',
        function: {
            name: `mcp__${t.server}__${t.name}`,
            description: t.description || `${t.server} tool`,
            parameters: t.inputSchema ?? { type: 'object', properties: {} },
        },
    }));
}
