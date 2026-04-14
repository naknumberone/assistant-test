import { ToolLoopAgent, stepCountIs } from 'ai';
import { model } from '../model';
import { testopsFindTestcases, testopsCreateTestcase } from '../tools/testops';

export const testopsAgent = new ToolLoopAgent({
  id: 'testops-agent',
  model,
  instructions:
    'You are a TestOps automation agent. ' +
    'You follow skill instructions precisely and use the provided tools to complete the task.',
  tools: {
    testops_find_testcases: testopsFindTestcases,
    testops_create_testcase: testopsCreateTestcase,
  },
  stopWhen: stepCountIs(10),
  providerOptions: {
    openai: { store: false },
  },
});
