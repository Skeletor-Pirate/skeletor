import fs from 'node:fs';
import path from 'node:path';
const SUPPORTED_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
    '.css', '.scss', '.json', '.html',
]);
const IGNORED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.cache',
    'coverage', '__pycache__', '.pytest_cache', '.venv', 'venv',
]);
export function parseFileSymbols(content, ext) {
    const symbols = [];
    const imports = [];
    const exports = [];
    const lines = content.split('\n');
    // TS/JS Parsing
    if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            const trimmed = line.trim();
            // Imports
            const importMatch = trimmed.match(/^import\s+(?:.+?\s+from\s+)?['"]([^'"]+)['"]/);
            if (importMatch) {
                imports.push(importMatch[1]);
                continue;
            }
            // Exports (named or default)
            const isExported = trimmed.startsWith('export ');
            // Function regex
            const fnMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*(<[^>]+>)?\s*\(([^)]*)\)(?::\s*([^{]+))?/);
            if (fnMatch) {
                symbols.push({
                    name: fnMatch[1],
                    kind: 'function',
                    signature: `function ${fnMatch[1]}(${fnMatch[3].trim()}): ${(fnMatch[4] || 'void').trim()}`,
                    line: i + 1,
                    isExported,
                });
                if (isExported)
                    exports.push(fnMatch[1]);
                continue;
            }
            // Arrow function / const function
            const arrowMatch = trimmed.match(/^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?::\s*([^=]+))?\s*=>/);
            if (arrowMatch) {
                symbols.push({
                    name: arrowMatch[1],
                    kind: 'function',
                    signature: `const ${arrowMatch[1]} = (${arrowMatch[2].trim()}): ${(arrowMatch[3] || 'any').trim()}`,
                    line: i + 1,
                    isExported,
                });
                if (isExported)
                    exports.push(arrowMatch[1]);
                continue;
            }
            // Class
            const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)(?:\s+extends\s+([A-Za-z0-9_$.]+))?(?:\s+implements\s+([^{]+))?/);
            if (classMatch) {
                const heritage = classMatch[2] ? ` extends ${classMatch[2]}` : '';
                symbols.push({
                    name: classMatch[1],
                    kind: 'class',
                    signature: `class ${classMatch[1]}${heritage}`,
                    line: i + 1,
                    isExported,
                });
                if (isExported)
                    exports.push(classMatch[1]);
                continue;
            }
            // Interface
            const ifaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)(?:<[^>]+>)?(?:\s+extends\s+([^{]+))?/);
            if (ifaceMatch) {
                symbols.push({
                    name: ifaceMatch[1],
                    kind: 'interface',
                    signature: `interface ${ifaceMatch[1]}`,
                    line: i + 1,
                    isExported,
                });
                if (isExported)
                    exports.push(ifaceMatch[1]);
                continue;
            }
            // Type alias
            const typeMatch = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z0-9_$]+)(?:<[^>]+>)?\s*=/);
            if (typeMatch) {
                symbols.push({
                    name: typeMatch[1],
                    kind: 'type',
                    signature: `type ${typeMatch[1]}`,
                    line: i + 1,
                    isExported,
                });
                if (isExported)
                    exports.push(typeMatch[1]);
                continue;
            }
            // Enum
            const enumMatch = trimmed.match(/^(?:export\s+)?enum\s+([A-Za-z0-9_$]+)/);
            if (enumMatch) {
                symbols.push({
                    name: enumMatch[1],
                    kind: 'enum',
                    signature: `enum ${enumMatch[1]}`,
                    line: i + 1,
                    isExported,
                });
                if (isExported)
                    exports.push(enumMatch[1]);
                continue;
            }
        }
    }
    else if (ext === '.py') {
        // Python parsing
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            const trimmed = line.trim();
            const pyImport = trimmed.match(/^(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.]+))/);
            if (pyImport) {
                imports.push(pyImport[1] || pyImport[2]);
                continue;
            }
            const pyFn = trimmed.match(/^def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
            if (pyFn) {
                symbols.push({
                    name: pyFn[1],
                    kind: 'function',
                    signature: `def ${pyFn[1]}(${pyFn[2].trim()})${pyFn[3] ? ` -> ${pyFn[3].trim()}` : ''}`,
                    line: i + 1,
                    isExported: !pyFn[1].startsWith('_'),
                });
                continue;
            }
            const pyClass = trimmed.match(/^class\s+([A-Za-z0-9_]+)(?:\(([^)]*)\))?:/);
            if (pyClass) {
                symbols.push({
                    name: pyClass[1],
                    kind: 'class',
                    signature: `class ${pyClass[1]}${pyClass[2] ? `(${pyClass[2]})` : ''}`,
                    line: i + 1,
                    isExported: true,
                });
            }
        }
    }
    return { symbols, imports, exports };
}
export function buildCodeGraph(rootDir, options = {}) {
    const maxFiles = options.maxFiles ?? 200;
    const maxDepth = options.maxDepth ?? 8;
    const filesMap = new Map();
    const symbolIndex = new Map();
    const walk = (dir, depth) => {
        if (depth > maxDepth || filesMap.size >= maxFiles)
            return;
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.'))
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath, depth + 1);
            }
            else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (!SUPPORTED_EXTENSIONS.has(ext))
                    continue;
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const rel = path.relative(rootDir, fullPath).replace(/\\/g, '/');
                    const lines = content.split('\n');
                    const { symbols, imports, exports } = parseFileSymbols(content, ext);
                    const node = {
                        filePath: fullPath,
                        relativePath: rel,
                        extension: ext,
                        lineCount: lines.length,
                        symbols,
                        imports,
                        exports,
                    };
                    filesMap.set(rel, node);
                    for (const s of symbols) {
                        const list = symbolIndex.get(s.name) || [];
                        list.push({ file: rel, symbol: s });
                        symbolIndex.set(s.name, list);
                    }
                }
                catch {
                    // Ignore read error
                }
            }
        }
    };
    walk(rootDir, 0);
    let totalSymbols = 0;
    for (const node of filesMap.values()) {
        totalSymbols += node.symbols.length;
    }
    return {
        root: rootDir,
        files: filesMap,
        symbolIndex,
        totalFiles: filesMap.size,
        totalSymbols,
    };
}
/**
 * Generates an ultra-compact Context7x structural code map of the codebase.
 * Compresses 50,000+ tokens of raw source code down to ~2,000 tokens of high-density symbol outline.
 */
