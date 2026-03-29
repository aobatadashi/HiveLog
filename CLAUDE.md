# CLAUDE.md — HiveLog Apiary MVP

## Identity
You are building **HiveLog**, an offline-capable PWA for commercial beekeepers to log hive events in the field. Read `requirements.md` (in this directory) as the single source of truth for product scope, data model, and screen specs. If anything in this file conflicts with `requirements.md`, the requirements file wins.

## Stack (locked — do not substitute)
| Layer | Tool | Notes |
|---|---|---|
| Frontend | Vite + React (vanilla JS, no TS) | Functional components + hooks only |
| Routing | react-router-dom | Hash router preferred for PWA compat |
| Backend / DB | Supabase (PostgreSQL) | Row Level Security on every table |
| Auth | Supabase Phone Auth | SMS OTP → 4-digit PIN (stored as password) |
| Offline queue | `idb` (IndexedDB wrapper) | All mutations queued when offline |
| PWA / SW | `vite-plugin-pwa` | Precache app shell; background sync for queue |
| Hosting | Vercel (free tier) | Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Styling | Vanilla CSS (single stylesheet or CSS modules) | NO Tailwind, NO component libraries |

## Critical UX Constraints
This app is used **outdoors in direct sunlight** by operators wearing **beekeeping gloves and veils**.
- Touch targets: minimum 56×56 px; prefer 64×64 px or larger.
- Font sizes: body ≥ 18px, headings ≥ 24px, buttons ≥ 20px bold.
- Contrast: WCAG AAA (7:1) for all text. Use a dark-on-light or light-on-dark high-contrast palette.
- Interactions: one-tap wherever possible. No drag-and-drop, no swipe gestures, no hover states.
- Typing: minimize keyboard use. The only free-text field in v1 is the optional notes box on the Log Event screen.
- Feedback: every tap must produce immediate visual feedback (color change, brief animation, or toast). Users in gloves can't feel haptic feedback.

## File Structure (expected)
```
hivelog/
├── CLAUDE.md              ← you are here
├── requirements.md        ← product spec (read first)
├── supabase_schema.sql    ← generated DB schema + RLS policies
├── .env.local             ← (user creates manually) Supabase keys
├── index.html
├── vite.config.js
├── package.json
├── public/
│   └── icons/             ← PWA icons (192×192, 512×512)
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css           ← global styles / design tokens
    ├── supabaseClient.js   ← single Supabase init
    ├── lib/
    │   ├── offlineQueue.js ← IndexedDB queue (idb)
    │   └── sync.js         ← background sync logic
    ├── hooks/
    │   └── useAuth.js      ← auth state hook
    ├── pages/
    │   ├── Login.jsx
    │   ├── Home.jsx        ← yard list
    │   ├── YardView.jsx    ← colony list for a yard
    │   ├── HiveView.jsx    ← event history for a colony
    │   ├── LogEvent.jsx    ← big event-type buttons + optional notes
    │   └── Settings.jsx
    └── components/
        ├── YardCard.jsx
        ├── ColonyCard.jsx
        ├── EventRow.jsx
        └── OfflineBanner.jsx  ← persistent banner when device is offline
```

## Auth Flow (exact sequence)
1. **First time:** Phone number → SMS OTP (6-digit) → verify → prompt to set 4-digit PIN → PIN saved as Supabase password via `supabase.auth.updateUser({ password: pin })`.
2. **Return visits:** Phone number + 4-digit PIN → `supabase.auth.signInWithPassword({ phone, password: pin })`.
3. **Forgot PIN:** Re-verify via SMS OTP → set new PIN.
4. No email anywhere. No social logins. No magic links.

## Database Rules
- Three tables only: `yards`, `colonies`, `events`. Schema defined in `requirements.md` §4.
- Generate all SQL (CREATE TABLE + RLS policies) into `supabase_schema.sql` at the project root.
- RLS: every policy scoped to `auth.uid()`. Users must never see another user's data.
- Use `gen_random_uuid()` for primary keys (default in modern Supabase).
- Cascade: deleting a yard cascades to its colonies and their events.

## Offline-First Rules
1. **Read path:** On app load, fetch from Supabase and hold in React state. If fetch fails (offline), show last-known state from IndexedDB cache.
2. **Write path:** Every mutation (create yard, create colony, log event) is first written to an IndexedDB queue, then attempted against Supabase. If the network call fails, the item stays queued.
3. **Sync:** Register a service worker `sync` event (`workbox-background-sync` via `vite-plugin-pwa`). When connectivity returns, the SW drains the queue FIFO and pushes to Supabase. Show a brief toast on successful sync.
4. **Conflict resolution:** Last-write-wins is acceptable for v1.
5. **OfflineBanner component:** A persistent top banner appears whenever `navigator.onLine === false` (and on the `offline` window event). It disappears on the `online` event.

## Scope Fence — v1 ONLY (do NOT build these)
- Push notifications
- Crew / team management / shared yards
- Reporting, data exports, or analytics dashboards
- Photo uploads or camera integration
- Equipment tracking
- Pollination contracts
- Map view
- Admin panel
- TypeScript (keep vanilla JS)

If you are tempted to add anything not in `requirements.md`, **stop and ask first**.

## Code Quality
- No `console.log` left in production code. Use a simple logger wrapper or remove before commit.
- Every Supabase call must have error handling with user-facing feedback (toast or inline message).
- Service worker registration goes in its own file, not inlined into `main.jsx`.
- Keep bundle size minimal — no unnecessary dependencies beyond the four listed in the stack table.

## Environment Variables
The app expects two env vars (user sets these in `.env.local` and in Vercel):
```
VITE_SUPABASE_URL=<project_url>
VITE_SUPABASE_ANON_KEY=<anon_public_key>
```

## Commands
```bash
npm run dev       # local dev server (port 5173)
npm run build     # production build
npm run preview   # preview prod build locally
```
