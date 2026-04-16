# AI SDK на фронтенде: анализ того, что вы получаете из коробки

## Введение

Vercel AI SDK (`ai` + `@ai-sdk/react`) — это библиотека, которая закрывает огромный пласт рутинной работы при создании AI-чатов. Без неё разработчику приходится вручную реализовывать стриминг ответов, парсинг Server-Sent Events, управление состоянием сообщений, обработку tool calls, отображение reasoning-блоков и десятки других вещей. AI SDK делает всё это за вас, предоставляя готовые хуки, типы и утилиты.

В этой статье разберём, какой именно шаблонный код AI SDK позволяет не писать, какие состояния и хелперы доступны из коробки, и почему это хороший выбор для AI-чатов.

---

## 1. `useChat` — один хук вместо сотен строк

Центральный элемент фронтенд-части AI SDK — хук `useChat` из `@ai-sdk/react`. Вот что он возвращает:

```ts
const { messages, sendMessage, status, stop, addToolApprovalResponse } = useChat({
  id,
  messages: initialMessages,
  onFinish: () => { /* ... */ },
  sendAutomaticallyWhen: ({ messages }) =>
    lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
  transport: new DefaultChatTransport({ api: '/api/chat', ... }),
});
```

### Что вы получаете без единой строчки своего кода:

| Возможность | Что делает `useChat` | Что пришлось бы писать вручную |
|---|---|---|
| **`messages`** | Реактивный массив сообщений, обновляемый в реальном времени по мере стриминга | Ручной стейт + парсинг SSE + инкрементальное обновление массива |
| **`sendMessage`** | Отправка сообщения с автоматической сериализацией, включая файлы | `fetch` + `FormData` + обработка ответа + обновление UI |
| **`status`** | Текущий статус чата (`streaming`, `awaiting`, `idle`, `error`) | Ручной стейт-машина с несколькими `useState` |
| **`stop`** | Остановка стриминга одним вызовом | `AbortController` + cleanup + обновление состояния |
| **`addToolApprovalResponse`** | Ответ на запрос подтверждения инструмента | Кастомный протокол + обработка в обе стороны |

### `sendAutomaticallyWhen` — автоматическая отправка по условию

```ts
sendAutomaticallyWhen: ({ messages }) =>
  lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
```

Эта одна строчка реализует сложную логику: когда пользователь подтверждает или отклоняет tool call, чат автоматически отправляет результат обратно серверу. Без AI SDK это потребовало бы:
- отслеживания состояния каждого tool approval
- проверки, все ли approval обработаны
- триггера повторной отправки
- защиты от двойной отправки

---

## 2. `DefaultChatTransport` — протокол стриминга из коробки

```ts
transport: new DefaultChatTransport({
  api: '/api/chat',
  prepareSendMessagesRequest({ messages, id }) {
    return { body: { message: messages[messages.length - 1], id } };
  },
})
```

`DefaultChatTransport` берёт на себя:

- **SSE-подключение** — установка соединения, парсинг потока событий, реконнект
- **Протокол сообщений** — сериализация/десериализация в формате, который понимает серверная часть AI SDK
- **Инкрементальное обновление** — по мере поступления токенов сообщение обновляется в реальном времени
- **Обработку ошибок** — таймауты, разрывы соединения, некорректные ответы

Без этого пришлось бы писать:
```ts
// ~80-120 строк вот такого кода:
const response = await fetch('/api/chat', { ... });
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  // парсинг SSE-формата
  // обработка каждого типа события
  // обновление стейта
  // ...
}
```

---

## 3. Типизированная модель сообщений: `UIMessage` и parts

AI SDK предоставляет единую типизированную модель сообщений `UIMessage`, где каждое сообщение состоит из типизированных частей (parts):

