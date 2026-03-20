import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface Waypoint {
  name: string;
  type: "aerodrome" | "navaid" | "vfr_point" | "fix" | "ctr_entry" | "ctr_exit" | "fl_change";
  icao?: string;
  lat?: number;
  lon?: number;
  altitude: string;
  heading?: number;
  distance?: string;
  elapsed?: string;
  actions: string[];
  radio?: { name: string; freq: string; type: string }[];
  airspace?: string;
  notes?: string;
}

export interface NavLog {
  title: string;
  flightType: string;
  totalDistance: string;
  estimatedTime: string;
  cruisingLevel: string;
  alternates: string[];
  fuelEstimate: string;
  sunriseSunset?: string;
  waypoints: Waypoint[];
  atcContacts: { phase: string; unit: string; freq: string; when: string }[];
  safetyAltitudes: { sector: string; msa: string }[];
  remarks: string[];
}

export async function POST(req: NextRequest) {
  const { departure, destination, waypoints, flightType, cruisingLevel, aircraft, chartContext } = await req.json();

  const waypointList = waypoints?.length > 0
    ? `Étapes intermédiaires : ${waypoints.join(" → ")}`
    : "Vol direct";

  const chartInfo = chartContext
    ? `\nContexte extrait de la carte OACI :\n${chartContext.slice(0, 4000)}`
    : "\nPas de carte uploadée — utilise tes connaissances générales des espaces aériens français.";

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `Tu es un officier d'opérations aériennes et instructeur de navigation ATPL. Génère un plan de vol et log de navigation détaillé.

PARAMÈTRES DU VOL :
- Départ : ${departure}
- Destination : ${destination}  
- ${waypointList}
- Type de vol : ${flightType}
- Niveau de croisière : ${cruisingLevel || "A définir selon les règles"}
- Aéronef : ${aircraft || "Avion léger monomoteur (PA28 ou C172)"}
${chartInfo}

Génère un JSON valide UNIQUEMENT, sans texte avant ou après :
{
  "title": "Vol ${departure} → ${destination}",
  "flightType": "${flightType}",
  "totalDistance": "XXX NM",
  "estimatedTime": "X h XX",
  "cruisingLevel": "FL/altitude recommandée",
  "alternates": ["ICAO1", "ICAO2"],
  "fuelEstimate": "XX L (XX min de réserve)",
  "sunriseSunset": "SR: HH:MM UTC / SS: HH:MM UTC (si nuit)",
  "waypoints": [
    {
      "name": "Nom du point",
      "type": "aerodrome|navaid|vfr_point|fix|ctr_entry|ctr_exit|fl_change",
      "icao": "LFXX (si aérodrome)",
      "altitude": "1500 ft AMSL / FL065 / etc.",
      "heading": 275,
      "distance": "45 NM",
      "elapsed": "00:28",
      "actions": [
        "Action précise à effectuer",
        "Vérification à faire"
      ],
      "radio": [
        {"name": "Paris Info", "freq": "125.700", "type": "INFO"},
        {"name": "Roissy APP", "freq": "119.250", "type": "APP"}
      ],
      "airspace": "Description de l'espace aérien traversé",
      "notes": "Note importante éventuelle"
    }
  ],
  "atcContacts": [
    {"phase": "Avant départ", "unit": "Nom du contrôle", "freq": "XXX.XXX", "when": "Au moins X min avant"},
    {"phase": "En route", "unit": "...", "freq": "...", "when": "..."}
  ],
  "safetyAltitudes": [
    {"sector": "Secteur départ", "msa": "2400 ft"},
    {"sector": "Secteur arrivée", "msa": "1800 ft"}
  ],
  "remarks": [
    "Remarque importante 1",
    "Point d'attention réglementaire"
  ]
}

Règles OBLIGATOIRES à respecter :
- VFR : plafond min 1500 ft AGL, visibilité min 5 km (SERA)
- Niveaux de croisière VFR : règle semi-circulaire (cap 000-179° → FL impair + 500 ft, 180-359° → FL pair + 500 ft)
- Niveaux IFR : règle semi-circulaire (cap 000-179° → FL impair, 180-359° → FL pair)
- Identifier toutes les CTR/TMA/CTA à traverser avec leurs plafonds/planchers
- Mentionner chaque changement de fréquence radio obligatoire
- Indiquer les altitudes de sécurité secteur par secteur (MSA)
- VFR de nuit : vérifier FIR nuit, piste balisée, équipements requis
- Transit CTR : décrire la procédure de demande et le point d'entrée standard
- Chaque waypoint doit avoir au minimum 2-3 actions concrètes`,
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
