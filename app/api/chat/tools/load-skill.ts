import { tool } from 'ai';
import { z } from 'zod';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';

interface SkillMetadata {
  name: string;
  description: string;
  dirName: string;
}

const SKILLS_DIR = path.join(process.cwd(), 'skills');

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) throw new Error('No frontmatter found');

  const lines = match[1].split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    result[key] = value;
  }

  if (!result.name || !result.description) {
    throw new Error('Frontmatter must have name and description');
  }
  return { name: result.name, description: result.description };
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? content.slice(match[0].length).trim() : content.trim();
}

// Discover skills at module load time
function discoverSkills(): SkillMetadata[] {
  try {
    const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => {
        try {
          const content = readFileSync(
            path.join(SKILLS_DIR, e.name, 'SKILL.md'),
            'utf-8',
          );
          const fm = parseFrontmatter(content);
          return { name: fm.name, description: fm.description, dirName: e.name };
        } catch {
          return null;
        }
      })
      .filter((s): s is SkillMetadata => s !== null);
  } catch {
    return [];
  }
}

export const skills = discoverSkills();

export const loadSkillTool = tool({
  description:
    'Load a skill to get specialized instructions. Available skills: ' +
    skills.map(s => `${s.name} (${s.description})`).join(', '),
  inputSchema: z.object({
    name: z.string().describe('The skill name to load'),
  }),
  execute: async ({ name }) => {
    const skill = skills.find(
      s => s.name.toLowerCase() === name.toLowerCase(),
    );
    if (!skill) {
      return { error: `Skill '${name}' not found` };
    }

    const content = readFileSync(
      path.join(SKILLS_DIR, skill.dirName, 'SKILL.md'),
      'utf-8',
    );
    return { content: stripFrontmatter(content) };
  },
});
