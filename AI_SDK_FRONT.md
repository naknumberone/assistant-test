# AI SDK на фронтенде: что реально даёт SDK в этом проекте

Документ фиксирует, что именно берёт на себя AI SDK на клиенте, если смотреть не на абстрактный пример из документации, а на текущий код проекта в `components/chat.tsx`.

Главная мысль: AI SDK здесь не просто отправляет `fetch` на `/api/chat`, а закрывает целый пласт инфраструктуры вокруг UI-сообщений, стриминга, tool approval и повторной отправки.

---

## 1. `useChat` — центральная точка клиентской логики

В проекте чат строится вокруг `useChat` из `@ai-sdk/react`:

```ts
const {
  messages,
  sendMessage,
  status,
  stop,
  addToolApprovalResponse,
  error,
  clearError,
  regenerate,
} = useChat({
  id: propId,
  messages: initialMessages,
  onFinish: ({ message, messages: completedMessages }) => { /* ... */ },
  sendAutomaticallyWhen: ({ messages }) =>
    lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
  transport: new DefaultChatTransport({ api: '/api/chat', ... }),
});
```

Из коробки хук даёт:

| Поле / метод | Что делает в проекте | Что без SDK пришлось бы делать вручную |
|---|---|---|
| `messages` | Хранит текущий массив `UIMessage[]` и обновляет его по мере стриминга | Держать свой `useState`, вручную парсить SSE и патчить сообщения по кускам |
| `sendMessage` | Создаёт новое user-message и отправляет его через transport | Самостоятельно собирать request body, добавлять файлы, синхронизировать optimistic state |
| `status` | Даёт состояние чата для кнопки submit/stop и общего UI | Вести отдельную state-machine чата |
| `stop` | Прерывает активный стрим | Держать `AbortController`, чистить состояние и обрабатывать незавершённый ответ |
| `addToolApprovalResponse` | Записывает ответ пользователя на approval-запрос инструмента | Самостоятельно мутировать tool-part и повторно отправлять его на сервер |
| `error` / `clearError` | Даёт ошибку чата и возможность сбросить её | Писать отдельный error-state и reset-логику |
| `regenerate` | Повторяет последний assistant-ответ | Самостоятельно вводить trigger regenerate и следить за правильным сообщением |

---

## 2. Актуальные статусы чата

В текущем SDK `ChatStatus` — это:

```ts
type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';
```

Это важно, потому что старые формулировки вроде `idle` / `awaiting` для нашего кода уже неверны.

В проекте статус напрямую пробрасывается в `PromptInputSubmit`:

```tsx
<PromptInputSubmit onStop={stop} status={status} />
```

Внутри UI это позволяет:

- показывать спиннер сразу после отправки (`submitted`)
- переключать кнопку в режим остановки во время генерации (`streaming`)
- возвращать обычную кнопку отправки после завершения (`ready`)
- показывать retry-сценарий при ошибке (`error`)

---

## 3. `DefaultChatTransport` скрывает transport layer

На клиенте используется `DefaultChatTransport`:

```ts
transport: new DefaultChatTransport({
  api: '/api/chat',
  prepareSendMessagesRequest({ messages }: { messages: UIMessage[] }) {
    return {
      body: {
        message: messages[messages.length - 1],
        id: propId,
      },
    };
  },
}),
```

Что он реально даёт:

- отправляет запрос в формате, который понимает `useChat`
- читает `ReadableStream<UIMessageChunk>` из ответа сервера
- преобразует чанки в обновляющийся `UIMessage[]`
- синхронизирует transport с внутренним состоянием `useChat`

Что определяем мы сами через `prepareSendMessagesRequest`:

- отправляем не всю историю, а только последнее сообщение
- передаём `id` чата отдельным прикладным полем
- сознательно отбрасываем SDK-поля вроде `trigger` и `messageId`

То есть транспортный слой SDK готовый, но прикладной shape request body у нас свой.

