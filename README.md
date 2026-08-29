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

De app draait onder een vast subpad (`basePath: "/music-player"` in `next.config.ts`, voor de deploy op `frederikhofman.be/music-player`). Open dus [http://localhost:3000/music-player](http://localhost:3000/music-player) — niet de root. Microfoontoegang vereist HTTPS of `localhost`.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS, Framer Motion, Lucide React
- ACRCloud `/v1/identify` (server-side HMAC-signed, secret nooit naar de client)
- lrclib.net voor gesynchroniseerde songteksten

## Deployen (Vercel, onder frederikhofman.be/music-player)

1. Maak een nieuw Vercel-project van deze GitHub-repo (`HofmanFrederik/Music-player`).
2. Zet in de Vercel-projectinstellingen → Environment Variables: `ACR_ACCESS_KEY`, `ACR_ACCESS_SECRET`, `ACR_HOST` (dezelfde waarden als in je lokale `.env.local` — nooit in de repo committen).
3. Deploy. Je krijgt een `*.vercel.app`-URL waar de app al op `/music-player` werkt.
4. Voeg in het Vercel-project van je hoofdsite (`frederikhofman.be`) een rewrite toe die `/music-player/:path*` doorstuurt naar die nieuwe deployment, bv. in `vercel.json`:
   ```json
   {
     "rewrites": [
       { "source": "/music-player/:path*", "destination": "https://<jouw-music-player-project>.vercel.app/music-player/:path*" }
     ]
   }
   ```
   Zonder toegang tot dat project kan ik deze stap niet voor je doen.

## Milestones

Zie de commit-geschiedenis: elke milestone (M0–M6) is een eigen conventional commit.
