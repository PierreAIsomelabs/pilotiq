import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { chunks, topic, mode, sectionTitle } = await req.json();

  const hasContent = Array.isArray(chunks) && chunks.length > 0 &&
    chunks.some((c: { text: string }) => c.text?.trim().length > 0);

  const context = hasContent
    ? chunks.slice(0, 8).map((c: { text: string }) => c.text).join("\n\n---\n\n")
    : "";

  const topicName = topic || "navigation aérienne";

  let prompt: string;

  if (mode === "exercises") {
    prompt = `Tu es un formateur ATPL expert. ${hasContent ? `Contexte du cours :\n---\n${context.slice(0, 4000)}\n---\n` : ""}
Génère exactement 3 exercices pratiques de difficulté progressive sur le sujet : "${topicName}".

Chaque exercice DOIT contenir des valeurs numériques réalistes et des calculs concrets. Exemples de types d'exercices :
- Calcul de dérive avec vent de travers (ex: vent 270/15kt, TAS 120kt, route 180°)
- Calcul de carburant (ex: consommation 35L/h, distance 280NM, GS 110kt)
- Conversion d'unités (hPa → inHg, °C → °F, NM → km)
- Calcul de descente (FL150, début descente à 3° de pente, GS 140kt)
- Temps de vol et ETA

Format pour chaque exercice :
### Exercice N — [Titre court]

**Énoncé :**
(données précises avec chiffres réels)

**Solution détaillée :**
(étapes de calcul numérotées avec résultat final en gras)

Sois rigoureux sur les chiffres. Utilise la terminologie OACI.`;
  } else if (mode === "example") {
    prompt = `Tu es un formateur ATPL expert. ${hasContent ? `Contexte du cours :\n---\n${context.slice(0, 3000)}\n---\n` : ""}
Pour la section de cours "${sectionTitle || topicName}", génère UN exemple concret et illustré tiré du monde réel de l'aviation.

L'exemple doit :
- Décrire une situation réelle (vol, incident, procédure) avec des détails concrets (aéroport, type avion, conditions météo, valeurs numériques)
- Expliquer comment le concept théorique s'applique dans cette situation
- Être court (150-250 mots maximum)

Format :
**Situation :** (description du scénario réel)

**Application :** (comment le concept théorique s'applique concrètement)

**Point clé :** (leçon à retenir en une phrase)`;
  } else if (hasContent) {
    prompt = `Tu es un formateur ATPL expert. Voici un extrait de manuel aéronautique :

---
${context}
---

Génère un cours structuré et pédagogique sur : "${topicName}".

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
  } else {
    prompt = `Tu es un formateur ATPL expert. Le document fourni par l'élève est un PDF scanné (images) et le texte n'a pas pu être extrait.

Génère un cours structuré et pédagogique sur le sujet ATPL suivant : "${topicName}".

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
  }

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
