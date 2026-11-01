import fs from 'node:fs';
import path from 'node:path';
import { LLMClient } from './llm.js';
import { inspectBrotherAgents } from './evolution.js';
import { discoverSkills } from './skills.js';
import { toolGit } from './tools.js';
import { t } from './tui.js';
export async function runDiagnostics(config) {
    const llm = new LLMClient(config);
    // 1. Gateway diagnostics
    const gwStart = Date.now();
    let gatewayOnline = false;
    let modelsAvailable = 0;
    let latencyMs = 0;
    try {
        const models = await llm.listModels();
        latencyMs = Date.now() - gwStart;
        gatewayOnline = true;
        modelsAvailable = models.length;
    }
    catch {
        latencyMs = Date.now() - gwStart;
        gatewayOnline = false;
    }
    // 2. Brothers diagnostics
    const brothers = inspectBrotherAgents(config.workspace);
    const foundBrothers = brothers.filter(b => b.found);
    // 3. Skills diagnostics
    const allSkills = discoverSkills(config.skillsDirs);
    const localSkillsDir = path.join(config.workspace, '.skeletor', 'skills');
    let learnedCount = 0;
    if (fs.existsSync(localSkillsDir)) {
        try {
            learnedCount = fs.readdirSync(localSkillsDir).length;
        }
        catch { }
    }
    // 4. Git diagnostics
    const gitRes = await toolGit({ args: ['status', '--porcelain', '-b'] }, config);
    const isRepo = !gitRes.isError;
    let branch = 'unknown';
    let hasUncommitted = false;
    if (isRepo) {
        const firstLine = gitRes.output.split('\n')[0] || '';
        const branchMatch = firstLine.match(/## ([\w\-./]+)/);
        branch = branchMatch ? branchMatch[1] : 'HEAD';
        hasUncommitted = gitRes.output.trim().split('\n').length > 1;
    }
    // 5. Workspace diagnostics
    const hasPkg = fs.existsSync(path.join(config.workspace, 'package.json'));
    const hasTs = fs.existsSync(path.join(config.workspace, 'tsconfig.json'));
    return {
        gateway: {
            url: config.gatewayUrl,
            online: gatewayOnline,
            latencyMs,
            modelsAvailable,
            activeModel: config.model,
            hasKey: Boolean(config.apiKey),
        },
        brothers: {
            totalInspected: brothers.length,
            foundCount: foundBrothers.length,
            details: brothers.map(b => ({
                name: b.name,
                found: b.found,
                capabilities: b.skillsFound.length + b.personasFound.length,
                location: b.location,
            })),
        },
        skills: {
            totalDiscovered: allSkills.length,
            learnedInWorkspace: learnedCount,
        },
        git: {
            isRepo,
            branch,
            hasUncommitted,
        },
        workspace: {
            path: config.workspace,
            hasPackageJson: hasPkg,
            hasTsConfig: hasTs,
        },
    };
}
export function renderDoctorReport(report) {
    const ok = `${t.green}●${t.reset}`;
    const warn = `${t.yellow}▲${t.reset}`;
    const bad = `${t.red}✗${t.reset}`;
    process.stdout.write(`\n${t.purple}╭─${t.reset} ${t.bold}SKELETOR SYSTEM DIAGNOSTICS & AUDIT${t.reset}\n`);
    // Gateway
    const gwStatus = report.gateway.online ? ok : bad;
    process.stdout.write(`${t.purple}│${t.reset}  ${t.bold}Gateway & LLM API:${t.reset}\n`);
    process.stdout.write(`${t.purple}│${t.reset}    ${gwStatus} Status: ${report.gateway.online ? `${t.green}Online${t.reset} (${report.gateway.latencyMs}ms)` : `${t.red}Offline${t.reset}`} · URL: ${report.gateway.url}\n`);
    process.stdout.write(`${t.purple}│${t.reset}    ${report.gateway.hasKey ? ok : warn} Auth: ${report.gateway.hasKey ? `${t.green}Configured${t.reset}` : `${t.yellow}Missing API Key${t.reset}`} · Models: ${t.cyan}${report.gateway.modelsAvailable}${t.reset} live · Active: ${t.bold}${t.cyan}${report.gateway.activeModel}${t.reset}\n`);
    // Brother agents
    process.stdout.write(`${t.purple}│${t.reset}\n`);
    process.stdout.write(`${t.purple}│${t.reset}  ${t.bold}Brother CLI Agents (Ecosystem):${t.reset}\n`);
    for (const b of report.brothers.details) {
        const dot = b.found ? ok : `${t.dim}○${t.reset}`;
        process.stdout.write(`${t.purple}│${t.reset}    ${dot} ${b.name.padEnd(16)} ${b.found ? `${t.green}${b.capabilities} capabilities${t.reset}` : `${t.dim}Not found${t.reset}`} ${t.dim}(${b.location})${t.reset}\n`);
    }
    // Skills
    process.stdout.write(`${t.purple}│${t.reset}\n`);
    process.stdout.write(`${t.purple}│${t.reset}  ${t.bold}Hermes Skill Engine:${t.reset}\n`);
    process.stdout.write(`${t.purple}│${t.reset}    ${ok} Discovered: ${t.bold}${t.green}${report.skills.totalDiscovered}${t.reset} skills · Local Learned (.skeletor/skills): ${t.bold}${t.cyan}${report.skills.learnedInWorkspace}${t.reset}\n`);
    // Codebase & Git
    process.stdout.write(`${t.purple}│${t.reset}\n`);
    process.stdout.write(`${t.purple}│${t.reset}  ${t.bold}Workspace & Git Integrity:${t.reset}\n`);
    const gitDot = report.git.isRepo ? ok : warn;
    process.stdout.write(`${t.purple}│${t.reset}    ${gitDot} Git: ${report.git.isRepo ? `Branch ${t.green}${report.git.branch}${t.reset}` : 'Not a git repo'} · Changes: ${report.git.hasUncommitted ? `${t.yellow}Uncommitted files present${t.reset}` : `${t.green}Clean working tree${t.reset}`}\n`);
    process.stdout.write(`${t.purple}│${t.reset}    ${ok} Path: ${t.dim}${report.workspace.path}${t.reset} [TypeScript: ${report.workspace.hasTsConfig ? 'yes' : 'no'}, package.json: ${report.workspace.hasPackageJson ? 'yes' : 'no'}]\n`);
    process.stdout.write(`${t.purple}╰────────────────────────────────────────────────────────────────────────╯${t.reset}\n\n`);
}
