import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface SessionResult {
  type: "quiz" | "exam";
  score: number;
  total: number;
  date: string;
  topic: string;
  wrongTopics: string[];
}

export async function POST(req: NextRequest) {
  const { sessions, documentTitle }: { sessions: SessionResult[]; documentTitle: string } = await req.json();

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({
      readyForExam: false,
      globalScore: 0,
      message: "Aucune session enregistrée.",
      recommendations: [],
      weakTopics: [],
      strengths: [],
    });
  }

  const summary = sessions.map(s => 
    `${s.type === "exam" ? "Examen blanc" : "QCM"} "${s.topic}" le ${s.date}: ${s.score}/${s.total} (${Math.round(s.score/s.total*100)}%) — Lacunes: ${s.wrongTopics.join(", ") || "aucune"}`
  ).join("\n");

  const avgScore = sessions.reduce((acc, s) => acc + (s.score / s.total * 100), 0) / sessions.length;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Tu es un coach de formation ATPL expert. Analyse les résultats de cet étudiant sur le document "${documentTitle}" :

${summary}

Score moyen : ${Math.round(avgScore)}%
Seuil EASA pour l'examen officiel : 75%

Réponds UNIQUEMENT en JSON valide :
{
  "readyForExam": ${avgScore >= 75},
  "globalScore": ${Math.round(avgScore)},
  "verdict": "une phrase de verdict clair (ex: Pas encore prêt / Prêt pour l'examen officiel)",
  "message": "Message personnalisé encourageant de 2-3 phrases",
  "weakTopics": ["liste des thèmes à retravailler"],
  "strengths": ["liste des points forts"],
  "recommendations": [
    {"priority": "high", "action": "Action concrète à faire", "reason": "Pourquoi"},
    {"priority": "medium", "action": "Action complémentaire", "reason": "Pourquoi"}
  ],
  "nextModule": "Suggestion du prochain module ATPL à aborder après celui-ci",
  "estimatedReadyDate": "Estimation du temps avant d'être prêt (ex: 2 semaines)"
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  
  try {
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return NextResponse.json(JSON.parse(clean));
  } catch {
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
