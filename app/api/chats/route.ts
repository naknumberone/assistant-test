import { listChats } from "@/lib/chat-store";

export async function GET() {
  const chats = await listChats();
  return Response.json(chats);
}
