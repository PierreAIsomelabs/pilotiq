import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { metarData, flightType, route, etd } = await req.json();

  // Build weather summary for Claude
  const wxSummary = Object.entries(metarData as Record<string, { metar: string | null; taf: string | null; error?: string }>)
    .map(([icao, data]) => {
      if (data.error) return `${icao}: Données indisponibles (${data.error})`;
      return `${icao}:\n  METAR: ${data.metar || "N/A"}\n  TAF: ${data.taf || "N/A"}`;
    })
    .join("\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Tu es un météorologiste aéronautique et officier briefing. Analyse ces données météo et donne un briefing vol complet.

PARAMÈTRES :
- Route : ${route}
- Type de vol : ${flightType}
- Heure de départ estimée (ETD) : ${etd || "Non spécifiée"}

DONNÉES MÉTÉO BRUTES :
${wxSummary}

Réponds UNIQUEMENT en JSON valide :
{
  "go_nogo": "GO | NO-GO | GO avec conditions",
  "confidence": 85,
  "summary": "Résumé météo en 2 phrases",
  "stations": [
    {
      "icao": "LFXX",
      "role": "Départ|Destination|Alterne|En route",
      "conditions": "VMC|IMC|MVMC",
      "ceiling": "SKC / FEW025 / BKN018 / OVC010",
      "visibility": "10 km / 3000 m / CAVOK",
      "wind": "270/15kt / Calme",
      "temperature": "18°C / DP 12°C",
      "qnh": "1013 hPa",
      "significant": ["Remarque importante"],
      "vfr_ok": true,
      "ifr_ok": true
    }
  ],
  "hazards": [
    {
      "type": "VENT | ORAGE | PLAFOND | VISIBILITE | GIVRAGE | TURBULENCE | SIGMET",
      "severity": "low | medium | high",
      "description": "Description du danger",
      "affected": "Tronçon ou aérodrome concerné"
    }
  ],
  "recommendations": [
    "Recommandation concrète 1",
    "Recommandation concrète 2"
  ],
  "alternates_wx": "Conditions aux alternates",
  "trend": "Tendance sur les 3 prochaines heures",
  "vfr_minima_ok": true,
  "ifr_minima_ok": true
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return NextResponse.json(JSON.parse(clean));
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 500 });
  }
}
