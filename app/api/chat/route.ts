import {
  consumeStream,
  createAgentUIStreamResponse,
  createIdGenerator,
  InferAgentUIMessage,
  safeValidateUIMessages,
} from 'ai';
import { mainAgent } from './agents/main-agent';
import { loadChat, saveChat } from '@/lib/chat-store';

export const runtime = 'nodejs';

type ChatMessage = InferAgentUIMessage<typeof mainAgent>;

export async function POST(req: Request) {
  const {
    message,
    id,
  }: {
    message?: ChatMessage;
    id?: string;
  } = await req.json();

  if (!id) {
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  const previousMessages = await loadChat(id);
  const rawMessages = message != null
    ? [...previousMessages, message]
    : previousMessages;

  const result = await safeValidateUIMessages<ChatMessage>({
    messages: rawMessages,
  });
  const uiMessages = result.success ? result.data : [];

  return createAgentUIStreamResponse({
    agent: mainAgent,
    uiMessages,
    originalMessages: uiMessages,
    generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
    consumeSseStream: consumeStream,
    onFinish: ({ messages: completedMessages }) => {
      void saveChat({ chatId: id, messages: completedMessages });
    },
  });
}
