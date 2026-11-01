function isRetryableStatus(status) {
    return (status === 429 || // Too Many Requests / Rate Limit
        status === 408 || // Request Timeout
        status === 500 || // Internal Server Error
        status === 502 || // Bad Gateway
        status === 503 || // Service Unavailable
        status === 504 || // Gateway Timeout
        status === 529 // Site Overloaded (Claude / Anthropic error)
    );
}
function parseRetryAfter(response, defaultDelayMs) {
    const header = response.headers.get('retry-after');
    if (!header)
        return defaultDelayMs;
    const parsedSeconds = Number.parseFloat(header);
    if (!Number.isNaN(parsedSeconds) && parsedSeconds > 0) {
        return Math.min(30_000, Math.max(1_000, parsedSeconds * 1000));
    }
    const parsedDate = Date.parse(header);
    if (!Number.isNaN(parsedDate)) {
        const diff = parsedDate - Date.now();
        if (diff > 0)
            return Math.min(30_000, Math.max(1_000, diff));
    }
    return defaultDelayMs;
}
async function sleepWithSignal(ms, signal) {
    if (signal?.aborted)
        throw new Error('Request aborted');
    return new Promise((resolve, reject) => {
        let timer = null;
        const abortHandler = () => {
            if (timer)
                clearTimeout(timer);
            reject(new Error('Request aborted'));
        };
        if (signal)
            signal.addEventListener('abort', abortHandler, { once: true });
        timer = setTimeout(() => {
            if (signal)
                signal.removeEventListener('abort', abortHandler);
            resolve();
        }, ms);
    });
}
export class LLMClient {
    config;
    constructor(config) {
        this.config = config;
    }
    rootUrl() {
        return this.config.gatewayUrl.replace(/\/+$/, '').replace(/\/v1$/i, '');
    }
    async listModels() {
        try {
            const response = await fetch(`${this.rootUrl()}/v1/models`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                },
            });
            if (!response.ok)
                return [];
            const json = await response.json();
            return json.data || [];
        }
        catch {
            return [];
        }
    }
    async chat(messages, options = {}) {
        const primaryModel = options.model ?? this.config.model;
        const defaultFallbacks = primaryModel === 'auto'
            ? ['auto', 'qwen-2.5-coder-32b', 'deepseek-chat', 'gemini-2.0-flash']
            : [primaryModel, 'auto', 'qwen-2.5-coder-32b'];
        const modelsToTry = Array.from(new Set([
            primaryModel,
            ...(options.fallbackModels ?? defaultFallbacks),
        ])).filter(Boolean);
        const isTest = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST));
        const maxRetries = options.maxRetries ?? (isTest ? 1 : 4);
        const baseDelay = options.baseDelayMs ?? (isTest ? 20 : 1200);
        const maxDelay = options.maxDelayMs ?? (isTest ? 100 : 12000);
        let lastError = null;
        for (const currentModel of modelsToTry) {
            for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
                if (options.signal?.aborted) {
                    throw new Error('LLM request aborted by user');
                }
                const body = {
                    model: currentModel,
                    messages,
                    stream: false,
                };
                if (options.temperature !== undefined)
                    body.temperature = options.temperature;
                if (options.maxTokens !== undefined)
                    body.max_tokens = options.maxTokens;
                if (options.tools?.length)
                    body.tools = options.tools;
                let response;
                try {
                    response = await fetch(`${this.rootUrl()}/v1/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${this.config.apiKey}`,
                        },
                        body: JSON.stringify(body),
                        signal: options.signal,
                    });
                }
                catch (fetchErr) {
                    if (options.signal?.aborted)
                        throw new Error('LLM request aborted by user');
                    const err = new Error(`Connection error to LLM gateway at ${this.rootUrl()}: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
                    lastError = err;
                    if (attempt < maxRetries) {
                        const jitter = Math.random() * 500;
                        const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1) + jitter);
                        options.onRetry?.(attempt, maxRetries, Math.round(delay), err);
                        await sleepWithSignal(delay, options.signal);
                        continue;
                    }
                    break; // Try fallback model if any
                }
                if (!response.ok) {
                    const detail = (await response.text()).slice(0, 300);
                    const isRetryable = isRetryableStatus(response.status);
                    const err = new Error(`LLM request failed (HTTP ${response.status}): ${detail}`);
                    lastError = err;
                    if (isRetryable && attempt < maxRetries) {
                        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
                        const delay = Math.min(maxDelay, parseRetryAfter(response, exponentialDelay));
                        options.onRetry?.(attempt, maxRetries, Math.round(delay), err);
                        await sleepWithSignal(delay, options.signal);
                        continue;
                    }
                    break; // Not retryable or exhausted
                }
                const json = await response.json();
                const choice = json.choices?.[0];
                const message = choice?.message;
                if (!message) {
                    const err = new Error('LLM response had no choices');
                    lastError = err;
                    if (attempt < maxRetries) {
                        options.onRetry?.(attempt, maxRetries, baseDelay, err);
                        await sleepWithSignal(baseDelay, options.signal);
                        continue;
                    }
                    break;
                }
                let content = message.content ?? '';
                let thinking = message.reasoning_content || message.thinking || '';
                // Extract <think>...</think> if present in content
                const thinkTagMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
                if (thinkTagMatch) {
                    if (!thinking)
                        thinking = thinkTagMatch[1].trim();
                    content = content.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
                }
                return {
                    content,
                    thinking: thinking ? thinking.trim() : undefined,
                    toolCalls: message.tool_calls,
                    usage: json.usage
                        ? { promptTokens: json.usage.prompt_tokens, completionTokens: json.usage.completion_tokens }
                        : undefined,
                    modelUsed: currentModel,
                };
            }
        }
        throw lastError ?? new Error('LLM request failed after retries');
    }
    async *stream(messages, options = {}) {
        const model = options.model ?? this.config.model;
        const body = {
            model,
            messages,
            stream: true,
        };
        if (options.temperature !== undefined)
            body.temperature = options.temperature;
        if (options.maxTokens !== undefined)
            body.max_tokens = options.maxTokens;
        if (options.tools?.length)
            body.tools = options.tools;
        const response = await fetch(`${this.rootUrl()}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: options.signal,
        });
        if (!response.ok) {
            const detail = (await response.text()).slice(0, 200);
            throw new Error(`LLM stream failed (HTTP ${response.status}): ${detail}`);
        }
        if (!response.body)
            throw new Error('LLM stream had no body');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: '))
                    continue;
                const data = trimmed.slice(6);
                if (data === '[DONE]')
                    return;
                try {
                    const json = JSON.parse(data);
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta)
                        yield delta;
                }
                catch {
                    // Ignore partial/empty SSE payloads.
                }
            }
        }
    }
}
