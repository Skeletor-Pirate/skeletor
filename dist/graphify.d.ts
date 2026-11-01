export interface CodeSymbol {
    name: string;
    kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum';
    signature: string;
    line: number;
    endLine?: number;
    isExported: boolean;
    doc?: string;
}
export interface FileNode {
    filePath: string;
    relativePath: string;
    extension: string;
    lineCount: number;
    symbols: CodeSymbol[];
    imports: string[];
    exports: string[];
}
export interface CodeGraph {
    root: string;
    files: Map<string, FileNode>;
    symbolIndex: Map<string, {
        file: string;
        symbol: CodeSymbol;
    }[]>;
    totalFiles: number;
    totalSymbols: number;
}
export declare function parseFileSymbols(content: string, ext: string): {
    symbols: CodeSymbol[];
    imports: string[];
    exports: string[];
};
export declare function buildCodeGraph(rootDir: string, options?: {
    maxFiles?: number;
    maxDepth?: number;
    includeExts?: string[];
}): CodeGraph;
/**
 * Generates an ultra-compact Context7x structural code map of the codebase.
 * Compresses 50,000+ tokens of raw source code down to ~2,000 tokens of high-density symbol outline.
 */
export declare function renderCompressedCodeMap(graph: CodeGraph, targetPath?: string): string;
/**
 * Search the code graph for symbol declarations or cross references.
 */
export declare function queryCodeGraph(graph: CodeGraph, symbolQuery: string): string;
