# Feed

Inventory + ingredient ingestion playground built with the Next.js App Router, Prisma (SQLite), and AI-assisted helpers (OCR + recipe ideation). Includes manual entry, barcode product lookup via OpenFoodFacts, receipt OCR (Gemini), and recipe idea generation (OpenAI). Designed to be simple to extend while exploring data ingestion patterns.

---
## Features
- Ingredient storage (SQLite via Prisma) with CRUD API
- Manual add form with quantity/unit normalization
- Barcode lookup (OpenFoodFacts) with smart name + quantity/unit guessing
- Receipt OCR endpoint (Gemini) with resilient JSON parsing + fallback data when API/key unavailable
- Recipe idea generation using OpenAI (with strict JSON shaping + fallback)
- Lightweight client state synced to server
- Stronger runtime validation / defensive parsing (no `any`)

---
## Tech Stack
- **Framework:** Next.js (App Router, Route Handlers)
- **Runtime:** Node.js (default) — not using edge yet because of AI SDK + Prisma
- **DB:** SQLite (development) via Prisma Client (easily swappable to Postgres)
- **AI:** Google Generative AI (Gemini 1.5 Flash) for OCR parsing, OpenAI (gpt-4o-mini) for recipes
- **HTTP Client:** Native fetch (indirect via AI libs) + axios (OpenFoodFacts lookup — may be replaced with fetch)
- **Package Manager:** Bun / npm / pnpm / yarn (choose one)

---
## Quick Start
```bash
# Install deps
bun install   # or npm install

# Set environment variables (copy .env.example if you create one)
export DATABASE_URL="file:./prisma/dev.db"   # default
# Optional:
# export GOOGLE_API_KEY=your_gemini_key
# export OPENAI_API_KEY=your_openai_key

# Run database migrations
npx prisma migrate dev --name init

# Start dev server
bun dev  # -> http://localhost:3000
```

Open http://localhost:3000 to use the UI.

### Prisma Studio (optional)
```bash
npx prisma studio
```

---
## Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | SQLite / database connection string |
| `GOOGLE_API_KEY` | No | Enables live Gemini OCR parsing (otherwise fallback list) |
| `OPENAI_API_KEY` | No | Enables recipe generation (otherwise fallback recipe) |

If AI keys are absent, endpoints degrade gracefully with deterministic fallback responses so the UI still works.

---
## Data Model
`prisma/schema.prisma`:
```prisma
model Ingredient {
  id        String   @id @default(cuid())
  name      String
  quantity  Float    @default(0)
  unit      String   @default("pcs")
  addedAt   DateTime @default(now())
}
```

---
## API Endpoints
All responses are JSON. Non-2xx returns an `{ error: string }` payload unless otherwise documented.

### Ingredients
- `GET /api/ingredients` → `Ingredient[]`
- `POST /api/ingredients` body: `{ name: string, quantity?: number, unit?: string }` → created Ingredient
- `PUT /api/ingredients` body: `{ id: string, name?, quantity?, unit? }` → updated Ingredient
- `DELETE /api/ingredients?id=...` → `{ ok: true }`

### Barcode Lookup
- `GET /api/barcode?code=EAN_OR_UPC`
Returns:
```json
{ "found": true, "name": "Product Name", "quantityGuess": 500, "unitGuess": "g" }
```
404 example if unknown: `{ "found": false }`
Errors: `{ "error": "Lookup failed" }`

_Current implementation fetches directly from OpenFoodFacts each request. See Caching Roadmap below for upcoming enhancements._

### OCR (Receipt Image → Ingredients)
- `POST /api/ocr`
  - Accepts `multipart/form-data` with `image` field OR JSON `{ imageBase64 }` (legacy/testing)
  - Success: `{ ingredients: [{ name, quantity, unit }, ...] }`
  - If Gemini key missing or parse failure: `{ note?|error?, ingredients: fallback[] }` still 200 to keep UX smooth.

### Recipe Ideas
- `POST /api/recipes` body: `{ ingredients: string[] }`
  - Success: `{ ideas: [{ id, title, ingredients: string[], steps: string[] }, ...] }`
  - Fallback: `{ ideas: [ ...1 item... ], note: "fallback used", error?: string }`

---
## Barcode Caching Roadmap
A multi-layer caching strategy is planned (not yet implemented in code):

**Planned Architecture**
1. Level 0: In-memory LRU (fast hot path) with TTL + stale-while-revalidate window.
2. Level 1: Persistent Prisma table `ProductCache` (survives restarts) storing raw OpenFoodFacts JSON, ETag, Last-Modified.
3. Upstream conditional requests using `If-None-Match` / `If-Modified-Since` to reduce bandwidth and respect freshness.
4. Negative caching (e.g., product not found) with shorter TTL.
5. Concurrency control (in-flight promise map) to prevent stampede.
6. Optional: Redis / external cache drop-in via abstracted interface if scaling horizontally.

