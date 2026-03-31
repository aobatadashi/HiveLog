# HiveLog — Remaining UX Improvements Prompt

Paste the block below into a new session to continue implementation work.

---

```
You are working on HiveLog, an offline-capable PWA for commercial beekeepers. Read CLAUDE.md and hivelog-ux-audit.md in the project root before making any changes — they are your source of truth.

A UX audit was completed and several fixes have already been shipped:
- ✅ Accent color contrast fixed (2.93:1 → 6.92:1, now WCAG AA)
- ✅ Touch targets fixed: search clear (44→56px), filter chips (44→56px, font 16→18px), event expand toggle (44→56px)
- ✅ OfflineBanner now shows pending sync count + "Syncing N changes…" state
- ✅ Optimistic offline creates for yards and colonies with IndexedDB cache persistence
- ✅ Settings page: editable inputs now have dashed-underline affordance, delete yard/colony with confirmation modal, data export moved above yard management, helper text added

Here is what still needs to be done, in priority order. Implement these one at a time, testing after each. Follow the stack and constraints in CLAUDE.md exactly — no TypeScript, no Tailwind, no new dependencies beyond what's already in package.json.

## Priority 1 — Small CSS/Style Fixes (do all of these first)

1. **Badge font sizes are still below spec.** The "Today" badge (.badge-today in index.css) and WithdrawalBadge (inline styles in WithdrawalBadge.jsx) are at 16px. The CLAUDE.md spec says all text must be ≥18px. Bump both to 18px.

2. **YardCard location note is 16px.** In YardCard.jsx line ~36, the location_note paragraph has `fontSize: '16px'`. Change it to `'var(--font-body)'` (which is 18px).

3. **Syncing banner contrast.** The OfflineBanner "syncing" state uses --color-warning (#e65100) with white text, which is only 3.79:1 contrast. Darken the warning color to #bf4000 or use a darker background for just the syncing banner to hit at least 4.5:1.

## Priority 2 — "Repeat Last Event Type" (Audit Recommendation #2)

This saves 1 tap per hive × 40 hives = 40 taps per yard visit.

In LogEvent.jsx:
- On mount, read the last-used event type from localStorage (key: 'hivelog-last-event-type').
- Pre-select that type in the event type grid (set it as the initial state for the selected type).
- On save, write the selected type to localStorage.
- When navigating via "Next Colony" flow, pass the selected type in navigation state so it carries forward without needing localStorage.
- Add a small "×" clear button on the pre-selected type chip so the user can deselect if they want a different type.

## Priority 3 — Colony Filters & Sort in YardView (Audit Recommendation #4)

Commercial operators with 200 colonies per yard need to filter and sort the list.

In YardView.jsx:
- Add a row of filter chips above the colony list: "All (N)" / "Active (N)" / "Needs Attention (N)" / "Dead Out (N)". "Needs attention" = colonies with no events in 30+ days (yellow/red status dot logic already exists in ColonyCard.jsx's getStatusColor function — extract and reuse it).
- Add a sort selector (simple button group or dropdown): "Label" (alphabetical), "Last Activity" (most recent first), "Status". Default to "Label" sort since operators work hives in physical order.
- Persist the selected sort in localStorage so it remembers between sessions.

## Priority 4 — Enriched Colony Cards (Audit Recommendation #8)

Colony cards currently show only: label, status dot, and "Dead Out" text. Add:
- Last event date as relative time (e.g., "3d ago", "2 weeks ago") — the `last_event` timestamp is already fetched and available on the colony object in YardView.
- If a queen exists for the colony, show a small 👑 icon. If no queen is recorded, show nothing (don't clutter).
- If the colony is in an active withdrawal period, show the ⏳ compact WithdrawalBadge (already exists with compact={true} prop).

This requires fetching queen status and active withdrawal data at the yard level. Add two additional queries in YardView's fetchData:
- Fetch all active queens for colonies in this yard: `supabase.from('queens').select('colony_id').eq('status', 'active').in('colony_id', colonyIds)`
- Fetch recent treatment events with withdrawal periods for colonies in this yard (reuse the pattern from HiveView.jsx)

Keep the card compact — one line with the label, status dot, and these small indicators on the right side.

## Priority 5 — Quick-Log / "Walk Yard" Mode (Audit Recommendation #6)

This eliminates 2 taps per hive by letting users log events without entering each hive's detail view.

Add a "Walk Yard" button next to the existing "Log Event for Yard" button in YardView. When tapped:
- Enter a sequential walk mode that shows one colony at a time with the LogEvent form inline.
- Display a progress indicator: "Hive 14 of 40 — H-014"
- After saving, auto-advance to the next active colony in the list.
- Pre-select the last-used event type (from Priority 2 above).
- Show a "Skip" button to skip a hive without logging.
- Show a "Done" button to exit walk mode early.
- At the end, show a summary: "Logged 38 inspections, skipped 2"

This can be implemented as a new route `/walk/:yardId` or as a modal/fullscreen overlay within YardView.

## Priority 6 — Hive Transfer Between Yards (Audit Recommendation #7)

Commercial beekeepers move hives between yards constantly for pollination contracts.

- In HiveView, add a "Move to Yard" button (near the status badge area).
- Show a modal with a list of all other yards (fetched from supabase or from cached yards data).
- On selection, update the colony's yard_id via supabase (or queue offline).
- Auto-log a "transfer" event with notes indicating origin and destination yard names.
- This requires adding 'transfer' to the event type CHECK constraint in supabase_schema.sql and to the TYPE_LABELS maps in LogEvent.jsx, HiveView.jsx, and EventRow.jsx.

## Notes

- Run `npm run dev` after each change to verify nothing breaks.
- Keep all text ≥18px, all touch targets ≥56px, all primary button contrast ≥4.5:1.
- Every Supabase call must have error handling with user-facing feedback.
- All mutations must go through the offline queue pattern (try Supabase first, fall back to addToQueue).
- No console.log in production code.
```