---

## 4. `UIMessage` и `parts` — единая модель для всего UI

На фронте проект рендерит не сырой текст, а `UIMessage.parts`.

Это позволяет в одном сообщении хранить и отображать:

- `text`
- `reasoning`
- `tool-*` и `dynamic-tool`
- `file`
- `source-document`
- другие part types, если появятся позже

В `components/chat.tsx` это выглядит так:

```tsx
const reasoningParts = message.parts.filter(isReasoningUIPart);

{message.parts.map((part, index) => {
  if (isToolUIPart(part)) {
    return <ToolPart part={part} ... />;
  }

  if (isTextUIPart(part)) {
    return <MessageResponse>{part.text}</MessageResponse>;
  }

  return null;
})}
```

Преимущество такого подхода: UI не разваливается на отдельные массивы вроде "обычные сообщения", "результаты инструментов", "thinking state", "attachments". Всё живёт внутри одного типизированного `UIMessage`.

---

## 5. Type guards позволяют рендерить части без ручного кастинга

Проект использует SDK type guards:

```ts
import {
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
} from 'ai';
```

Они дают сразу две вещи:

- чище код рендера
- корректное сужение типов в TypeScript

Примеры из проекта:

```ts
const reasoningParts = message.parts.filter(isReasoningUIPart);
```

```ts
if (isFileUIPart(part) || part.type === 'source-document') {
  attachments.push({ ...part, id: `${message.id}-${index}` });
}
```

```ts
if (isToolUIPart(part)) {
  return <ToolPart part={part} ... />;
}
```

Без этого пришлось бы писать собственные type guards и следить, чтобы они не расходились с SDK-типами.

---

## 6. Tool approval уже встроен в модель чата

Одна из самых полезных частей SDK в этом проекте — встроенный approval-flow.

На клиенте он сводится к двум вещам:

1. tool-part приходит в `messages` уже с состоянием `approval-requested`
2. по кнопке пользователь вызывает `addToolApprovalResponse(...)`

Пример:

```tsx
onToolApprovalResponse({
  id: part.approval.id,
  approved: true,
});
```

или

```tsx
onToolApprovalResponse({
  id: part.approval.id,
  approved: false,
  reason: 'Rejected by user',
});
```

После этого работает ещё одна встроенная часть SDK:

```ts
sendAutomaticallyWhen: ({ messages }) =>
  lastAssistantMessageIsCompleteWithApprovalResponses({ messages })
```

Это значит:

- пользователь отвечает на approval в UI
- SDK обновляет последний assistant-message
- как только все approval-ответы на месте, SDK сам инициирует повторную отправку

Без такого набора пришлось бы вручную:

- отслеживать, какие tool approval уже отвечены
- решать, когда именно делать повторный POST
- защищаться от двойной отправки
- синхронизировать локальное и серверное состояние tool-part'ов

---

## 7. `regenerate`, `error`, `clearError` дают готовый retry-flow

В проекте retry выглядит так:

```tsx
{error ? (
  <Alert>
    <Button
      onClick={() => {
        clearError();
        void regenerate();
      }}
    >
      Retry
    </Button>
  </Alert>
) : null}
```

Что здесь уже делает SDK:

- хранит ошибку последнего запроса
- позволяет очистить её
- повторяет последний assistant-response через `regenerate`

Наш backend при этом не различает обычный send и regenerate на уровне body, потому что `prepareSendMessagesRequest` оставляет только `{ message, id }`. Но с точки зрения UI это всё равно даёт готовый повторный запуск без ручной перепаковки истории.

---

## 8. Работа с metadata уже встроена в `onFinish`

После завершения ответа `useChat` отдаёт:

