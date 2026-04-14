import { tool } from 'ai';
import { z } from 'zod';
import { testopsAgent } from '../agents/testops-agent';

export const runTestOpsAgent = tool({
  description:
    'Delegate a multi-step TestOps task to the specialized TestOps sub-agent. ' +
    'Use this when a skill requires multiple tool calls (e.g. ensure_first_testcase). ' +
    'Pass the skill instructions so the sub-agent knows what to do.',
  inputSchema: z.object({
    task: z.string().describe('What the sub-agent should accomplish'),
    skillInstructions: z
      .string()
      .describe('The full skill instructions loaded via loadSkill'),
  }),
  execute: async ({ task, skillInstructions }) => {
    const result = await testopsAgent.generate({
      prompt: `## Skill Instructions\n${skillInstructions}\n\n## Task\n${task}`,
    });
    return { result: result.text };
  },
});