export function renderCompressedCodeMap(graph, targetPath) {
    const lines = [];
    lines.push(`Codebase Graph (${graph.totalFiles} files, ${graph.totalSymbols} symbols):`);
    for (const [rel, node] of graph.files.entries()) {
        if (targetPath && !rel.toLowerCase().includes(targetPath.toLowerCase())) {
            continue;
        }
        const ext = node.extension;
        const syms = node.symbols;
        if (syms.length === 0) {
            lines.push(`📁 ${rel} (${node.lineCount}L)`);
            continue;
        }
        const symSummaries = syms.map(s => {
            const tag = s.isExported ? '●' : '○';
            return `${tag} ${s.kind[0].toUpperCase()}:${s.name}`;
        }).join(' | ');
        lines.push(`📁 ${rel} (${node.lineCount}L): ${symSummaries}`);
    }
    return lines.join('\n');
}
/**
 * Search the code graph for symbol declarations or cross references.
 */
export function queryCodeGraph(graph, symbolQuery) {
    const q = symbolQuery.trim().toLowerCase();
    const hits = [];
    for (const [name, occurrences] of graph.symbolIndex.entries()) {
        if (name.toLowerCase().includes(q)) {
            for (const occ of occurrences) {
                hits.push(`• ${occ.symbol.signature} in ${occ.file}:${occ.symbol.line}`);
            }
        }
    }
    if (hits.length === 0) {
        return `No symbols matching '${symbolQuery}' found in codebase graph.`;
    }
    return `Symbol matches for '${symbolQuery}' (${hits.length}):\n${hits.slice(0, 30).join('\n')}`;
}
