# Music Recognizer

PWA voor muziekherkenning: neem een fragment op, herken het via ACRCloud, en volg live gesynchroniseerde songteksten mee. Landscape-only, installeerbaar.

## Setup

```bash
npm install
cp .env.example .env.local
```

Vul `.env.local` in met je ACRCloud Identify-project credentials (`ACR_ACCESS_KEY`, `ACR_ACCESS_SECRET`, `ACR_HOST`).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Microfoontoegang vereist HTTPS of `localhost`.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS, Framer Motion, Lucide React
- ACRCloud `/v1/identify` (server-side HMAC-signed, secret nooit naar de client)
- lrclib.net voor gesynchroniseerde songteksten

## Milestones

Zie de commit-geschiedenis: elke milestone (M0–M6) is een eigen conventional commit.
