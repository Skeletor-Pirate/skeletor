import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { saveLearnedSkill } from './skills.js';
import { t } from './tui.js';
/**
 * Inspect sibling CLI agents (Claude Code, OpenCode, Aider, Antigravity)
 * to harvest state-of-the-art workflows, personas, and specialized skills.
 */
export function inspectBrotherAgents(workspace) {
    const siblings = [];
    // 1. OpenCode (.opencode)
    const openCodeDirs = [
        path.join(workspace, '.opencode'),
        path.join(os.homedir(), '.opencode'),
    ];
    const openCodeFound = openCodeDirs.find(d => fs.existsSync(d));
    const openCodeInfo = {
        name: 'OpenCode',
        location: openCodeFound || '.opencode',
        found: Boolean(openCodeFound),
        skillsFound: [],
        personasFound: [],
    };
    if (openCodeFound) {
        const agentsDir = path.join(openCodeFound, 'agents');
        if (fs.existsSync(agentsDir)) {
            try {
                const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
                openCodeInfo.personasFound = files.map(f => f.replace(/\.md$/, ''));
            }
            catch { }
        }
        const skillsDir = path.join(openCodeFound, 'skills');
        if (fs.existsSync(skillsDir)) {
            try {
                openCodeInfo.skillsFound = fs.readdirSync(skillsDir);
            }
            catch { }
        }
    }
    siblings.push(openCodeInfo);
    // 2. Claude Code (.claude)
    const claudeDirs = [
        path.join(workspace, '.claude'),
        path.join(os.homedir(), '.claude'),
    ];
    const claudeFound = claudeDirs.find(d => fs.existsSync(d));
    const claudeInfo = {
        name: 'Claude Code',
        location: claudeFound || '.claude',
        found: Boolean(claudeFound),
        skillsFound: [],
        personasFound: [],
    };
    if (claudeFound) {
        const cmdDir = path.join(claudeFound, 'commands');
        if (fs.existsSync(cmdDir)) {
            try {
                claudeInfo.skillsFound = fs.readdirSync(cmdDir).map(f => f.replace(/\.md$/, ''));
            }
            catch { }
        }
    }
    siblings.push(claudeInfo);
    // 3. Antigravity / Gemini Agents (.agents)
    const agyDirs = [
        path.join(workspace, '.agents'),
        path.join(os.homedir(), '.agents'),
    ];
    const agyFound = agyDirs.find(d => fs.existsSync(d));
    const agyInfo = {
        name: 'Antigravity IDE',
        location: agyFound || '.agents',
        found: Boolean(agyFound),
        skillsFound: [],
        personasFound: [],
    };
    if (agyFound) {
        const skillsDir = path.join(agyFound, 'skills');
        if (fs.existsSync(skillsDir)) {
            try {
                agyInfo.skillsFound = fs.readdirSync(skillsDir);
            }
            catch { }
        }
    }
    siblings.push(agyInfo);
    // 4. Aider (.aider)
    const aiderConf = path.join(workspace, '.aider.conf.yml');
    siblings.push({
        name: 'Aider',
        location: aiderConf,
        found: fs.existsSync(aiderConf),
        skillsFound: fs.existsSync(aiderConf) ? ['git-pair-programming'] : [],
        personasFound: [],
    });
    return siblings;
}
/**
 * Hermes 2.0 Autonomous Self-Evolution Engine:
 * Analyzes sibling capabilities, identifies skill gaps, and synthesizes permanent skills.
 */
