/**
 * Smart Edit & Patch Engine for Skeletor
 * Implements Aider/Claude Code-grade whitespace tolerance, line-ending normalization,
 * sliding-window fuzzy matching, and search/replace diff block parsing.
 */
/**
 * Normalizes string line endings to LF (\n).
 */
export function normalizeLineEndings(str) {
    return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
/**
 * Detects whether a string primarily uses CRLF line endings.
 */
export function usesCrlf(str) {
    const crlfCount = (str.match(/\r\n/g) || []).length;
    const lfCount = (str.match(/[^\r]\n/g) || []).length;
    return crlfCount > lfCount;
}
/**
 * Extracts search and replace chunks if input is wrapped in Aider/Git style markers:
 * <<<<<<< SEARCH
 * old code
 * =======
 * new code
 * >>>>>>> REPLACE
 */
export function parseSearchReplaceBlocks(input) {
    const markerRegex = /<{5,}\s*SEARCH\r?\n([\s\S]*?)\r?\n={5,}\r?\n([\s\S]*?)\r?\n>{5,}\s*REPLACE/g;
    const blocks = [];
    let match;
    while ((match = markerRegex.exec(input)) !== null) {
        blocks.push({
            search: match[1],
            replace: match[2],
        });
    }
    return blocks.length > 0 ? blocks : null;
}
/**
 * Applies smart edit using multi-tier matching strategies:
 * Tier 1: Exact string match
 * Tier 2: Normalized line endings (\r\n vs \n)
 * Tier 3: Whitespace-tolerant sliding-window line matching
 */
export function applySmartEdit(originalContent, rawOldString, rawNewString) {
    // Check if rawOldString or rawNewString contains search/replace blocks
    const blocks = parseSearchReplaceBlocks(rawOldString) || parseSearchReplaceBlocks(rawNewString);
    if (blocks) {
        let current = originalContent;
        for (const blk of blocks) {
            const res = applySmartEdit(current, blk.search, blk.replace);
            if (!res.success) {
                return res;
            }
            current = res.result;
        }
        return { success: true, result: current, matchedBy: 'hunk' };
    }
    // Tier 1: Exact match
    const exactOccurrences = originalContent.split(rawOldString).length - 1;
    if (exactOccurrences === 1) {
        return {
            success: true,
            result: originalContent.replace(rawOldString, rawNewString),
            matchedBy: 'exact',
        };
    }
    if (exactOccurrences > 1) {
        return {
            success: false,
            error: `old_string found ${exactOccurrences} times in file; must be unique. Provide more surrounding lines for context.`,
        };
    }
    // Tier 2: Line ending normalization
    const isCrlf = usesCrlf(originalContent);
    const normOriginal = normalizeLineEndings(originalContent);
    const normOld = normalizeLineEndings(rawOldString);
    const normNew = normalizeLineEndings(rawNewString);
    const normOccurrences = normOriginal.split(normOld).length - 1;
    if (normOccurrences === 1) {
        let updated = normOriginal.replace(normOld, normNew);
        if (isCrlf) {
            updated = updated.replace(/\n/g, '\r\n');
        }
        return {
            success: true,
            result: updated,
            matchedBy: 'normalized-line-endings',
        };
    }
    if (normOccurrences > 1) {
        return {
            success: false,
            error: `old_string found ${normOccurrences} times after line-ending normalization; provide more surrounding lines.`,
        };
    }
    // Tier 3: Whitespace-tolerant sliding window
    const origLines = normOriginal.split('\n');
    const targetLines = normOld.split('\n');
    const newLines = normNew.split('\n');
    // Strip empty leading/trailing lines in target
    let targetStartIdx = 0;
    let targetEndIdx = targetLines.length;
    while (targetStartIdx < targetEndIdx && targetLines[targetStartIdx].trim() === '') {
        targetStartIdx++;
    }
    while (targetEndIdx > targetStartIdx && targetLines[targetEndIdx - 1].trim() === '') {
        targetEndIdx--;
    }
    const trimmedTarget = targetLines.slice(targetStartIdx, targetEndIdx).map(l => l.trim());
    if (trimmedTarget.length === 0) {
        return {
            success: false,
            error: 'old_string cannot be completely whitespace or empty.',
        };
    }
    const matchingWindowIndices = [];
    for (let i = 0; i <= origLines.length - trimmedTarget.length; i++) {
        let matches = true;
        for (let j = 0; j < trimmedTarget.length; j++) {
            if (origLines[i + j].trim() !== trimmedTarget[j]) {
                matches = false;
                break;
            }
        }
        if (matches) {
            matchingWindowIndices.push(i);
        }
    }
    if (matchingWindowIndices.length === 1) {
        const matchStart = matchingWindowIndices[0];
        const matchEnd = matchStart + trimmedTarget.length;
        // Detect indentation offset from the first non-empty line
        const origFirstLine = origLines[matchStart];
        const targetFirstLine = targetLines[targetStartIdx];
        const origIndent = origFirstLine.match(/^(\s*)/)?.[1] || '';
        const targetIndent = targetFirstLine.match(/^(\s*)/)?.[1] || '';
        // Adjust replacement indentation if needed
        const adjustedNewLines = newLines.map(nl => {
            if (!nl.trim())
                return nl;
            if (targetIndent && nl.startsWith(targetIndent)) {
                return origIndent + nl.slice(targetIndent.length);
            }
            return nl;
        });
        const finalLines = [
            ...origLines.slice(0, matchStart),
            ...adjustedNewLines,
            ...origLines.slice(matchEnd),
        ];
        let result = finalLines.join('\n');
        if (isCrlf) {
            result = result.replace(/\n/g, '\r\n');
        }
        return {
            success: true,
            result,
            matchedBy: 'whitespace-tolerant',
        };
    }
    if (matchingWindowIndices.length > 1) {
        return {
            success: false,
            error: `old_string matched ${matchingWindowIndices.length} locations with whitespace tolerance; please provide more unique surrounding lines.`,
        };
    }
    // Tier 4: Diagnostic hint if not found
    const firstLine = targetLines[0].trim();
    const candidates = [];
    origLines.forEach((l, idx) => {
        if (l.trim().includes(firstLine) || (firstLine.length > 5 && l.includes(firstLine.slice(0, 20)))) {
            candidates.push({ lineNum: idx + 1, content: l.trim() });
        }
    });
    let hint = 'old_string not found in file. Please verify exact characters and whitespace.';
    if (candidates.length > 0) {
        const candidateStr = candidates.slice(0, 3).map(c => `Line ${c.lineNum}: "${c.content}"`).join('\n  ');
        hint += `\nSimilar line(s) found:\n  ${candidateStr}`;
    }
    return {
        success: false,
        error: hint,
    };
}
