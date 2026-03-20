# PilotIQ — Formation ATPL Intelligente

Proto de démonstration pour présentation aux écoles et à Mermoz.

## Stack
- **Next.js 15** (App Router)
- **Tailwind CSS 3** — thème cockpit dark
- **Claude API** (claude-sonnet-4) — génération de cours, QCM, examens, coach IA
- **pdf-parse** — extraction de texte depuis les manuels PDF

## Fonctionnalités
1. **Upload PDF** — Parse le manuel, extrait les sections, détecte la table des matières
2. **Cours IA** — Génère un cours structuré en streaming depuis le contenu du PDF
3. **QCM adaptatifs** — 5 questions générées par Claude depuis le document
4. **Examen blanc** — 15 questions avec chronomètre 30 min, seuil EASA 75%
5. **Coach IA** — Analyse la progression, identifie les lacunes, recommande les prochains modules

## Installation locale

```bash
git clone ...
cd pilotiq
npm install

# Créer le fichier .env.local
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

npm run dev
# → http://localhost:3000
```

## Déploiement Vercel (5 minutes)

```bash
npm install -g vercel
vercel

# Dans le dashboard Vercel → Settings → Environment Variables
# Ajouter : ANTHROPIC_API_KEY = sk-ant-...
```

## Déploiement production

```bash
vercel --prod
```

## Structure du projet

```
pilotiq/
├── app/
│   ├── page.tsx              # Interface principale (SPA)
│   ├── globals.css           # Thème cockpit
│   ├── layout.tsx
│   └── api/
│       ├── parse/route.ts    # Parsing PDF
│       ├── generate/route.ts # Cours IA (streaming)
│       ├── quiz/route.ts     # Génération QCM
│       ├── exam/route.ts     # Examen blanc
│       └── coach/route.ts    # Analyse progression
├── .env.local                # ANTHROPIC_API_KEY
└── README.md
```

## Variables d'environnement

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (obligatoire) |

## Note légale
Ce proto utilise des PDF uploadés par l'utilisateur. Aucun contenu Mermoz n'est hébergé.
Pour la commercialisation, un accord de licence avec Mermoz est recommandé.
