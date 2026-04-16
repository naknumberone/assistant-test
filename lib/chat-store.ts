import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { UIMessage, generateId, safeValidateUIMessages } from "ai";

const CHATS_DIR = path.join(process.cwd(), ".chats");
const DEFAULT_TITLE = "New chat";

type ChatRecord = {
  id: string;
  title: string;
  messages: UIMessage[];
};

function assertValidId(id: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Invalid chat id");
  }
}

const chatFilePath = (id: string) => path.join(CHATS_DIR, `${id}.json`);

async function ensureChatsDir(): Promise<void> {
  await fs.mkdir(CHATS_DIR, { recursive: true });
}

function titleFromMessages(messages: UIMessage[]): string {
  const text = messages
    .find((m) => m.role === "user")
    ?.parts.find((p) => p.type === "text");

  if (text && "text" in text && typeof text.text === "string") {
    const title = text.text.trim().slice(0, 100);
    return title || DEFAULT_TITLE;
  }

  return DEFAULT_TITLE;
}

async function readChat(id: string): Promise<ChatRecord | null> {
  assertValidId(id);

  try {
    const raw = await fs.readFile(chatFilePath(id), "utf8");
    const data = JSON.parse(raw) as Partial<ChatRecord>;
    if (!Array.isArray(data.messages)) return null;

    return {
      id,
      title: typeof data.title === "string" && data.title.trim() ? data.title : DEFAULT_TITLE,
      messages: data.messages,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeChat(record: ChatRecord): Promise<void> {
  assertValidId(record.id);
  await ensureChatsDir();
  await fs.writeFile(
    chatFilePath(record.id),
    JSON.stringify(record, null, 2),
    "utf8",
  );
}

export async function createChat(): Promise<string> {
  const id = generateId();
  await writeChat({
    id,
    title: DEFAULT_TITLE,
    messages: [],
  });
  return id;
}

export async function loadChat(id: string): Promise<UIMessage[] | null> {
  const record = await readChat(id);
  if (!record) {
    return null;
  }

  const result = await safeValidateUIMessages({
    messages: record.messages,
  });

  return result.success ? result.data : [];
}

export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<void> {
  await writeChat({
    id: chatId,
    title: titleFromMessages(messages),
    messages,
  });
}

export async function listChats(): Promise<{ id: string; title: string }[]> {
  await ensureChatsDir();
  const files = await fs.readdir(CHATS_DIR);
  const chats = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        try {
          const raw = await fs.readFile(path.join(CHATS_DIR, file), "utf8");
          const record = JSON.parse(raw) as Partial<ChatRecord>;

          return {
            id:
              typeof record.id === "string"
                ? record.id
                : file.replace(/\.json$/, ""),
            title:
              typeof record.title === "string" && record.title.trim()
                ? record.title
                : DEFAULT_TITLE,
          };
        } catch {
          return null;
        }
      }),
  );

  return chats.filter((chat): chat is { id: string; title: string } => Boolean(chat));
}
