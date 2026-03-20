import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { chunks, topic } = await req.json();

  const hasContent = Array.isArray(chunks) && chunks.length > 0 &&
    chunks.some((c: { text: string }) => c.text?.trim().length > 0);

  const context = hasContent
    ? chunks.slice(0, 8).map((c: { text: string }) => c.text).join("\n\n---\n\n")
    : "";

  const prompt = hasContent
    ? `Tu es un formateur ATPL expert. Voici un extrait de manuel aéronautique :

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

Sois précis, technique, et adapté au niveau ATPL. Utilise la terminologie aéronautique correcte.`
    : `Tu es un formateur ATPL expert. Le document fourni par l'élève est un PDF scanné (images) et le texte n'a pas pu être extrait.

Génère un cours structuré et pédagogique sur le sujet ATPL suivant : "${topic || "Sujet non spécifié — génère un cours sur les principes généraux de navigation aérienne"}".

Commence par indiquer à l'élève : "⚠ Le PDF semble être un document scanné (images). Le texte n'a pas pu être extrait automatiquement. Ce cours est généré à partir du sujet que vous avez sélectionné, sans le contenu du document. Pour de meilleurs résultats, utilisez un PDF avec du texte sélectionnable."

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

Sois précis, technique, et adapté au niveau ATPL. Utilise la terminologie aéronautique correcte.`;

  const stream = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    stream: true,
    messages: [
      {
        role: "user",
        content: prompt,
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
