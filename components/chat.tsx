'use client';

import {
  Attachment,
  AttachmentPreview,
  Attachments,
  type AttachmentData,
} from '@/components/ai-elements/attachments';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/components/ai-elements/confirmation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  getToolName,
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
  type ToolUIPart,
  type DynamicToolUIPart,
} from 'ai';
import { MessageSquareIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const CHAT_NOT_FOUND = 'CHAT_NOT_FOUND';

async function fetchChatMessages(id: string): Promise<UIMessage[]> {
  const res = await fetch(`/api/chats/${id}`);
  if (res.status === 404) {
    throw new Error(CHAT_NOT_FOUND);
  }
  if (!res.ok) {
    throw new Error('Failed to load chat');
  }
  const data = (await res.json()) as { messages: UIMessage[] };
  return data.messages;
}

type ToolApprovalResponse = {
  id: string;
  approved: boolean;
  reason?: string;
};

function PromptInputAttachmentsDisplay() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
        </Attachment>
      ))}
    </Attachments>
  );
}

function MessageAttachments({ message }: { message: UIMessage }) {
  const attachments: AttachmentData[] = [];

  for (const [index, part] of message.parts.entries()) {
    if (isFileUIPart(part) || part.type === 'source-document') {
      attachments.push({ ...part, id: `${message.id}-${index}` });
    }
  }

  if (attachments.length === 0) {
    return null;
  }

  return (
    <Attachments variant="grid">
      {attachments.map((attachment) => (
        <Attachment data={attachment} key={attachment.id}>
          <AttachmentPreview />
        </Attachment>
      ))}
    </Attachments>
  );
}

function ToolPart({
  part,
  onToolApprovalResponse,
}: {
  part: ToolUIPart | DynamicToolUIPart;
  onToolApprovalResponse: (options: ToolApprovalResponse) => void;
}) {
  const openByDefault = part.state !== 'output-available';

  return (
    <Tool defaultOpen={openByDefault}>
      {part.type === 'dynamic-tool' ? (
        <ToolHeader
          state={part.state}
          toolName={part.toolName}
          type={part.type}
        />
      ) : (
        <ToolHeader
          state={part.state}
          title={getToolName(part)}
          type={part.type}
        />
      )}
      <ToolContent>
        {part.input != null ? <ToolInput input={part.input} /> : null}
        <Confirmation approval={part.approval} state={part.state}>
          <ConfirmationRequest>
            <ConfirmationTitle>
              Это действие требует подтверждения пользователя.
            </ConfirmationTitle>
            <ConfirmationActions>
              <ConfirmationAction
                onClick={() => {
                  if (!part.approval?.id) return;
                  onToolApprovalResponse({
                    id: part.approval.id,
                    approved: false,
                    reason: 'Rejected by user',
                  });
                }}
                size="sm"
                variant="outline"
              >
                Отклонить
              </ConfirmationAction>
              <ConfirmationAction
                onClick={() => {
                  if (!part.approval?.id) return;
                  onToolApprovalResponse({
                    id: part.approval.id,
                    approved: true,
                  });
                }}
                size="sm"
              >
                Подтвердить
              </ConfirmationAction>
            </ConfirmationActions>
          </ConfirmationRequest>
          <ConfirmationAccepted>
            <ConfirmationTitle>Действие подтверждено.</ConfirmationTitle>
          </ConfirmationAccepted>
          <ConfirmationRejected>
            <ConfirmationTitle>Действие отклонено.</ConfirmationTitle>
          </ConfirmationRejected>
        </Confirmation>
        <ToolOutput errorText={part.errorText} output={part.output} />
      </ToolContent>
    </Tool>
  );
}

function MessageParts({
  message,
  onToolApprovalResponse,
}: {
  message: UIMessage;
  onToolApprovalResponse: (options: ToolApprovalResponse) => void;
}) {
  const reasoningParts = message.parts.filter(isReasoningUIPart);
  const reasoningText = reasoningParts.map((part) => part.text).join('\n');
  const isReasoningStreaming = reasoningParts.some(
    (part) => part.state === 'streaming',
  );

  return (
    <>
      {reasoningText ? (
        <Reasoning isStreaming={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      ) : null}

      <MessageAttachments message={message} />

      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;

        if (isToolUIPart(part)) {
          return (
            <ToolPart
              key={key}
              onToolApprovalResponse={onToolApprovalResponse}
              part={part}
            />
          );
        }

        if (isTextUIPart(part)) {
          return <MessageResponse key={key}>{part.text}</MessageResponse>;
        }

        return null;
      })}
    </>
  );
}

export default function Chat({ id }: { id: string }) {
  const router = useRouter();

  const { data, isLoading, isError, error } = useQuery<UIMessage[]>({
    queryKey: ['chat', id],
    queryFn: () => fetchChatMessages(id),
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message === CHAT_NOT_FOUND) return false;
      return failureCount < 3;
    },
  });

  useEffect(() => {
    if (isError && error instanceof Error && error.message === CHAT_NOT_FOUND) {
      router.replace('/chat');
    }
  }, [isError, error, router]);

  if (isLoading || !data) {
    return <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col" />;
  }

  return <ChatView id={id} initialMessages={data} />;
}

function ChatView({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: UIMessage[];
}) {
  const queryClient = useQueryClient();

  const { messages, sendMessage, status, stop, addToolApprovalResponse } =
    useChat({
      id,
      messages: initialMessages,
      onFinish: () => {
        void queryClient.invalidateQueries({ queryKey: ['chats'] });
      },
      sendAutomaticallyWhen: ({ messages }) =>
        lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
      transport: new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest({
          messages,
          id,
        }: {
          messages: UIMessage[];
          id: string;
        }) {
          return {
            body: {
              message: messages[messages.length - 1],
              id,
            },
          };
        },
      }),
    });

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text.trim() && !message.files?.length) {
      return;
    }

    sendMessage({
      text: message.text || 'Sent with attachments',
      files: message.files,
    });
  }

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
      <Conversation className="min-h-0 flex-1 [scrollbar-gutter:stable]">
        <ConversationContent className="px-4 py-6 pr-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              description="Опишите задачу, и агент начнет работу"
              icon={<MessageSquareIcon />}
              title="Чат готов"
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <MessageParts
                    message={message}
                    onToolApprovalResponse={addToolApprovalResponse}
                  />
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        className="bg-background px-3 pb-3 pt-2"
        globalDrop
        multiple
        onSubmit={handleSubmit}
      >
        <PromptInputBody className="space-y-2">
          <PromptInputAttachmentsDisplay />
          <PromptInputTextarea
            className="min-h-12"
            placeholder="Напишите сообщение..."
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
                <PromptInputActionAddScreenshot />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          </PromptInputTools>
          <PromptInputSubmit onStop={stop} status={status} />
        </PromptInputFooter>
      </PromptInput>
    </main>
  );
}