```ts
type UIMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<
    | { type: 'text'; text: string }
    | { type: 'reasoning'; text: string; state: 'streaming' | 'complete' }
    | { type: 'tool'; toolName: string; input: unknown; output: unknown; state: ToolState }
    | { type: 'file'; ... }
    | { type: 'source-url'; url: string; title?: string; sourceId: string }
    | { type: 'source-document'; ... }
    | { type: 'step-start'; ... }
    // ...
  >;
};
```

### Почему это важно

Без AI SDK разработчик сам придумывает структуру данных для сообщений. Обычно это заканчивается:
- Хрупкой структурой `{ role, content: string }`, которая не поддерживает tool calls
- Отдельными массивами для "обычных" сообщений и tool results
- Ad-hoc полями типа `isThinking`, `toolResult`, `sources`

AI SDK даёт **единую, расширяемую модель**, где каждый тип контента — reasoning, tool calls, файлы, источники — является first-class citizen.

### Type guards из коробки

```ts
import { isReasoningUIPart, isToolUIPart, isFileUIPart } from 'ai';

// Вместо ручных проверок:
message.parts.filter(isReasoningUIPart);  // TypeScript сужает тип автоматически
message.parts.filter(isToolUIPart);
```

Без этого пришлось бы писать и поддерживать свои type guards для каждого типа part.

---

## 4. Состояния tool calls: полный жизненный цикл

Одна из самых сложных частей AI-чатов — отображение tool calls. AI SDK определяет полный набор состояний:

```ts
type ToolState =
  | 'input-streaming'     // Параметры ещё приходят
  | 'input-available'     // Параметры получены, инструмент выполняется
  | 'output-available'    // Результат готов
  | 'output-error'        // Ошибка выполнения
  | 'approval-requested'  // Ждём подтверждения пользователя
  | 'approval-responded'  // Пользователь ответил
  | 'output-denied';      // Пользователь отклонил
```

Это позволяет точно отображать текущее состояние каждого инструмента:

```tsx
const statusLabels: Record<ToolState, string> = {
  'approval-requested': 'Awaiting Approval',
  'input-available':    'Running',
  'input-streaming':    'Pending',
  'output-available':   'Completed',
  'output-error':       'Error',
  'output-denied':      'Denied',
  'approval-responded': 'Responded',
};
```

### Tool Approval Flow

AI SDK предоставляет встроенный механизм подтверждения действий пользователем. На фронтенде это выглядит так:

```tsx
// Поле approval на ToolUIPart содержит всю нужную информацию
<Confirmation approval={part.approval} state={part.state}>
  <ConfirmationRequest>
    <ConfirmationActions>
      <ConfirmationAction onClick={() =>
        addToolApprovalResponse({ id: part.approval.id, approved: true })
      }>
        Подтвердить
      </ConfirmationAction>
    </ConfirmationActions>
  </ConfirmationRequest>
</Confirmation>
```

Без AI SDK пришлось бы:
1. Придумать протокол для передачи approval-запросов через SSE
2. Реализовать стейт-машину для каждого tool call
3. Написать механизм отправки ответа обратно на сервер
4. Синхронизировать состояние между клиентом и сервером

---

## 5. Reasoning (Extended Thinking) — поддержка из коробки

AI SDK типизирует reasoning-части сообщений и предоставляет их состояние:

```ts
const reasoningParts = message.parts.filter(isReasoningUIPart);
const reasoningText = reasoningParts.map(part => part.text).join('\n');
const isStreaming = reasoningParts.some(part => part.state === 'streaming');
```

Это позволяет строить UI reasoning-блоков (collapsible с анимацией, "Thinking..." шиммер, отображение длительности) без ручного парсинга потока.

---

## 6. `ChatStatus` — конечный автомат статусов

Тип `ChatStatus` из AI SDK даёт чёткие состояния чата:

```ts
type ChatStatus = 'idle' | 'streaming' | 'awaiting' | 'error';
```

Используется, например, для кнопки отправки/остановки:

```tsx
<PromptInputSubmit onStop={stop} status={status} />
```

Компонент автоматически переключается между иконкой отправки и иконкой стопа. Без AI SDK — минимум два `useState` и ручная логика переключения.

