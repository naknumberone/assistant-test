import {
  consumeStream,
  createAgentUIStreamResponse,
  createIdGenerator,
  generateId,
  UIMessage,
  safeValidateUIMessages,
} from 'ai';
import { mainAgent } from './agents/main-agent';
import { loadChat, saveChat } from '@/lib/chat-store';

export const runtime = 'nodejs';

type ChatMessage = UIMessage;

function upsertIncomingMessage(
  previousMessages: UIMessage[],
  message?: UIMessage,
): UIMessage[] {
  if (!message) return previousMessages;

  const existingIndex = previousMessages.findIndex((m) => m.id === message.id);
  if (existingIndex === -1) return [...previousMessages, message];

  const next = previousMessages.slice();
  next[existingIndex] = message;
  return next;
}

export async function POST(req: Request) {
  const {
    message,
    id: incomingId,
  }: {
    message?: ChatMessage;
    id?: string;
  } = await req.json();

  const chatId = incomingId ?? generateId();

  const previousMessages = (await loadChat(chatId)) ?? [];
  const rawMessages = upsertIncomingMessage(previousMessages, message);

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
    abortSignal: req.signal,
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return { chatId };
      }
      return undefined;
    },
    onFinish: ({ messages: completedMessages }) => {
      void saveChat({ chatId, messages: completedMessages });
    },
  });
}