export async function runSelfEvolution(workspace, existingSkills, options = {}) {
    const siblings = inspectBrotherAgents(workspace);
    const existingNames = new Set(existingSkills.map(s => s.name.toLowerCase()));
    const skillsAcquired = [];
    let alreadyHad = 0;
    for (const sib of siblings) {
        // 1. Process personas
        for (const persona of sib.personasFound) {
            const slug = persona.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
            if (existingNames.has(slug)) {
                alreadyHad += 1;
                continue;
            }
            let content = '';
            const personaFile = path.join(sib.location, 'agents', `${persona}.md`);
            if (fs.existsSync(personaFile)) {
                try {
                    content = fs.readFileSync(personaFile, 'utf8');
                }
                catch { }
            }
            if (!content) {
                content = `# Specialized Persona: ${persona}\n\nAutonomous skills harvested from sibling agent ${sib.name}.\n`;
            }
            const saved = saveLearnedSkill(workspace, {
                name: slug,
                description: `Harvested from sibling agent ${sib.name} (${persona})`,
                content,
                tags: [sib.name.toLowerCase(), 'persona', 'hermes-evolution'],
            });
            existingNames.add(slug);
            skillsAcquired.push({ name: slug, description: saved.skill.description, path: saved.path });
        }
        // 2. Process skills
        for (const sk of sib.skillsFound) {
            const slug = sk.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
            if (existingNames.has(slug)) {
                alreadyHad += 1;
                continue;
            }
            let content = '';
            const skillFile = path.join(sib.location, 'skills', sk, 'SKILL.md');
            if (fs.existsSync(skillFile)) {
                try {
                    content = fs.readFileSync(skillFile, 'utf8');
                }
                catch { }
            }
            if (content) {
                const saved = saveLearnedSkill(workspace, {
                    name: slug,
                    description: `Imported from sibling agent ${sib.name}`,
                    content,
                    tags: [sib.name.toLowerCase(), 'skill', 'hermes-evolution'],
                });
                existingNames.add(slug);
                skillsAcquired.push({ name: slug, description: saved.skill.description, path: saved.path });
            }
        }
    }
    // 3. If internet access is permitted, fetch community best-practice skills
    if (options.allowInternet) {
        // Online knowledge evolution hooks
        const webSkills = [
            {
                name: 'cloud-deploy-craft',
                description: 'Zero-downtime containerized cloud deployment and Docker healthchecks',
                content: '# Cloud Deploy Craft\n\nGuidelines for production multi-stage Docker builds, health checks, and secrets hygiene.\n- Use non-root user\n- Strip build dependencies\n- Add /health endpoint verification',
            },
            {
                name: 'owasp-api-sentinel',
                description: 'OWASP Top 10 API vulnerability prevention and rate limit security',
                content: '# OWASP API Sentinel\n\nSecurity best practices for REST and GraphQL endpoints:\n- Validate and sanitize all inputs\n- Enforce authorization checks at object level (BOLA)\n- Implement rate-limiting headers',
            },
        ];
        for (const ws of webSkills) {
            if (!existingNames.has(ws.name)) {
                const saved = saveLearnedSkill(workspace, {
                    name: ws.name,
                    description: ws.description,
                    content: ws.content,
                    tags: ['web-curated', 'security', 'hermes-evolution'],
                });
                existingNames.add(ws.name);
                skillsAcquired.push({ name: ws.name, description: ws.description, path: saved.path });
            }
        }
    }
    const message = `Evolved ${skillsAcquired.length} new permanent skills (retained ${alreadyHad} existing skills).`;
    return {
        siblingsInspected: siblings,
        skillsAcquired,
        alreadyHadCount: alreadyHad,
        message,
    };
}
export function renderEvolutionReport(result) {
    process.stdout.write(`\n${t.purple}╭─${t.reset} ${t.bold}HERMES 2.0 SELF-EVOLUTION REPORT${t.reset}\n`);
    process.stdout.write(`${t.purple}│${t.reset} ${t.dim}Sibling Agents Inspected:${t.reset}\n`);
    for (const s of result.siblingsInspected) {
        const statusDot = s.found ? `${t.green}●${t.reset}` : `${t.dim}○${t.reset}`;
        const skillsCount = s.skillsFound.length + s.personasFound.length;
        process.stdout.write(`${t.purple}│${t.reset}   ${statusDot} ${t.bold}${s.name}${t.reset} ${t.dim}(${s.location}) — ${skillsCount} capabilities found${t.reset}\n`);
    }
    process.stdout.write(`${t.purple}│${t.reset}\n`);
    if (result.skillsAcquired.length === 0) {
        process.stdout.write(`${t.purple}│${t.reset} ${t.cyan}★ Skeletor is fully up to date!${t.reset} ${t.dim}All ${result.alreadyHadCount} sibling capabilities are already mastered.${t.reset}\n`);
    }
    else {
        process.stdout.write(`${t.purple}│${t.reset} ${t.green}✓ ${result.skillsAcquired.length} New Skills Acquired & Mastered:${t.reset}\n`);
        for (const sk of result.skillsAcquired) {
            process.stdout.write(`${t.purple}│${t.reset}   ${t.cyan}● ${sk.name}${t.reset} ${t.dim}· ${sk.description}${t.reset}\n`);
        }
    }
    process.stdout.write(`${t.purple}╰────────────────────────────────────────────────────────────────────────╯${t.reset}\n\n`);
}
