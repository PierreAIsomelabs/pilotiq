import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { chunks, topic } = await req.json();
  
  const context = chunks
    .slice(0, 8)
    .map((c: { text: string }) => c.text)
    .join("\n\n---\n\n");

  const stream = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    stream: true,
    messages: [
      {
        role: "user",
        content: `Tu es un formateur ATPL expert. Voici un extrait de manuel aéronautique :

---
${context}
---

Génère un cours structuré et pédagogique sur : "${topic || "le contenu principal de ce document"}".

Format :
# Titre du cours

## Introduction
(2-3 phrases d'accroche)

## Concepts clés
(liste des notions essentielles avec explications)

## Points importants pour l'examen
(bullet points des points critiques à retenir)

## Résumé
(synthèse en 3-4 phrases)

Sois précis, technique, et adapté au niveau ATPL. Utilise la terminologie aéronautique correcte.`,
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
