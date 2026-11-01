import path from 'node:path';
const DEFAULT_CONFIRM = [
    /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f?\b/, // rm -rf / rm -fr
    /\bkill\b|\bpkill\b|\bkillall\b/, // process termination
    /\bgit\s+push\b/, // push to remote
    /\bgit\s+reset\s+--hard\b/, // destructive reset
    /\bshutdown\b|\breboot\b|\bpoweroff\b/, // machine control
    /\bformat\b|\bmkfs\b/, // filesystem formatting
    /\bchmod\s+777\b|\bchown\s+/, // permission escalation
];
const DEFAULT_BLOCK = [
    /\brm\s+-rf\s+\/(\s|$)/, // rm -rf /
    /\brm\s+-rf\s+\/\*/, // rm -rf /*
    /\bmkfs\b|\bdd\s+if=/, // disk imaging
    /\b(curl|wget)\b[^\n]*\|\s*(bash|sh|zsh|python|perl)/, // curl-to-shell
    /\beval\b|\bexec\b(?!\s+git)/, // dynamic code execution
];
/**
 * Classify a shell command against the sandbox rules.
 * Order matters: block patterns win, then confirm, then allow.
 */
export function classifyCommand(command, config) {
    const trimmed = command.trim();
    if (!trimmed) {
        return { decision: 'allow', reason: 'Empty command' };
    }
    if (config.readOnly) {
        return {
            decision: 'block',
            reason: 'Agent is running in read-only mode. No commands may be executed.',
        };
    }
    for (const re of config.blockPatterns) {
        if (re.test(trimmed)) {
            return { decision: 'block', reason: `Blocked: command matches dangerous pattern '${re.source}'` };
        }
    }
    for (const re of config.confirmPatterns) {
        if (re.test(trimmed)) {
            return {
                decision: 'confirm',
                reason: `Destructive command detected (${re.source})`,
                prompt: `⚠ ${re.source} — run this command? [y/N]`,
            };
        }
    }
    return { decision: 'allow', reason: 'Allowed' };
}
/**
 * Validate that every path argument referenced by a command falls inside
 * one of the allowed roots. Best-effort: only inspects tokens that look
 * like filesystem paths; unknown tokens are passed through.
 */
export function validatePaths(command, allowPaths) {
    if (allowPaths.length === 0)
        return { decision: 'allow', reason: 'No path restrictions configured' };
    const roots = allowPaths.map(p => path.resolve(p));
    // Match tokens that look like paths: start with ./ ../ / ~ or a drive letter, or contain a path separator.
    const pathToken = /(?:[./~]|[A-Za-z]:[\\/])[^\s;|&"']*/g;
    let match;
    while ((match = pathToken.exec(command)) !== null) {
        const token = match[0];
        const resolved = path.resolve(process.cwd(), token.replace(/^['"]|['"]$/g, ''));
        const inside = roots.some(root => resolved === root || resolved.startsWith(root + path.sep));
        if (!inside) {
            return {
                decision: 'block',
                reason: `Path '${token}' is outside the allowed roots (${roots.join(', ')})`,
            };
        }
    }
    return { decision: 'allow', reason: 'All paths within allowed roots' };
}
export function defaultSandboxConfig(config) {
    const allowPaths = (config.allowPaths ?? []).length > 0 ? config.allowPaths : [config.workspace];
    const parsePatterns = (strArr, defaultList = []) => {
        if (!strArr || strArr.length === 0)
            return defaultList;
        const result = [];
        for (const raw of strArr) {
            try {
                result.push(new RegExp(raw, 'i'));
            }
            catch {
                // Skip malformed regex
            }
        }
        return result.length ? result : defaultList;
    };
    return {
        readOnly: Boolean(config.readOnly),
        allowPaths,
        confirmPatterns: parsePatterns(config.confirmPatterns, DEFAULT_CONFIRM),
        blockPatterns: parsePatterns(config.blockPatterns, DEFAULT_BLOCK),
    };
}
