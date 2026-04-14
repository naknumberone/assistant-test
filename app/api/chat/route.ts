import { createAgentUIStreamResponse, UIMessage } from 'ai';
import { mainAgent } from './agents/main-agent';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  return createAgentUIStreamResponse({
    agent: mainAgent,
    uiMessages: messages,
  });
}
