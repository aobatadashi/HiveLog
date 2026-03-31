# HiveLog UX Audit Report

**Date:** March 29, 2026
**Auditor:** Claude (UX Audit Agent)
**App Version:** Current main branch (pre-phone-auth migration)
**Test Method:** Full codebase review + live dev server testing (localhost:5174) with DOM measurement of touch targets, font sizes, and contrast ratios
**Persona:** Commercial beekeeper managing 500–10,000 hives across dozens of yards. Working outdoors on a phone, wearing leather gloves and a veil, in direct sunlight. Needs to log inspections on 40 hives in 95°F heat and get back to the truck.

---

## 1. Tap Efficiency

### Core Task: Log an Inspection on One Hive

**Minimum taps from Home screen to completed log: 5**

| Step | Action | Taps |
|------|--------|------|
| 1 | Tap yard card | 1 |
| 2 | Tap colony card | 1 |
| 3 | Tap "Log Event" (fixed bottom bar) | 1 |
| 4 | Tap event type button (e.g., Inspection) | 1 |
| 5 | Tap "Save" | 1 |
| **Total** | | **5** |

This is reasonable for a single hive. The real problem is **repetition at scale**. When you're working 40 hives in a row, those 5 taps multiply to 200 taps — and that's if everything goes perfectly.

### What Works Well

- **Yard-wide batch logging** (3 taps: "Log Event for Yard" → type → Save) is a major time-saver for operations where every hive in a yard gets the same treatment or inspection note. This is the best feature in the app for commercial scale.
- **"Next Colony" flow** after saving an event on a single hive lets you advance to the next colony without navigating back. This is smart and saves 2 taps per hive in a sequential walkthrough.
- **Event type buttons are large (100px+ tall, 2-column grid)** with emoji labels — easy to hit with gloves.
- **Notes field is optional** — you're not forced to type anything for a basic log.

### Where Taps Are Wasted

- **No "quick log" from the colony list.** If I'm walking a yard and just need to stamp "Inspection" on each hive, I have to enter each hive's detail view first. A long-press or swipe-to-log on the colony card could eliminate 2 taps per hive (enter hive view + tap Log Event).
- **No "repeat last event type" shortcut.** When inspecting 40 hives in a row, you're picking "Inspection" 40 times. The LogEvent page should remember the last-selected type and pre-select it, or offer a "Same as last" button.
- **The "Save" button requires scrolling on mobile** if you've typed notes or selected Treatment (which expands a form). The save action should either be fixed to the bottom of the viewport or the page should auto-scroll after type selection.
- **After saving, the "Next Colony" button requires reading the label** to confirm you're going to the right hive. In a sequential walkthrough, this should just be a giant "Next →" with the count (e.g., "Next → 14 of 40").

---

## 2. Field Usability

### Font Sizes

| Element | Actual Size | Spec Minimum | Verdict |
|---------|------------|--------------|---------|
| Body text | 18px | 18px | PASS |
| Button labels | 20px bold | 20px bold | PASS |
| H1 headings | 32px | 24px | PASS |
| H2 headings | 28px | 24px | PASS |
| Filter chips | **16px** | 18px | **FAIL** |
| "Today" badge | **14px** | 18px | **FAIL** |
| Withdrawal badge | **14px** | 18px | **FAIL** |
| Yard location note | **16px** | 18px | **FAIL** |

The main text and buttons are solid. But secondary information — which is still operationally important (withdrawal periods, location notes, activity recency) — drops below the minimum. A beekeeper in bright sun squinting through a veil will not read 14px text.

### Touch Targets

| Element | Actual Size | Spec Minimum (56px) | Verdict |
|---------|------------|---------------------|---------|
| Primary buttons | 64px | 56px | PASS |
| FAB (+) | 72px | 56px | PASS |
| Back button | 64px | 56px | PASS |
| Yard/Colony cards | 64px+ | 56px | PASS |
| Event type buttons | 100px+ | 56px | PASS |
| Search clear (×) | **44px** | 56px | **FAIL** |
| Filter chips | **44px** | 56px | **FAIL** |
| Event note "more/less" toggle | **44px** | 56px | **FAIL** |
| Batch add toggle switch | **56×32px** | 56px | Borderline |

The primary interaction elements are well-sized. The failures are in secondary controls that still get tapped frequently — especially filter chips on the HiveView page and the search clear button.

