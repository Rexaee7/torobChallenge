import { NextResponse } from "next/server";
import { agentTurn, type AgentContext, type ChatMessage } from "@/lib/server/agent";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[]; context?: AgentContext };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "last message must be from user" }, { status: 400 });
  }
  try {
    const res = await agentTurn(messages, body.context ?? {});
    return NextResponse.json(res);
  } catch (e) {
    console.error("[agent]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
