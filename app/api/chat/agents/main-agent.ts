import { ToolLoopAgent, stepCountIs } from 'ai';
import { model } from '../model';
import { weather } from '../tools/weather';
import {
  testopsBulkCreateSmokeSuite,
  testopsFindTestcases,
  testopsCreateTestcase,
} from '../tools/testops';
import { loadSkillTool, skills } from '../tools/load-skill';
import { runTestOpsAgent } from '../tools/run-testops-agent';

const skillsList = skills.length > 0
  ? '\n\n## Available Skills\n' +
    'Use the loadSkill tool to load a skill when the user\'s request matches one.\n' +
    'Then delegate execution to runTestOpsAgent with the loaded instructions.\n\n' +
    skills.map(s => `- ${s.name}: ${s.description}`).join('\n')
  : '';

export const mainAgent = new ToolLoopAgent({
  id: 'main-chat-agent',
  model,
  instructions:
    'You are a helpful assistant with access to tools and skills. ' +
    'For simple TestOps queries (find or create), use the tools directly. ' +
    'If the user asks for direct bulk smoke creation, call testops_bulk_create_smoke_suite immediately. ' +
    'Do NOT ask for confirmation in plain text. Tool approval is handled by the UI via the tool approval flow. ' +
    'When a mutating action needs confirmation, still call the tool; do not replace tool approval with a chat question. ' +
    'When the user asks to bootstrap or generate a smoke suite as a workflow, prefer a skill via loadSkill + runTestOpsAgent. ' +
    'For multi-step TestOps workflows, load the appropriate skill with loadSkill ' +
    'and delegate to runTestOpsAgent.' +
    skillsList,
  tools: {
    weather,
    loadSkill: loadSkillTool,
    runTestOpsAgent,
    testops_find_testcases: testopsFindTestcases,
    testops_create_testcase: testopsCreateTestcase,
    testops_bulk_create_smoke_suite: testopsBulkCreateSmokeSuite,
  },
  stopWhen: stepCountIs(10),
  providerOptions: {
    openai: { store: false },
  },
});