### Contrast Ratios (WCAG AAA target: 7:1)

| Element | Ratio | Target | Verdict |
|---------|-------|--------|---------|
| Body text on background (#1a1a1a on #fafafa) | 16.67:1 | 7:1 | PASS |
| Secondary text on background (#4a4a4a on #fafafa) | 8.49:1 | 7:1 | PASS |
| **White text on accent buttons (#fff on #d4850a)** | **2.93:1** | **7:1** | **CRITICAL FAIL** |
| White text on danger buttons (#fff on #c62828) | 5.62:1 | 7:1 | FAIL |
| Feed event badge (#e65100 on #fff3e0) | 3.46:1 | 4.5:1 | FAIL |
| Loss event badge (#c62828 on #ffebee) | 4.92:1 | 7:1 | FAIL |
| Green status text (#2e7d32 on #fafafa) | 4.91:1 | 7:1 | FAIL |
| Offline banner (#fff on #c62828) | 5.62:1 | 7:1 | FAIL |

**The most critical finding: every primary button in the app (Sign In, Save, Log Event, Add) uses white text on the amber accent color (#d4850a), which has a contrast ratio of only 2.93:1.** This fails even WCAG AA (4.5:1), let alone the AAA (7:1) target specified in CLAUDE.md. In direct sunlight, these buttons will be nearly unreadable. This is the single most impactful fix in the entire audit.

### Inputs Requiring Precise Interaction

- **Text input for search** — acceptable, the input is full-width and 56px tall.
- **Date picker for queen introduction date** — uses native `<input type="date">`, which on mobile triggers the OS date picker. Acceptable.
- **Number input for batch count and withdrawal days** — uses `inputMode="numeric"`, which is correct.
- **Free-text notes field** — optional and not required for core workflow. Good.
- **Treatment form custom product text input** — this is the only place where a beekeeper in gloves must type a product name if it's not in the 4-option quick-select. The quick-select (Apivar, Apiguard, Formic Pro, OAV) covers the most common products, which is smart.

---

## 3. Information Density & Scale

### Will This Work at 2,000+ Hives?

**Yards list (Home):** Search is present, which helps. But there's no sort capability. A commercial operator with 30+ yards needs to sort by: last activity (which yards haven't been checked recently?), colony count (which are my biggest yards?), or alphabetically. Currently, yards are sorted by creation date descending — the least useful sort order for daily operations.

**Colony list (YardView):** Search is present. But again, no sort or filter. Critical missing filters:

- **Filter by status:** Show only active colonies (hide dead-outs) — essential when you're working a yard and don't want to scroll past dead hives.
- **Filter by "needs attention":** Colonies with no events in 30+ days (already tracked by the yellow/red status dot, but not filterable).
- **Sort by label:** Hives are often numbered, and operators work them in order. Colonies are currently sorted by creation date, which may not match physical order.

**Colony cards show minimal information:** Just the label, a status dot, and "Dead Out" text if applicable. Missing from the card: last inspection date, queen status indicator, withdrawal status. A commercial operator scanning 200 hive cards needs to see at a glance which ones need attention without tapping into each one.

**Event history (HiveView):** Filter chips for event type are good. Pagination at 50 events is reasonable. But there's no date-range filter, which matters for compliance reporting ("show me all treatments in the last 90 days").

### Performance at Scale

- **No list virtualization.** Colony lists render every card in the DOM. At 200 colonies per yard, this means 200 React components mounted simultaneously. On a mid-range Android phone (which many field workers use), this will cause noticeable scroll jank and slow initial render.
- **Home page fetches last activity with a paginated loop** (up to 20 pages × 1,000 events). For a 10,000-hive operation, this could mean multiple seconds of loading on initial render, even with a good connection.
- **Batch colony add caps at 200.** A commercial operator setting up a new 400-hive yard needs to do this twice. The cap should be documented in the UI or raised.

---

## 4. Offline Resilience

### What Works

- **IndexedDB queue for mutations** — every create/update operation is queued locally before attempting the network call. If the network fails, the mutation stays queued. This is solid.
- **Cache layer** — yards, colonies, and events are cached in a separate IndexedDB store after successful fetches. If a fetch fails (offline), the cache is used as fallback.
- **OfflineBanner** — a sticky red banner at the top when `navigator.onLine === false`. Clear and visible.
- **Sync on reconnection** — listens for the `online` event and drains the queue with exponential backoff. Also runs a 60-second polling fallback.
- **Toast notifications** — "Synced 3 pending changes" appears when the queue drains successfully. Good feedback.

### What Doesn't Work

- **No pending-changes indicator.** When a beekeeper logs 15 events while offline, there's no visible count of "15 changes waiting to sync." The only feedback is the offline banner. Once they come back online, they get a toast, but between logging and syncing there's a trust gap. They don't know if their data was actually captured.
- **No queue viewer.** If sync fails permanently (e.g., a 4xx error from a conflict), the failed items are silently discarded and a toast says "1 change failed to sync and was discarded." The operator has no way to see what was lost or retry it. For a commercial operation logging hundreds of events per day, silent data loss is unacceptable.
- **Offline cache doesn't update after local mutations.** If you create a yard while offline, it's added to React state (so you see it) and to the queue (so it'll sync later), but it's NOT written to the IndexedDB cache. If you kill the app and reopen while still offline, that yard is gone from the UI until you get back online.
- **Background sync via service worker is configured but the SW doesn't register custom sync events.** The `vite-plugin-pwa` generates a service worker for asset precaching, but the app relies on the `online` window event and a 60s interval timer rather than the Background Sync API. If the app is closed/backgrounded when connectivity returns, queued items won't sync until the user reopens the app.
- **Yard-batch logging falls back to cached colony lists** when offline, but shows a warning banner. If the user hasn't visited that yard while online first, they get "Could not load colonies — open this yard while online first." This is a dead end in the field.

---

## 5. Onboarding Friction

### Could a 60-Year-Old Beekeeper Figure This Out in 2 Minutes?

**Login: No.** The current login is email + password, not the phone + PIN flow specified in the requirements. A veteran beekeeper who doesn't use apps regularly will struggle with:
- Remembering which email they used
- Creating and remembering a 6+ character password
- The "Create Account" vs "Sign In" distinction (they'll tap Sign In first, get an error, not know why)

The specified phone + PIN flow would be dramatically better: enter your phone number (which every beekeeper knows by heart), get a text, type 4 numbers. The TODO for this migration exists but hasn't shipped.

**Home screen: Yes.** "My Yards" with a big "+" button is immediately clear. The empty state says "Tap + to add your first yard." Good.

**Adding a yard: Mostly yes.** Modal with "Yard Name" and optional location note. Two fields, two buttons (Cancel/Add). The form is clean. But `autoFocus` on the name field will trigger the keyboard immediately, which could be disorienting on mobile.

**Navigation model: Mostly intuitive.** Yards → Colonies → Hive → Log Event is a natural hierarchy that mirrors how beekeepers think. The back arrow is clear. But there's no way to tell where you are in the hierarchy at a glance — no breadcrumb, no path indicator.

**Log Event screen: Yes.** Big emoji buttons in a 2×2 grid. Tap one, it highlights, tap Save. This is the best-designed screen in the app for the target user.

**Settings: Confusing.** Settings contains yard/colony renaming (via inline editable text fields that look like labels until you tap them), data export, and sign out. The editable fields have no visual affordance — they look like plain text, not inputs. A non-technical user won't discover they can rename things here.

---

## 6. Missing Features & Flows

### Present but Buried

- **Queen tracking** exists but is accessed only from inside the HiveView page. There's no way to see a list of all colonies that are queenless or have aging queens without tapping into each hive individually.
- **Dead-out tracking** works — you can mark colonies as dead-out from the HiveView status badge or via the "Loss" event type prompt. But there's no summary view: "How many dead-outs do I have across all yards?"
- **Treatment withdrawal tracking** is well-implemented with countdown badges on the HiveView page. But there's no yard-level or operation-level view of which colonies are currently in withdrawal — critical for honey harvest compliance.
- **CSV export** exists in Settings with three export types (all events, colony status, treatment log). This is good for compliance but hard to discover — it's below the fold in Settings.

### Missing Entirely

- **Hive movement / yard transfers.** Commercial beekeepers move hives between yards constantly (pollination contracts, seasonal moves). There's no way to transfer a colony from one yard to another without deleting and re-creating it, which loses all event history.
- **Harvest records with quantities.** The "Harvest" event type exists but captures only an optional text note. Commercial operators need to log pounds of honey per hive or per yard for production tracking and contract fulfillment.
- **Hive strength / population scoring.** A simple 1–5 or weak/medium/strong rating during inspections would let operators prioritize which colonies need attention. Currently, the only data captured per inspection is the timestamp and optional notes.
- **Quick-stats dashboard.** A commercial operator opens the app and wants to see: total active hives, total dead-outs this season, yards needing inspection, colonies in withdrawal. Currently, they see a list of yard cards with colony counts.
- **Feeding records with quantities.** Similar to harvest — the "Feed" event type exists but doesn't capture what was fed (sugar syrup, pollen patties) or how much.
- **Multi-select for batch operations on individual colonies.** The yard-wide batch log is great, but sometimes you need to log an event on 15 specific colonies in a yard of 48 (e.g., you treated only the ones that tested high for mites). Currently, you must log them one at a time or log for the whole yard and accept inaccurate records.

---

## 7. Top 10 Recommendations (Ranked by Impact)

### 1. Fix Primary Button Contrast — CRITICAL
**Impact:** Every user, every session, every tap
**Current:** White text on #d4850a = 2.93:1 contrast ratio
**Fix:** Darken the accent color to at least #8B5E00 (estimated 4.8:1) for WCAG AA, or use dark text on the amber background instead of white text. For WCAG AAA (7:1), use #5C3D00 or similar. Test the exact value with a contrast checker.
**Effort:** 1 line CSS change (`--color-accent: #7a5200;` or similar) + verify all accent-derived colors.

### 2. Add "Repeat Last Event Type" Pre-Selection
**Impact:** Saves 1 tap per hive × 40 hives = 40 taps per yard visit
**Current:** Event type grid starts with nothing selected every time
**Fix:** Store the last-selected event type in `localStorage` (or React context). When LogEvent mounts, pre-select it. Add a small "×" to deselect if the user wants a different type. For the sequential "Next Colony" flow, pass the selected type as navigation state so it carries forward automatically.
**Effort:** ~20 lines of code in LogEvent.jsx.

### 3. Ship Phone + PIN Authentication
**Impact:** Every new user's first experience; every return login
**Current:** Email + password (temporary, per code comments)
**Fix:** The migration guide already exists in `PHONE_AUTH_TODO.md`. Phone number entry is faster in gloves than email. A 4-digit PIN is faster than a 6+ character password. This is the single biggest onboarding improvement.
**Effort:** Medium — requires Supabase phone auth configuration + Login.jsx rewrite.

### 4. Add Colony Status Filters to YardView
**Impact:** Every yard visit for operators with mixed active/dead-out colonies
**Current:** All colonies shown in a flat list, sorted by creation date
**Fix:** Add a row of filter chips above the colony list: "All (48)" / "Active (41)" / "Needs Attention (7)" / "Dead Out (7)". Add sort options: by label (alphabetical), by last event date, by status. Default sort should be by label, since operators work hives in physical order.
**Effort:** ~50 lines — filter state + array filter/sort in YardView.jsx, reuse the existing filter-chip CSS.

### 5. Add Pending Sync Counter
**Impact:** Trust & confidence for every offline session
**Current:** No indication of queued changes between logging and syncing
**Fix:** Add a small badge on the OfflineBanner (or a persistent subtle indicator even when online) showing "3 changes pending." Read the count from `getQueueCount()` in offlineQueue.js on an interval or after each mutation. When the queue empties, the badge disappears.
**Effort:** ~30 lines — a `useSyncStatus` hook + badge UI in OfflineBanner or a new SyncStatus component.

### 6. Add Quick-Log from Colony List
**Impact:** Eliminates 2 taps per hive in a sequential walkthrough (enter hive + tap Log Event)
**Current:** Must drill into HiveView to reach Log Event
**Fix:** Add a "Quick Log" button (e.g., a small clipboard icon) on each ColonyCard, or a dedicated "Walk Yard" mode that presents colonies one at a time with the LogEvent form inline. The walk mode would be: tap "Walk Yard" → see first colony's LogEvent screen → Save → auto-advance to next colony → repeat until done.
**Effort:** Medium — new "walk yard" flow or modification to ColonyCard + direct navigation to LogEvent with next-colony state.

### 7. Add Hive Transfer (Move Colony Between Yards)
**Impact:** Core workflow for pollination operations
**Current:** No way to move a colony without losing history
**Fix:** In HiveView or Settings, add a "Move to Yard" action that updates the colony's `yard_id`. Show a picker of available yards. Log a "transfer" event automatically with the origin and destination yards. Requires adding 'transfer' to the event type enum.
**Effort:** Medium — new UI component + schema migration for 'transfer' event type.

### 8. Enrich Colony Cards with At-a-Glance Data
**Impact:** Scanning speed when managing 200+ hives per yard
**Current:** Colony cards show only: label, status dot, "Dead Out" text
**Fix:** Add to each ColonyCard: last event date (e.g., "3 days ago"), queen status icon (crown emoji or "Queenless" tag), withdrawal badge if applicable. This data is already fetched or fetchable — it just needs to be displayed on the card. Keep the card compact but information-dense.
**Effort:** Medium — requires fetching queen status and withdrawal data at the yard level, then passing to ColonyCard.

### 9. Fix Undersized Touch Targets (Filter Chips, Search Clear, Event Expand)
**Impact:** Usability for gloved users tapping filter chips and clearing searches
**Current:** Filter chips and search clear button at 44px, below the 56px minimum
**Fix:** Increase `.filter-chip` min-height to 56px, increase `.search-clear` to 56×56px, increase the event note "more/less" button min-height to 56px. Adjust padding and font sizes accordingly (filter chip font should be 18px, not 16px).
**Effort:** ~10 lines of CSS changes.

### 10. Fix Below-Spec Font Sizes
**Impact:** Readability in bright sunlight for all secondary information
**Current:** Filter chips (16px), "Today" badge (14px), withdrawal badge (14px), location notes (16px)
**Fix:** Set all text to minimum 18px per spec. For badges that need to be compact, use 16px bold as an absolute floor but prefer 18px. The "Today" and withdrawal badges at 14px are particularly problematic — these convey time-sensitive operational information.
**Effort:** ~10 lines of CSS/inline style changes.

---

## Appendix A: Screen-by-Screen Inventory

| Screen | Route | Key Components | Primary Action |
|--------|-------|----------------|----------------|
| Login | `/*` (unauthenticated) | Email/password form, sign up, forgot password | Authenticate |
| Home | `/` | YardCard list, search, FAB (+), Settings button | Navigate to yard |
| YardView | `/yard/:id` | ColonyCard list, search, "Log Event for Yard" batch button, FAB (+), batch add toggle | Navigate to hive or batch log |
| HiveView | `/hive/:id` | Event history, filter chips, QueenInfo card, status badge, "Log Event" fixed button | Log event or review history |
| LogEvent | `/log/:colonyId` or `/log-yard/:yardId` | 2×2 event type grid, notes textarea, treatment form (conditional), Save button | Record an event |
| Settings | `/settings` | Yard/colony rename (inline edit), CSV export buttons, sign out | Manage data |

## Appendix B: Data Model Summary

| Table | Key Fields | Notes |
|-------|-----------|-------|
| yards | name, location_note, owner_id | Unique name per owner |
| colonies | label, status (active/deadout), yard_id | Unique label per yard |
| events | type (7 enum values), notes, colony_id, logged_by | Core event log |
| queens | marking_color, source, introduction_date, status, colony_id | One active queen per colony |
| treatment_details | product_name, dosage, application_method, withdrawal_period_days, lot_number, event_id | 1:1 with treatment events |

## Appendix C: Methodology

This audit was conducted through:

1. **Complete source code review** of all 22 source files (6 pages, 8 components, 4 lib modules, 1 hook, CSS, config, and SQL schema).
2. **Live application testing** via Vite dev server with DOM measurement of actual rendered element sizes, contrast ratio calculations, and interaction flow mapping.
3. **Contrast ratio computation** using the WCAG relative luminance formula applied to all color pairings found in the CSS custom properties and inline styles.
4. **Tap flow counting** by tracing the minimum interaction path through the navigation hierarchy for the core use case (log an inspection on one hive).
5. **Architecture analysis** of the offline queue, cache layer, and sync mechanism by reading the implementation in `offlineQueue.js`, `cache.js`, and `sync.js`.

All measurements were taken against the running application, not estimated from code alone.
