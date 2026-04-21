import type { NextRequest } from "next/server";
import { InvalidStoredChatError, loadChat } from "@/lib/chat-store";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/chats/[id]">,
) {
  const { id } = await ctx.params;
  let messages;
  try {
    messages = await loadChat(id);
  } catch (error) {
    if (error instanceof InvalidStoredChatError) {
      return Response.json(
        { error: "Stored chat is invalid and cannot be loaded" },
        { status: 422 },
      );
    }
    throw error;
  }

  if (!messages) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json({ messages });
}