**Draft Prisma Model** (future):
```prisma
model ProductCache {
  code          String   @id
  json          String
  etag          String?
  lastModified  String?
  fetchedAt     DateTime
  ttlSeconds    Int
  transformVersion Int
  failCount     Int      @default(0)
  lastAttemptAt DateTime @updatedAt
  name          String?
  brand         String?
  quantity      String?
  @@index(fetchedAt)
}
```

**Freshness Strategy**
- Base TTL: 24h
- Stale-While-Revalidate window: additional 24h (serve stale + async refresh)
- Hard expiry: 7d
- Force bypass: `GET /api/barcode?code=...&force=1`
- Response metadata (dev/debug): `cachedSource` (memory|db|network200|network304), `stale: boolean`

**Why This Matters**
- Reduces repeated remote calls
- Survives server restarts / deployments
- Allows polite use of OpenFoodFacts API
- Supports graceful degradation if upstream is down (serve stale)

---
## Local Development Notes
- Hot reload handles API route changes automatically
- Prisma Client is generated on demand; if types seem stale run:
  ```bash
  npx prisma generate
  ```
- For barcode testing use common codes (e.g., 737628064502 or 3017620422003)
- Without AI keys the UI still works (manual + barcode + fallback OCR + fallback recipe)

---
## Testing Ideas (Not Implemented Yet)
Potential future test layers:
- Unit test parsing helpers (quantity/unit guessing, OCR normalization)
- Contract tests for API route payload shapes
- Integration test with an in-memory SQLite DB

---
## Roadmap
- [ ] Implement Phase 1 caching (in-memory LRU + TTL)
- [ ] Add ProductCache table + persistence (Phase 2)
- [ ] Conditional requests & stale-while-revalidate (Phase 3)
- [ ] Metrics & debug flags (Phase 4)
- [ ] Negative + forced invalidation endpoints
- [ ] Optional Redis adapter for horizontal scale
- [ ] Add tests around parsing & caching logic

---
## Deployment

### Docker (Local or Server)
A `Dockerfile` and `docker-compose.yml` are provided.

#### Quick Run (SQLite persisted in named volume)
```bash
docker compose up --build -d
# Visit http://localhost:3000
```
Data (SQLite file) is stored in the `feed_data` volume.

#### Environment Variables
Edit `docker-compose.yml` or pass with `--env` flags. Example overriding AI keys:
```bash
docker compose run -e OPENAI_API_KEY=sk-... -e GOOGLE_API_KEY=... feed-web
```

#### Logs / Health
```bash
docker compose logs -f feed-web
```
Healthcheck hits `/api/ingredients` every 30s.

#### Rebuilding After Changes
```bash
docker compose build --no-cache feed-web && docker compose up -d
```

### Switching to Postgres (Optional)
1. Add a Postgres service to `docker-compose.yml`:
```yaml
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=feed
      - POSTGRES_PASSWORD=feed
      - POSTGRES_DB=feed
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
```
2. Update `prisma/schema.prisma` datasource:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
3. Set `DATABASE_URL` in compose for `feed-web`:
```
DATABASE_URL=postgresql://feed:feed@db:5432/feed
```
4. Run migrations in the container:
```bash
docker compose exec feed-web bunx prisma migrate deploy
```
5. Remove the SQLite volume mount (`- feed_data:/app/prisma`) if no longer needed.

### Production Notes
- Multi-stage build produces a small Bun runtime image.
- `prisma migrate deploy` runs on container start; ensure migrations are committed.
- Use an external volume or managed Postgres for durability in production.
- Set `NODE_ENV=production` (already in compose file).
- Consider adding a reverse proxy (Caddy / Traefik / Nginx) for TLS.

### Vercel

Vercel ready. Minimal config required.

Suggested build settings:
- Install Command: (auto)  
- Build Command: `next build`  
- Output: `.next`

Environment variables must be configured in the hosting platform dashboard.

---
## Contributing
Open a PR with focused changes. Keep endpoints small, validate inputs, prefer pure helpers for transformations, and document new env vars / schema changes in this README.

---
## License
Not specified. Add a license file before public release if needed.

---
## Appendix: Error Handling Principles
- Prefer returning usable fallback data (OCR & recipes) over hard failures to keep the flow unblocked.
- For create/update endpoints, fail fast with 4xx on validation; return 5xx only for unexpected server errors.
- Keep error messages generic externally to avoid leaking internals.

---
Feel free to extend or request additional documentation sections (e.g., metrics, auth, testing).