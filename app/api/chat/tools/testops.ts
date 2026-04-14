import { tool } from 'ai';
import { z } from 'zod';

// In-memory mock storage (resets on server restart)
type MockTestCase = {
  id: string;
  name: string;
  tags: string[];
  createdAt: number;
};

const testCases: MockTestCase[] = [];

export const testopsFindTestcases = tool({
  description: 'Find all test cases in TestOps. Returns { data: [] }',
  inputSchema: z.object({
    tag: z
      .string()
      .optional()
      .describe('Optional tag filter, e.g. "smoke"'),
  }),
  execute: async ({ tag }) => {
    if (!tag) {
      return { data: [...testCases] };
    }

    return {
      data: testCases.filter(testCase =>
        testCase.tags.some(t => t.toLowerCase() === tag.toLowerCase()),
      ),
    };
  },
});

export const testopsCreateTestcase = tool({
  description:
    'Create a test case in TestOps. Accepts { name } and returns { name, id }',
  inputSchema: z.object({
    name: z.string().describe('Name of the test case'),
    tags: z
      .array(z.string())
      .optional()
      .describe('Optional tags, e.g. ["smoke", "checkout"]'),
  }),
  execute: async ({ name, tags }) => {
    const id = crypto.randomUUID();
    const testCase: MockTestCase = {
      id,
      name,
      tags: tags ?? [],
      createdAt: Date.now(),
    };
    testCases.push(testCase);
    return { name: testCase.name, id: testCase.id, tags: testCase.tags };
  },
});

export const testopsBulkCreateSmokeSuite = tool({
  description:
    'Bulk-create smoke test cases for a feature. This is a mutating operation and must be user-approved.',
  inputSchema: z.object({
    feature: z.string().describe('Feature name, e.g. "Checkout"'),
    casesCount: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe('How many smoke test cases to create (1-10)'),
  }),
  needsApproval: true,
  execute: async ({ feature, casesCount }) => {
    const created: MockTestCase[] = [];
    for (let i = 1; i <= casesCount; i += 1) {
      const testCase: MockTestCase = {
        id: crypto.randomUUID(),
        name: `[SMOKE] ${feature} :: critical path #${i}`,
        tags: ['smoke', feature.toLowerCase().replace(/\s+/g, '-')],
        createdAt: Date.now(),
      };
      testCases.push(testCase);
      created.push(testCase);
    }

    return {
      feature,
      createdCount: created.length,
      testCases: created.map(({ id, name, tags }) => ({ id, name, tags })),
      note: 'Mock bulk creation completed',
    };
  },
});
