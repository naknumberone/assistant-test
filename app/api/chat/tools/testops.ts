import { tool } from 'ai';
import { z } from 'zod';

// In-memory mock storage (resets on server restart)
const testCases: { name: string; id: string }[] = [];

export const testopsFindTestcases = tool({
  description: 'Find all test cases in TestOps. Returns { data: [] }',
  inputSchema: z.object({}),
  execute: async () => {
    return { data: [...testCases] };
  },
});

export const testopsCreateTestcase = tool({
  description:
    'Create a test case in TestOps. Accepts { name } and returns { name, id }',
  inputSchema: z.object({
    name: z.string().describe('Name of the test case'),
  }),
  execute: async ({ name }) => {
    const id = crypto.randomUUID();
    const testCase = { name, id };
    testCases.push(testCase);
    return testCase;
  },
});
