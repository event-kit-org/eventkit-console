# eventkit-console

The eventKit console, for clients (event managers): sign up, create events, set
up the portal, manage teams, payments, links and staff. A React + Vite app that
talks only to the public eventKit API, through its own typed client (`src/api`).

Participants have no eventKit accounts. The team leader registers the whole
team through a registration link on the event's portal
([`eventkit-portal`](../eventkit-portal)); each member gets a participant ID, a
QR code and a personal link (`/me/{token}`). Volunteers and judges sign up
through a staff link and sign in on the portal.

## Run it

```bash
cp .env.example .env   # VITE_PLATFORM_API_KEY must match the API's PLATFORM_API_KEY
npm install
npm run dev            # http://localhost:5173 (proxies /api to localhost:4000)
```

Types come from the API's OpenAPI spec, never written by hand:

```bash
npm run gen:api        # reads ../eventkit-core/openapi.json by default
OPENAPI_SPEC=/path/to/openapi.json npm run gen:api
```

CI fails when `src/api/schema.d.ts` no longer matches `eventkit-core`'s committed
spec.

## Deploy

A Vercel project with this repo as its root (framework: Vite). Set
`VITE_API_URL` to the API (`eventkit-serverless` or `eventkit-api`) and
`VITE_PLATFORM_API_KEY` to the API's `PLATFORM_API_KEY`.

## Scripts

| Script                               | What it does                              |
| ------------------------------------ | ----------------------------------------- |
| `npm run dev`                        | Dev server                                |
| `npm test` / `npm run test:coverage` | Vitest + Testing Library + MSW (90% gate) |
| `npm run lint` / `npm run typecheck` | oxlint, tsc                               |
| `npm run build`                      | Production build into `dist/`             |
| `npm run gen:api`                    | Regenerate `src/api/schema.d.ts`          |

## Notes

- Times are stored in UTC and always shown in IST.
- The service worker caches only the app shell. API responses are never cached.
- Uploads go straight to the R2 bucket, whose CORS rule allows every origin by
  default (club portals live on their own domains). To restrict it, list the
  origins in `eventkit-core`: `WEB_ORIGINS=... npm run storage:init`.
- Built on [shadcn/ui](https://ui.shadcn.com) (radix-nova style, neutral theme,
  `components.json`): a collapsible sidebar with the event's sections,
  breadcrumbs, and light / dark / system themes from the account menu. Add
  components with `npx shadcn@latest add <name>`; they land in
  `src/components/ui/`, which is left out of the coverage gate. Change the
  colours in `src/index.css` when the design arrives.
