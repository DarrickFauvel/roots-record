# Roots Record

A family vital records web app — preserve people, relationships, residences, and documents across generations. Private by design: each account sees only its own data.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript (`tsx` in dev, `tsc` in prod) |
| Server | Express |
| Templates | Eta (server-rendered HTML) |
| Reactivity | Datastar (SSE + signals, no client-side framework) |
| Auth | Better Auth (email + password) |
| Database | Turso (libSQL / SQLite) via `@libsql/client` |
| File storage | Cloudinary (private uploads, signed delivery URLs) |
| Styles | Plain CSS (custom properties, no framework) |
| Web Components | Light DOM custom elements (`confirm-dialog`, `qr-modal`, `theme-picker`) |
| PWA | Service worker with network-first CSS/JS, cache-first assets |

## Features

- **People** — vital records (birth, death, marriage dates/places, notes)
- **Relationships** — parents, spouses, children, siblings
- **Residences & Migration** — place, type, date range; inline editing
- **Documents & Photos** — upload to Cloudinary, signed private URLs
- **Family Tree** — descendant tree view with root selection
- **Search** — full-text search via FTS5
- **Themes** — 5 color themes persisted to localStorage
- **PWA** — installable, works offline (cached pages/assets)
- **Accessibility** — 18px base font, 48px touch targets, high-contrast WCAG AA colors, senior-friendly UI

## Getting Started

### Prerequisites

- Node.js 20+
- A [Turso](https://turso.tech) database
- A [Cloudinary](https://cloudinary.com) account

### Environment variables

Create a `.env` file:

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
BETTER_AUTH_SECRET=a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
PORT=3000
```

### Run locally

```bash
npm install
npm run dev        # tsx watch — auto-restarts on changes
```

### Build & deploy

```bash
npm run build      # tsc + copies schema.sql to dist/
npm start          # node dist/server.js
```

Deployed on [Railway](https://railway.app). The build step copies `schema.sql` to `dist/` so migrations run correctly in production.

## Project Structure

```
src/
  server.ts          # Express app + Eta setup
  auth.ts            # Better Auth config
  db/
    client.ts        # libSQL client
    migrate.ts       # Schema + auth migrations
  routes/
    pages.ts         # Full-page GET/POST routes
    people.ts        # /api/people SSE + CRUD
    relationships.ts # /api/relationships
    residences.ts    # /api/residences
    documents.ts     # /api/documents (Cloudinary)
    search.ts        # /api/search (FTS5)
    tree.ts          # /api/tree
  lib/
    auth-middleware.ts
    cloudinary.ts
    render.ts
    tree.ts
views/
  layout.eta         # Shell: nav, dialogs, web components
  home.eta           # Dashboard / welcome screen
  landing.eta        # Public landing page
  profile.eta        # Account settings
  people/
    list.eta
    form.eta
    profile.eta
  partials/
    residences.eta
    relationships.eta
    document-list.eta
    person-card.eta
  tree/index.eta
public/
  styles.css
  components.js      # Light DOM web components
  sw.js              # Service worker
```
