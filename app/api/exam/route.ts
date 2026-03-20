import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { chunks, questionCount = 15, duration = 30 } = await req.json();

  const context = chunks
    .slice(0, 10)
    .map((c: { text: string }) => c.text)
    .join("\n\n---\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `Tu es un examinateur DGAC/EASA. Génère un examen blanc ATPL avec exactement ${questionCount} questions.

Contenu source :
---
${context}
---

Réponds UNIQUEMENT avec un JSON valide :
{
  "title": "Examen blanc — [Thème]",
  "duration": ${duration},
  "passMark": 75,
  "questions": [
    {
      "id": 1,
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "...",
      "difficulty": "medium",
      "topic": "...",
      "points": 1
    }
  ]
}

Règles strictes :
- Mix de difficultés : 30% easy, 50% medium, 20% hard
- Couvre différents aspects du document
- Questions réalistes d'examen ATPL EASA
- Seuil de réussite : 75% (norme EASA)
- Exactement ${questionCount} questions`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 500 });
  }
}
