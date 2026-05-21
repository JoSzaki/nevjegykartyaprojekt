# KártyaD – Névjegykártya projekt

## Státusz (2026-05-21)

### Kész
- Frontend szerkesztő + checkout funnel (`index.html`)
- Node.js/Express backend (`server.js`, port 3001)
- PostgreSQL tábla: `business_card_order` (changeset 420, db-migration PR #30 ✅ merged)
- PDF generálás checkout-kor, mentés `pdfs/` mappába, elérési út DB-be
- Resend visszaigazoló email (fire-and-forget)
- Redash query: **"Névjegykártyák"** – staging-en működik

### Függőben
- **db-migration PR #32** (`pdf_path` oszlop, changeset 424) – merge-elni kell, utána Dagger lefuttatja
- **GRANT a prod DB-n** – staging-en megvan, prod-on még nem (`permission denied` a Redash "Joszaki éles" datasource-on). A prod DB más hoston van mint a staging (`34.32.82.7`), a connection string ismeretlen – meg kell keresni (GCP Console / Render / env vars)
- **Resend API key** – be kell írni a `.env`-be (`RESEND_API_KEY=re_...`, a Vercel leadtowork env vars között van)
- **PDF link a Redash queryban** – `localhost:3001` helyett a publikus szerver URL-t kell beírni deployment után

### Helyi futtatás
```bash
cd ~/Desktop/coding/joszaki/nevjegykartyaprojekt
npm start          # http://localhost:3001
```

### .env szükséges értékek
```
DATABASE_URL=postgres://joszaki_graphql:Weigl01Csucsu@34.32.82.7:5432/joszaki_hu_staging
DATABASE_SSL=false
PORT=3001
RESEND_API_KEY=re_xxxxxxxxxxxx       # Vercel > leadtowork > env vars
EMAIL_FROM=KártyaD <noreply@kartyad.hu>
```
