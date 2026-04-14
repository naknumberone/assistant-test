import { UIMessage, generateId, safeValidateUIMessages } from 'ai';
import { mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const CHATS_DIR = path.join(process.cwd(), '.chats');
mkdirSync(CHATS_DIR, { recursive: true });

export async function createChat(): Promise<string> {
  const id = generateId();
  await writeFile(path.join(CHATS_DIR, `${id}.json`), '[]');
  return id;
}

export async function loadChat(id: string): Promise<UIMessage[]> {
  try {
    const raw = await readFile(path.join(CHATS_DIR, `${id}.json`), 'utf8');
    const result = await safeValidateUIMessages({
      messages: JSON.parse(raw),
    });
    return result.success ? result.data : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<void> {
  await writeFile(
    path.join(CHATS_DIR, `${chatId}.json`),
    JSON.stringify(messages, null, 2),
  );
}
