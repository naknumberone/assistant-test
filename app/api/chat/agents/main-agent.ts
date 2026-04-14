import { ToolLoopAgent, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { model } from '../model';
import { weather } from '../tools/weather';
import { testopsFindTestcases, testopsCreateTestcase } from '../tools/testops';
import { loadSkillTool, skills } from '../tools/load-skill';
import { testopsAgent } from './testops-agent';

const runTestOpsAgent = tool({
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

function buildSkillsPrompt(): string {
  if (skills.length === 0) return '';
  const list = skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
  return `\n\n## Available Skills\nUse the loadSkill tool to load a skill when the user's request matches one.\nThen delegate execution to runTestOpsAgent with the loaded instructions.\n\n${list}`;
}

export const mainAgent = new ToolLoopAgent({
  id: 'main-chat-agent',
  model,
  instructions:
    'You are a helpful assistant with access to tools and skills. ' +
    'For simple TestOps queries (find or create), use the tools directly. ' +
    'For multi-step TestOps workflows, load the appropriate skill with loadSkill ' +
    'and delegate to runTestOpsAgent.' +
    buildSkillsPrompt(),
  tools: {
    weather,
    loadSkill: loadSkillTool,
    runTestOpsAgent,
    testops_find_testcases: testopsFindTestcases,
    testops_create_testcase: testopsCreateTestcase,
  },
  stopWhen: stepCountIs(5),
  providerOptions: {
    openai: { store: false },
  },
});
