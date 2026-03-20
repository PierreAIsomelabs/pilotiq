import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { question, courseText, topic } = await req.json();

  if (!question) {
    return new Response("No question provided", { status: 400 });
  }

  const stream = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    stream: true,
    messages: [
      {
        role: "user",
        content: `Tu es un formateur ATPL expert. L'élève étudie le sujet : "${topic || "aéronautique"}".

Voici le cours qu'il vient de lire :
---
${(courseText || "").slice(0, 6000)}
---

L'élève pose la question suivante :
"${question}"

Réponds de manière claire, précise et pédagogique. Utilise des exemples concrets si possible. Reste dans le contexte ATPL.`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
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
