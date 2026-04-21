import {
  consumeStream,
  createAgentUIStreamResponse,
  createIdGenerator,
  generateId,
  TypeValidationError,
  UIMessage,
  validateUIMessages,
} from 'ai';
import { mainAgent } from './agents/main-agent';
import { InvalidStoredChatError, loadChat, saveChat } from '@/lib/chat-store';

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

  let previousMessages: UIMessage[];
  try {
    previousMessages = (await loadChat(chatId)) ?? [];
  } catch (error) {
    if (error instanceof InvalidStoredChatError) {
      return Response.json(
        { error: 'Stored chat is invalid and cannot be resumed.' },
        { status: 422 },
      );
    }
    throw error;
  }

  const rawMessages = upsertIncomingMessage(previousMessages, message);

  let uiMessages: UIMessage[];
  try {
    uiMessages = await validateUIMessages<ChatMessage>({
      messages: rawMessages,
    });
  } catch (error) {
    if (error instanceof TypeValidationError) {
      return Response.json(
        { error: 'Incoming chat payload is invalid.' },
        { status: 400 },
      );
    }
    throw error;
  }

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
