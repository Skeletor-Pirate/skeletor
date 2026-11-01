import fs from 'node:fs';
import path from 'node:path';
import { listDir, isDirectory, readText } from './util.js';
function parseFrontmatter(content) {
    // Support both Windows \r\n and Unix \n line endings
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match)
        return { data: {}, body: content };
    const data = {};
    for (const line of match[1].split(/\r?\n/)) {
        const idx = line.indexOf(':');
        if (idx > 0) {
            const key = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (key && value)
                data[key] = value;
        }
    }
    return { data, body: match[2] };
}
export function discoverSkills(dirs) {
    const skills = [];
    const seen = new Set();
    const scanDirectory = (baseDir) => {
        if (!isDirectory(baseDir))
            return;
        const entries = listDir(baseDir);
        for (const entry of entries) {
            const fullPath = path.join(baseDir, entry);
            if (!isDirectory(fullPath))
                continue;
            // 1. Direct skill folder: dir/entry/SKILL.md
            const directSkill = path.join(fullPath, 'SKILL.md');
            if (fs.existsSync(directSkill)) {
                const content = readText(directSkill);
                if (content) {
                    const { data, body } = parseFrontmatter(content);
                    const name = data.name || entry;
                    if (!seen.has(name)) {
                        seen.add(name);
                        skills.push({
                            name,
                            path: fullPath,
                            description: data.description || '',
                            content: body,
                            mcp: data.mcp ? data.mcp.split(',').map(s => s.trim()) : undefined,
                        });
                    }
                }
            }
            // 2. Nested skills in plugin folder: dir/entry/skills/*/SKILL.md
            const nestedSkillsDir = path.join(fullPath, 'skills');
            if (isDirectory(nestedSkillsDir)) {
                scanDirectory(nestedSkillsDir);
            }
        }
    };
    for (const dir of dirs) {
        scanDirectory(dir);
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
}
export function skillByName(skills, name) {
    const query = name.toLowerCase().trim();
    return skills.find(s => s.name.toLowerCase() === query);
}
export function renderSkillPrompt(skill) {
    return [
        `# Active Skill: ${skill.name}`,
        skill.description ? `> ${skill.description}` : '',
        '',
        skill.content,
    ].filter(Boolean).join('\n');
}
/**
 * Hermes-style continuous skill acquisition:
 * Permanently saves a newly acquired skill into .skeletor/skills/<name>/SKILL.md
 * so it becomes an automatic permanent capability of the agent.
 */
export function saveLearnedSkill(workspace, params) {
    const slug = params.name
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'custom-skill';
    // Prefer local workspace .skeletor/skills, fallback to user home ~/.skeletor/skills
    const targetDir = path.join(workspace, '.skeletor', 'skills', slug);
    fs.mkdirSync(targetDir, { recursive: true });
    const skillFile = path.join(targetDir, 'SKILL.md');
    const frontmatter = [
        '---',
        `name: ${slug}`,
        `description: "${params.description.replace(/"/g, '\\"')}"`,
        params.tags?.length ? `tags: "${params.tags.join(', ')}"` : '',
        `learned_at: "${new Date().toISOString()}"`,
        `framework: "hermes-continuous-learning"`,
        '---',
        '',
        params.content.trim(),
        '',
    ].filter(Boolean).join('\n');
    fs.writeFileSync(skillFile, frontmatter, 'utf8');
    const newSkill = {
        name: slug,
        path: targetDir,
        description: params.description,
        content: params.content.trim(),
    };
    return { path: skillFile, skill: newSkill };
}
/**
 * Extracts patterns and synthesized workflows from conversation history (Hermes style).
 */
export function synthesizeSkillFromSession(messages, customName) {
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    const userMsgs = messages.filter(m => m.role === 'user');
    const primaryGoal = userMsgs[0]?.content.slice(0, 80) || 'Automated Workflow';
    const name = customName || primaryGoal.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const keySteps = [];
    for (const m of assistantMsgs) {
        const text = typeof m.content === 'string' ? m.content : '';
        // Look for shell commands or numbered steps
        const lines = text.split('\n');
        for (const l of lines) {
            if (/^\d+\.\s+/.test(l) || l.startsWith('$ ') || l.startsWith('> ')) {
                keySteps.push(l.trim());
            }
        }
    }
    const instructions = [
        `# ${customName || primaryGoal}`,
        '',
        `## Purpose`,
        `Workflow learned automatically during session execution for: ${primaryGoal}.`,
        '',
        `## Learned Procedures`,
        keySteps.length > 0
            ? keySteps.slice(0, 15).join('\n')
            : '- Follow verified patterns and run automated tests after making changes.\n- Check project configuration and AST structure using Graphify.',
        '',
        `## Edge Cases & Notes`,
        `- Keep environment PowerShell/Bash differences in mind on Windows.\n- Verify all changes with local test runner before completing.`,
    ].join('\n');
    return {
        name,
        description: `Workflow learned from: ${primaryGoal}`,
        content: instructions,
    };
}