---

## 7. Утилиты, которые экономят время

### `generateId` — генерация уникальных ID

```ts
import { generateId, createIdGenerator } from 'ai';

const id = generateId();
const messageId = createIdGenerator({ prefix: 'msg', size: 16 });
```

### `safeValidateUIMessages` — валидация сообщений

```ts
const result = await safeValidateUIMessages({ messages: rawMessages });
const messages = result.success ? result.data : [];
```

Безопасная валидация массива сообщений с типизированным результатом. Критически важна при загрузке сохранённых чатов — структура сообщений могла измениться между версиями.

### `getToolName` — извлечение имени инструмента

```ts
import { getToolName } from 'ai';
// Корректно работает для обычных и dynamic tools
const name = getToolName(toolPart);
```

### `lastAssistantMessageIsCompleteWithApprovalResponses`

```ts
import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
```

Готовый предикат: "последнее сообщение ассистента завершено и все approval-запросы получили ответы". Логика, которую легко написать с ошибками.

---

## 8. Серверная часть: `createAgentUIStreamResponse`

На сервере AI SDK предоставляет `createAgentUIStreamResponse`, который:

```ts
return createAgentUIStreamResponse({
  agent: mainAgent,
  uiMessages,
  generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
  consumeSseStream: consumeStream,
  onFinish: ({ messages }) => {
    void saveChat({ chatId: id, messages });
  },
});
```

- Создаёт SSE-поток из работы агента
- Автоматически сериализует сообщения в формат, который понимает `useChat`
- Предоставляет callback `onFinish` с финальным состоянием сообщений
- Поддерживает multi-step агентов (tool loops) без дополнительного кода

---

## 9. Агентный фреймворк: `ToolLoopAgent`

```ts
import { ToolLoopAgent, stepCountIs } from 'ai';

const mainAgent = new ToolLoopAgent({
  model,
  tools: { weather, loadSkill, runTestOpsAgent },
  stopWhen: stepCountIs(10),
  instructions: '...',
});
```

Полноценный агентный цикл (вызов модели → tool call → результат → повторный вызов модели) реализуется в нескольких строчках. Без AI SDK это десятки строк рекурсивной логики с обработкой всех edge cases.

---

## 10. Что конкретно не нужно писать

Подведём итог. Вот код, который AI SDK позволяет **не писать**:

| Категория | Примерный объём без AI SDK |
|---|---|
| SSE-клиент с реконнектом и парсингом | ~100-150 строк |
| Стейт-менеджмент сообщений (CRUD + стриминг) | ~80-120 строк |
| Стейт-машина tool calls (7 состояний × UI) | ~150-200 строк |
| Tool approval протокол (клиент + сервер) | ~100-150 строк |
| Типы и type guards для всех part types | ~60-80 строк |
| Серверный SSE-стриминг из LLM | ~80-100 строк |
| Агентный цикл (tool loop) | ~100-150 строк |
| Валидация и генерация ID | ~30-40 строк |
| **Итого** | **~700-1000 строк** |

И это только инфраструктурный код, без учёта тестов и отладки edge cases.

---

## Заключение

AI SDK — это не просто обёртка над `fetch` + SSE. Это полноценный фреймворк, который:

1. **Определяет протокол** — единый формат обмена данными между клиентом и сервером
2. **Типизирует всё** — от сообщений до состояний tool calls, что ловит ошибки на этапе компиляции
3. **Управляет сложным состоянием** — стриминг, tool approval, multi-step агенты
4. **Предоставляет готовые примитивы** — хуки, type guards, утилиты, transport layer

Главное преимущество — разработчик фокусируется на **UI и бизнес-логике**, а не на инфраструктуре стриминга и протоколах обмена данными. Код чата в проекте занимает ~380 строк, включая весь UI. Без AI SDK тот же функционал потребовал бы 1500+ строк, значительная часть которых — хрупкий инфраструктурный код, который сложно тестировать и поддерживать.
