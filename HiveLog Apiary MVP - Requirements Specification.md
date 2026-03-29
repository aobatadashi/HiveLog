# HiveLog Apiary MVP - Requirements Specification

## 1. Product Overview
**Product Name:** HiveLog  
**Description:** A simple, offline-capable mobile web app (Progressive Web App) for beekeepers to log hive events in the field.  
**Design Constraints:** Designed for users working outdoors in the sun, wearing restrictive gear (gloves, veils). UI must prioritize high contrast, exceptionally large touch targets, minimal interaction flows, and zero unnecessary typing.

## 2. Technical Stack
- **Frontend:** Vite + React (vanilla, no heavy UI libraries to keep it lightweight and fast)
- **Backend & Database:** Supabase (PostgreSQL, Row Level Security)
- **Authentication:** Supabase Phone Auth
- **Hosting:** Vercel (free tier, instant deploys)
- **Offline Capabilities:** Progressive Web App (PWA) via `vite-plugin-pwa`. Service worker + IndexedDB queue. Events logged while offline must sync to the database when the network connection returns.

## 3. Authentication Flow
- **Method:** Phone number + SMS OTP + Custom PIN.
- **First Login:** 
  1. User enters phone number.
  2. User receives a 6-digit OTP via SMS.
  3. User enters OTP to verify.
  4. User sets a 4-digit PIN (This is saved as the user's Supabase password).
- **Subsequent Logins:** User enters phone number + 4-digit PIN (Using Supabase Phone + Password login).
- **Constraints:** No email. No password reset flow. If they lose access or forget the PIN, they must re-verify via SMS OTP to set a new PIN.

## 4. Data Model (PostgreSQL)
Three tables total. Row Level Security (RLS) must be enabled on all tables so users can only read/write their own data. No other foreign keys, equipment tables, or complex relationships for v1.

### `yards`
- `id` (UUID, Primary Key)
- `owner_id` (UUID, references `auth.users`)
- `name` (Text)
- `location_note` (Text, optional)
- `created_at` (Timestamp, default `now()`)

### `colonies`
- `id` (UUID, Primary Key)
- `yard_id` (UUID, references `yards.id`)
- `label` (Text, e.g., "Hive 12")
- `status` (Text: 'active' or 'deadout')
- `created_at` (Timestamp, default `now()`)

### `events`
- `id` (UUID, Primary Key)
- `colony_id` (UUID, references `colonies.id`)
- `type` (Text: 'inspection', 'treatment', 'feed', 'split', 'loss', 'requeen', 'harvest')
- `notes` (Text, optional)
- `logged_by` (UUID, references `auth.users`)
- `created_at` (Timestamp, default `now()`)

## 5. Screens (5 Total)
1. **Home:** 
   - List of all yards. 
   - Each yard shows: name, colony count, last activity date. 
   - Big "+" button to add a yard.
2. **Yard View:** 
   - List of all hives in that yard. 
   - Each hive shows its label and a colored status dot:
     - **Green:** Inspected in the last 30 days.
     - **Yellow:** Inspected 30–60 days ago.
     - **Red:** Inspected 60+ days ago OR status is `deadout`.
   - Big "+" button to add a hive.
3. **Hive View:** 
   - Hive label at the top. 
   - Chronological event history below (most recent first). 
   - Big "Log Event" button fixed at the bottom.
4. **Log Event Screen:** 
   - 6 massively large buttons: Inspection / Treatment / Feed / Split / Loss / Requeen. 
   - User taps one. 
   - Optional free-text notes field. 
   - "Save" button. 
   - *Done.* No required fields beyond the event type.
5. **Settings:** 
   - Edit yard names. 
   - Edit hive labels. 
   - *Nothing else.*

## 6. Offline PWA & Sync Pattern
- **Manifest & Installation:** Configure `vite-plugin-pwa` to generate a `manifest.json` so the app can be installed to the iOS/Android home screen directly from the browser.
- **Caching:** Cache the app shell (HTML, JS, CSS) so the UI loads instantly without a network.
- **Mutation Queue:** When the user clicks "Save" on an event while offline, save the payload to an IndexedDB store (e.g., using `idb`).
- **Background Sync:** Register a service worker sync event. When the device comes back online, the service worker reads the IndexedDB queue and pushes the pending events to Supabase.

## 7. Explicitly OUT of Scope for v1
*If users ask for these during testing, log them for the v2 roadmap.*
- Push notifications
- Crew / team management
- Reporting or data exports
- Photo uploads
- Equipment tracking
- Pollination contracts
- Map view
- Analytics dashboards
- Admin panel
