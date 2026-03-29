# Project: HiveLog

HiveLog is an offline-capable Progressive Web App (PWA) built for beekeepers to log apiary events in the field. It uses Vite, React, and Supabase.

## Architecture & Stack
- **Frontend:** React (Vanilla) + Vite
- **Backend/DB:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Offline Sync:** `vite-plugin-pwa` with Service Workers and IndexedDB (`idb`).
- **Hosting:** Vercel

## Code Style & Conventions
- **UI/UX:** Prioritize massive touch targets, high contrast, and minimal typing. The app is used outdoors in direct sunlight by users wearing beekeeping gloves and veils.
- **Components:** Functional components with React Hooks.
- **Styling:** Vanilla CSS or minimal inline styles to keep it lightweight. No heavy UI libraries (like Material UI or Chakra).
- **Offline-First:** All data mutations (logging events) must be queued in IndexedDB when offline, and synced to Supabase via a Service Worker background sync event when the network is restored.

## Important Notes
- **Authentication:** Use Supabase Phone Auth. The flow is: SMS OTP for initial verification, followed by the user setting a 4-digit PIN (saved as their password). Subsequent logins use Phone + PIN. NO email auth.
- **Database Rules:** Ensure Row Level Security (RLS) policies are created for `yards`, `colonies`, and `events` tables so users only see their own data.
- **Scope:** Do NOT implement features outside the v1 spec (no maps, no push notifications, no photo uploads). Keep it strictly to the MVP scope defined in `requirements.md`.

## Commands
- `npm run dev`: Start local development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build locally

## References
- See `@requirements.md` for the complete product specification, database schema, and screen list.
