import { spawn } from 'node:child_process';
export const BUILTIN_AGENTS = [
    { id: 'claude', name: 'Claude Code', category: 'code', protocol: 'Anthropic Messages' },
    { id: 'codex', name: 'Codex CLI', category: 'code', protocol: 'OpenAI Responses' },
    { id: 'cline', name: 'Cline', category: 'code', protocol: 'OpenAI Chat' },
    { id: 'continue', name: 'Continue', category: 'code', protocol: 'OpenAI Chat' },
    { id: 'aider', name: 'Aider', category: 'code', protocol: 'OpenAI Chat' },
    { id: 'opencode', name: 'OpenCode', category: 'code', protocol: 'OpenAI Chat' },
    { id: 'goose', name: 'Goose', category: 'agent', protocol: 'OpenAI Chat' },
    { id: 'qwen', name: 'Qwen Code', category: 'code', protocol: 'OpenAI or Gemini' },
    { id: 'roo', name: 'Roo Code', category: 'code', protocol: 'OpenAI Chat' },
    { id: 'kilo', name: 'Kilo Code', category: 'code', protocol: 'OpenAI Chat' },
    { id: 'crush', name: 'Crush', category: 'code', protocol: 'OpenAI Chat' },
    { id: 'cursor', name: 'Cursor', category: 'code', protocol: 'OpenAI Chat' },
];
function rootUrl(url) {
    return url.trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
}
function v1Url(url) {
    return `${rootUrl(url)}/v1`;
}
export function claudeEnv(config, apiKey, model) {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    return Object.assign(env, {
        ANTHROPIC_BASE_URL: rootUrl(config.gatewayUrl),
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_MODEL: model,
        ANTHROPIC_DEFAULT_OPUS_MODEL: model,
        ANTHROPIC_DEFAULT_SONNET_MODEL: model,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
    });
}
export function codexArgs(config, model) {
    return [
        '-c', 'model_provider="freellmapi"',
        '-c', `model=${JSON.stringify(model)}`,
        '-c', 'model_providers.freellmapi.name="FreeLLMAPI"',
        '-c', `model_providers.freellmapi.base_url=${JSON.stringify(v1Url(config.gatewayUrl))}`,
        '-c', 'model_providers.freellmapi.wire_api="responses"',
        '-c', 'model_providers.freellmapi.env_key="FREELLMAPI_API_KEY"',
        '-c', 'model_providers.freellmapi.requires_openai_auth=false',
    ];
}
export function aiderArgs(config, model) {
    return [
        '--model', `openai/${model}`,
        '--openai-api-base', v1Url(config.gatewayUrl),
        '--openai-api-key', config.apiKey,
    ];
}
export function opencodeArgs(config, model) {
    return ['-m', `freellmapi/${model}`];
}
export function gooseEnv(config, model) {
    return Object.assign({ ...process.env }, {
        GOOSE_PROVIDER: 'freellmapi',
        GOOSE_MODEL: model,
        FREELLMAPI_API_KEY: config.apiKey,
    });
}
export function crushEnv(config, model) {
    return Object.assign({ ...process.env }, {
        FREELLMAPI_API_KEY: config.apiKey,
    });
}
export function launchAgent(agentId, config, extraArgs = []) {
    const apiKey = config.apiKey;
    const model = config.model;
    const isWin = process.platform === 'win32';
    switch (agentId) {
        case 'claude': {
            return spawn('claude', extraArgs, {
                stdio: 'inherit',
                shell: isWin,
                env: claudeEnv(config, apiKey, model),
            });
        }
        case 'codex': {
            return spawn('codex', [...codexArgs(config, model), ...extraArgs], {
                stdio: 'inherit',
                shell: isWin,
                env: { ...process.env, FREELLMAPI_API_KEY: apiKey },
            });
        }
        case 'aider': {
            return spawn('aider', aiderArgs(config, model).concat(extraArgs), {
                stdio: 'inherit',
                shell: isWin,
                env: { ...process.env, OPENAI_API_BASE: v1Url(config.gatewayUrl), OPENAI_API_KEY: apiKey },
            });
        }
        case 'opencode': {
            return spawn('opencode', opencodeArgs(config, model).concat(extraArgs), {
                stdio: 'inherit',
                shell: isWin,
                env: { ...process.env, FREELLMAPI_API_KEY: apiKey },
            });
        }
        case 'goose': {
            return spawn('goose', extraArgs, {
                stdio: 'inherit',
                shell: isWin,
                env: gooseEnv(config, model),
            });
        }
        case 'crush': {
            return spawn('crush', extraArgs, {
                stdio: 'inherit',
                shell: isWin,
                env: crushEnv(config, model),
            });
        }
        default: {
            const custom = config.agents[agentId];
            if (custom) {
                return spawn(custom.command, (custom.args ?? []).concat(extraArgs), {
                    stdio: 'inherit',
                    shell: isWin,
                    env: { ...process.env, ...(custom.env ?? {}) },
                });
            }
            throw new Error(`Unknown agent: ${agentId}`);
        }
    }
}
export function agentInfo(id) {
    return BUILTIN_AGENTS.find(a => a.id === id);
}
