import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { message, history, sessions, documentTitles } = await req.json();

  if (!message) {
    return new Response("No message", { status: 400 });
  }

  const sessionSummary = sessions?.length
    ? sessions.map((s: { type: string; score: number; total: number; date: string; topic: string; wrongTopics: string[] }) =>
        `${s.date}: ${s.type} sur "${s.topic}" — ${s.score}/${s.total} (${Math.round(s.score / s.total * 100)}%)${s.wrongTopics.length > 0 ? ` | Erreurs: ${s.wrongTopics.join(", ")}` : ""}`
      ).join("\n")
    : "Aucune session enregistrée.";

  const docList = documentTitles?.length
    ? documentTitles.join(", ")
    : "Aucun document chargé.";

  const messages: { role: "user" | "assistant"; content: string }[] = [];

  if (history?.length) {
    for (const h of history.slice(-10)) {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({ role: "user", content: message });

  const stream = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    stream: true,
    system: `Tu es un coach IA spécialisé dans la formation ATPL. Tu aides l'élève pilote à progresser.

Documents chargés: ${docList}

Historique des sessions:
${sessionSummary}

Tes rôles:
- Répondre aux questions sur l'ATPL et l'aéronautique
- Recommander quoi étudier en priorité basé sur les résultats
- Identifier les points faibles et proposer des stratégies
- Encourager et motiver
- Expliquer des concepts de manière simple

Sois concis, bienveillant et précis. Utilise le tutoiement. Réponds en français.`,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
