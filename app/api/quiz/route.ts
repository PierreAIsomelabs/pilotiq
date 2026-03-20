import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 90;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface Question {
  id: number;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
}

export async function POST(req: NextRequest) {
  const { chunks, count = 5, difficulty = "mixed" } = await req.json();

  const context = chunks
    .slice(0, 6)
    .map((c: { text: string }) => c.text)
    .join("\n\n---\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Tu es un examinateur ATPL EASA. Génère exactement ${count} questions QCM à partir de ce contenu de manuel :

---
${context}
---

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après, sous cette forme exacte :
{
  "questions": [
    {
      "id": 1,
      "question": "Question complète ici ?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Explication détaillée de la bonne réponse",
      "difficulty": "medium",
      "topic": "Thème de la question"
    }
  ]
}

Règles :
- "correct" est l'index (0-3) de la bonne réponse
- Difficulté : "${difficulty === "mixed" ? "varie entre easy, medium, hard" : difficulty}"
- Questions précises, techniques, niveau ATPL réel
- Les 4 options doivent être plausibles
- Explication de 1-2 phrases`,
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
