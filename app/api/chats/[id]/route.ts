import type { NextRequest } from "next/server";
import { loadChat } from "@/lib/chat-store";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/chats/[id]">,
) {
  const { id } = await ctx.params;
  const messages = await loadChat(id);

  if (!messages) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json({ messages });
}