```ts
onFinish: ({ message, messages: completedMessages }) => {
  const metadata = message.metadata as { chatId?: string } | undefined;
  const serverChatId = metadata?.chatId;

  if (serverChatId && !propId) {
    queryClient.setQueryData(['chat', serverChatId], completedMessages);
    router.replace(`/chat/${serverChatId}`);
  }

  void queryClient.invalidateQueries({ queryKey: ['chats'] });
}
```

Здесь видно важную особенность AI SDK:

- `message.metadata` уже приехала и привязана к итоговому assistant-message
- фронт может использовать metadata без ручного парсинга SSE-событий `start` / `message-metadata` / `finish`

То есть transport и `useChat` скрывают низкоуровневую обработку чанков, а UI получает уже собранную структуру.

---

## 9. Attachments и message parts тоже встроены в поток

`sendMessage` в проекте умеет отправлять не только текст:

```ts
sendMessage({
  text: message.text || 'Sent with attachments',
  files: message.files,
});
```

Это удобно по двум причинам:

- SDK умеет включать файлы в модель UI-сообщения
- на чтении эти файлы возвращаются как `FileUIPart`, который можно рендерить теми же компонентами

В проекте вложения берутся из `message.parts` и показываются вместе с сообщением:

```ts
if (isFileUIPart(part) || part.type === 'source-document') {
  attachments.push({ ...part, id: `${message.id}-${index}` });
}
```

То есть вложения не живут в отдельной параллельной модели данных, а являются частью общего message contract.

---

## 10. Полезные утилиты SDK, которые проект реально использует

### `lastAssistantMessageIsCompleteWithApprovalResponses`

Готовый предикат для auto-submit после tool approval:

```ts
lastAssistantMessageIsCompleteWithApprovalResponses({ messages })
```

### `getToolName`

Нормализует имя инструмента для рендера обычных tool-parts:

```ts
title={getToolName(part)}
```

### `safeValidateUIMessages`

Используется на сервере для безопасной валидации истории и входящих сообщений:

```ts
const result = await safeValidateUIMessages({ messages: rawMessages });
```

Для фронта это тоже важно: клиент получает либо корректный `UIMessage[]`, либо пустой массив, а не частично сломанную структуру.

### `generateId` / `createIdGenerator`

Используются на сервере для chat/message IDs и избавляют от самодельной генерации идентификаторов.

---

## 11. Где заканчивается SDK и начинается наш код

AI SDK в этом проекте отвечает за:

- модель `UIMessage` / `UIMessagePart`
- чтение и сборку `UIMessageChunk` в сообщения
- хук `useChat`
- transport между клиентом и `/api/chat`
- tool approval и regenerate API
- status machine чата

Наш код отвечает за:

- прикладной request body `{ message, id }`
- хранение истории в `.chats`
- маршрутизацию по `chatId`
- UI-компоненты (`Tool`, `Reasoning`, `PromptInput`, `Confirmation`)
- решение, какие part types реально рендерить

Это хорошая граница ответственности: SDK закрывает протокол и состояние, а проект концентрируется на поведении и интерфейсе.

---

## 12. Связка с сервером

На сервере эту клиентскую модель дополняет `createAgentUIStreamResponse`:

```ts
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
```

Эта часть важна для фронта, потому что именно она производит тот stream protocol, который понимает `DefaultChatTransport` и `useChat`.

Именно поэтому на клиенте не нужно вручную:

- читать SSE-чанки
- сопоставлять `text-delta` и `tool-output-*` с сообщениями
- собирать metadata
- строить итоговый `UIMessage[]`

---

## Вывод

В текущем проекте AI SDK снимает с фронтенда почти всю сложную инфраструктуру AI-чата:

- стриминг и сборку сообщений
- хранение статуса чата
- tool approval flow
- regenerate flow
- типизированную модель message parts
- transport-слой между UI и сервером

Из-за этого код фронта действительно остаётся в основном про отображение `parts`, кнопки подтверждения, retry и навигацию по `chatId`, а не про низкоуровневую механику SSE и state synchronization.
