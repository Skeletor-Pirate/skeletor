export interface Skill {
    name: string;
    path: string;
    description: string;
    content: string;
    mcp?: string[];
    tools?: string[];
}
export declare function discoverSkills(dirs: string[]): Skill[];
export declare function skillByName(skills: Skill[], name: string): Skill | undefined;
export declare function renderSkillPrompt(skill: Skill): string;
/**
 * Hermes-style continuous skill acquisition:
 * Permanently saves a newly acquired skill into .skeletor/skills/<name>/SKILL.md
 * so it becomes an automatic permanent capability of the agent.
 */
export declare function saveLearnedSkill(workspace: string, params: {
    name: string;
    description: string;
    content: string;
    tags?: string[];
}): {
    path: string;
    skill: Skill;
};
/**
 * Extracts patterns and synthesized workflows from conversation history (Hermes style).
 */
export declare function synthesizeSkillFromSession(messages: Array<{
    role: string;
    content: string;
}>, customName?: string): {
    name: string;
    description: string;
    content: string;
};
