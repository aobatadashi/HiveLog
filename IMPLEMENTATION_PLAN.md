# HiveLog Implementation Plan — Commercial Beekeeper Workflow

**Context:** Based on a field interview with Leo Rukin, a commercial beekeeper running 2,000+ hives. His current workflow is texting hive counts (splits, losses, feeding) into a group chat, where an admin (Rochelle) manually compiles spreadsheets. HiveLog needs to replace that workflow.

**Core insight:** Leo operates at **yard level with bulk counts**, not individual hive tracking. His #1 daily task is splitting hives from one yard and moving them to another. The app must support this without requiring individual colony records.

---

## Phase 1: Data Model — Yard-Level Hive Counts + Yard Events

**Goal:** Add `hive_count` to yards and create a `yard_events` table so users can work at yard level without individual colony records. Preserve backward compatibility with existing colony-level data.

### 1A. Schema Changes (`supabase_schema.sql`)

Add column to `yards`:
```sql
ALTER TABLE yards ADD COLUMN hive_count INTEGER NOT NULL DEFAULT 0;
```

Create new `yard_events` table:
```sql
CREATE TABLE yard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id UUID NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'split_out',      -- hives left this yard (source side of a split)
    'split_in',       -- hives arrived at this yard (destination side)
    'transfer_out',   -- hives moved out (non-split transfer)
    'transfer_in',    -- hives moved in (non-split transfer)
    'loss',           -- bulk loss count
    'feed',           -- fed entire yard
    'treatment',      -- treated entire yard
    'inspection',     -- inspected yard
    'adjustment',     -- manual count correction
    'mite',           -- mite/pest damage
    'swarm',          -- swarming event
    'queenless'       -- queenless hives found
  )),
  count INTEGER,                    -- number of hives affected (for splits, losses, transfers)
  related_yard_id UUID REFERENCES yards(id),  -- destination/source yard for splits/transfers
  notes TEXT,
  logged_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE yard_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY yard_events_select ON yard_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM yards WHERE yards.id = yard_events.yard_id AND yards.owner_id = auth.uid())
);
CREATE POLICY yard_events_insert ON yard_events FOR INSERT WITH CHECK (
  logged_by = auth.uid() AND
  EXISTS (SELECT 1 FROM yards WHERE yards.id = yard_events.yard_id AND yards.owner_id = auth.uid())
);
CREATE POLICY yard_events_update ON yard_events FOR UPDATE USING (logged_by = auth.uid());
CREATE POLICY yard_events_delete ON yard_events FOR DELETE USING (logged_by = auth.uid());

-- Index for efficient yard event history queries
CREATE INDEX idx_yard_events_yard_date ON yard_events (yard_id, created_at DESC);
```

### 1B. Files to Change

- **`supabase_schema.sql`** — Add the above SQL
- **`src/lib/offlineQueue.js`** — Add `yard_event` as a queued operation type
- **`src/lib/sync.js`** — Add sync handler for `yard_event` operations
- **`src/lib/cache.js`** — Add cache keys for yard events

### 1C. Verification

- Run the SQL migration against Supabase
- Confirm RLS policies work (user can only see own yard events)
- Confirm `hive_count` column exists and defaults to 0

---

## Phase 2: Yard Creation UX + Hive Count

**Goal:** Improve yard creation so it's clear what "name" means, and allow setting an initial hive count. Fix Leo's confusion about yard name vs. number.

### 2A. Changes to `src/pages/Home.jsx`

1. **Yard creation modal** — Update the "Add Yard" form:
   - Rename field label from "Name" → **"Yard Name"**
   - Add placeholder: `"e.g., Archer B Supply, Winfield Farm"`
   - Add new field: **"Number of Hives"** (numeric input, optional, defaults to 0)
   - Add helper text below yard name: `"Give your yard a name you'll recognize"`
   - On submit: create yard with `name` and `hive_count`

2. **YardCard display** — Show hive count prominently:
   - Display `hive_count` as the primary number on each yard card (large font)
   - Label it "hives" below the number
   - Keep existing colony count as secondary if colonies exist
   - Show last yard event date instead of (or in addition to) last colony event

### 2B. Changes to `src/components/YardCard.jsx`

- Add `hive_count` display (large, bold number)
- Show format: **"216 hives"** prominently on the card
- If `hive_count > 0` and individual colonies also exist, show both

### 2C. Files to Change

- `src/pages/Home.jsx` — Yard creation modal, yard list rendering
- `src/components/YardCard.jsx` — Add hive count display
- `src/index.css` — Any new styles for the count display

---

## Phase 3: Yard-Level Event Logging (The Core Feature)

**Goal:** Allow logging events at yard level — especially splits, losses, and feeding — with automatic hive count updates.

### 3A. New Page: `src/pages/LogYardEvent.jsx`

Route: `/#/yard/:yardId/log`

**UI Layout:**
1. **Header:** Yard name + current hive count displayed prominently
2. **Event type buttons** (large, glove-friendly, 2-column grid):
   - Split ✂️
   - Loss 💀
   - Feed 🍯
   - Treatment 💊
   - Inspection 🔍
   - Mite Damage 🐛
   - Swarm 🐝
   - Queenless ❌👑
3. **After selecting type**, show relevant inputs:
   - **Split:** "How many hives?" (number input) + "Move to which yard?" (yard picker dropdown) + optional notes
   - **Loss:** "How many lost?" (number input) + optional notes
   - **Feed:** optional notes (feeding is yard-wide, no count needed)
   - **Treatment:** optional notes + treatment details form (reuse existing TreatmentForm)
   - **Inspection / Mite / Swarm / Queenless:** "How many affected?" (optional number) + optional notes
   - **Manual Adjustment:** "Set hive count to:" (number input) — for corrections
4. **Save button** — large, bottom-fixed
5. **On save:**
   - Insert `yard_events` row
   - Update `yards.hive_count`:
     - Split out: `hive_count -= count`
     - Split in (on destination yard): `hive_count += count`
     - Loss: `hive_count -= count`
     - Adjustment: `hive_count = count`
     - Others: no count change
   - Queue in IndexedDB if offline
   - Show success toast with updated count

### 3B. Yard Picker Component: `src/components/YardPicker.jsx`

- Used in split/transfer flows
- Shows list of user's other yards (excluding current)
- Each row shows yard name + current hive count
- Large touch targets (64px rows)
- Search/filter if many yards
- "Create New Yard" option at bottom

### 3C. Add "Log Event" Button to YardView

In `src/pages/YardView.jsx`:
- Add a prominent **"Log Yard Event"** button near the top (or as a FAB)
- This navigates to `/#/yard/:yardId/log`
- Existing individual colony logging remains available via colony cards

### 3D. Files to Create

- `src/pages/LogYardEvent.jsx` — New page
- `src/components/YardPicker.jsx` — Yard selector for splits/transfers

### 3E. Files to Change

- `src/App.jsx` — Add route for `/#/yard/:yardId/log`
- `src/pages/YardView.jsx` — Add "Log Yard Event" button
- `src/pages/Home.jsx` — Quick-action button on yard cards for common events
- `src/lib/offlineQueue.js` — Handle yard event mutations
- `src/lib/sync.js` — Sync yard events + hive count updates
- `src/index.css` — Styles for new components

---

## Phase 4: Yard Event History + Running Totals

**Goal:** Show a chronological ledger of yard events with running hive count, replacing the group chat → spreadsheet workflow.

### 4A. New Section in `src/pages/YardView.jsx`

Add a **"Yard Log"** tab or section above the colony list:

1. **Running total banner** at top:
   - Large display: **"286 hives"** (current `hive_count`)
   - Below it: net change today, e.g., "+142 splits in, -3 losses"

2. **Event history list** (most recent first):
   - Each row shows: event type badge, count (if applicable), related yard name (if split/transfer), notes, timestamp
   - Example rows:
     - `[Split] 142 hives → Winfield Farm — Apr 7, 8:30 PM`
     - `[Loss] 3 hives — Apr 7, 2:15 PM`
     - `[Feed] Entire yard — Apr 6, 10:00 AM`
   - Filter chips by event type
   - Paginated (load more)

3. **Running count column** (optional, nice-to-have):
   - Show the hive count after each event, so it reads like a ledger

### 4B. Files to Change

- `src/pages/YardView.jsx` — Add yard event history section
- `src/components/YardEventRow.jsx` — New component for yard-level event display (distinct from colony `EventRow.jsx`)

---

## Phase 5: Edit / Undo / Delete

**Goal:** Let users fix mistakes from the main screens, not buried in Settings. Address Leo's "I can't delete and start over" frustration.

### 5A. Yard Editing (inline on Home screen)

In `src/pages/Home.jsx` or `src/components/YardCard.jsx`:
- Long-press or tap a "..." menu on each yard card
- Options: **Edit Name**, **Edit Hive Count**, **Delete Yard**
- Edit opens inline or modal with pre-filled values
- Delete shows confirmation with cascade warning

### 5B. Event Editing/Deletion

In `src/pages/YardView.jsx` (yard events) and `src/pages/HiveView.jsx` (colony events):
- Tap on an event row → expand with **Edit** and **Delete** buttons
- **Delete:** confirmation modal → removes event, reverses hive count change if applicable
  - Example: deleting a "Loss 3" event would add 3 back to `hive_count`
- **Edit:** opens modal with pre-filled fields → save updates the event and adjusts counts

### 5C. Files to Change

- `src/pages/Home.jsx` — Add yard edit/delete actions
- `src/pages/YardView.jsx` — Add yard event edit/delete
- `src/pages/HiveView.jsx` — Add colony event edit/delete
- `src/components/EventRow.jsx` — Add expand-to-edit behavior
- `src/components/YardEventRow.jsx` — Add expand-to-edit behavior
- `src/lib/offlineQueue.js` — Handle update/delete operations
- `src/lib/sync.js` — Sync updates and deletes

---

## Phase 6: Onboarding / First-Run Tutorial

**Goal:** Guide new users through creating their first yard so they don't stare at an empty screen for 5 minutes and give up.

### 6A. New Component: `src/components/Onboarding.jsx`

Trigger: Show when user has 0 yards (first login).

**Flow (3 screens, swipeable or "Next" button):**

1. **Screen 1 — Welcome:**
   - "Welcome to HiveLog"
   - "Track your yards, hives, and daily work — all in one place."
   - [Next →]

2. **Screen 2 — Create Your First Yard:**
   - Inline form: Yard Name + Number of Hives
   - Placeholder examples: "Archer B Supply", "216"
   - Helper text: "You can always change this later"
   - [Create Yard →]

3. **Screen 3 — You're Ready:**
   - "Your yard is set up! Tap it to log splits, losses, feeding, and more."
   - Show the yard card they just created
   - [Get Started →]

### 6B. Persistence

- Store `onboarding_complete` in localStorage
- Don't show again after completion or dismissal
- Add "Skip" link on each screen

### 6C. Files to Create

- `src/components/Onboarding.jsx`

### 6D. Files to Change

- `src/pages/Home.jsx` — Show onboarding when `yards.length === 0 && !onboarding_complete`
- `src/index.css` — Onboarding styles

---

## Phase 7: New Event Types (P2)

**Goal:** Add mite/pest damage, queenless, and swarming as first-class event types.

### 7A. Schema

Already handled in Phase 1 — the `yard_events.type` CHECK constraint includes `'mite'`, `'swarm'`, `'queenless'`.

For colony-level events, update the `events.type` CHECK constraint:
```sql
ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check CHECK (
  type IN ('inspection', 'treatment', 'feed', 'split', 'loss', 'requeen', 'harvest', 'transfer', 'mite', 'swarm', 'queenless')
);
```

### 7B. UI Changes

- `src/pages/LogEvent.jsx` — Add Mite 🐛, Swarm 🐝, and Queenless ❌👑 buttons to the event type grid
- `src/pages/LogYardEvent.jsx` — Already included in Phase 3
- `src/components/EventRow.jsx` — Add labels and badge styles for new types
- `src/components/YardEventRow.jsx` — Already included in Phase 4
- `src/index.css` — Badge colors for new event types

---

## Implementation Order + Dependencies

```
Phase 1 (Schema)          ← Must go first, foundation for everything
  ↓
Phase 2 (Yard Creation)   ← Can start immediately after Phase 1
  ↓
Phase 3 (Yard Event Log)  ← Core feature, depends on Phase 1+2
  ↓
Phase 4 (History/Totals)  ← Depends on Phase 3 for data
  ↓
Phase 5 (Edit/Delete)     ← Can start after Phase 3
  ↓
Phase 6 (Onboarding)      ← Independent, can be done anytime after Phase 2
  ↓
Phase 7 (New Event Types) ← Independent, can be done anytime after Phase 1
```

Phases 6 and 7 are independent and can be done in parallel with Phases 4-5.

---

## Key UX Rules (Apply to ALL Phases)

From CLAUDE.md — these are non-negotiable:

- **Touch targets:** minimum 56×56px, prefer 64×64px
- **Font sizes:** body ≥ 18px, headings ≥ 24px, buttons ≥ 20px bold
- **Contrast:** WCAG AAA (7:1)
- **One-tap:** wherever possible. No drag-and-drop, swipe, or hover
- **Keyboard:** minimize. The number inputs for hive counts should use `inputMode="numeric"` for a number pad
- **Feedback:** every tap produces immediate visual feedback (color change, toast, animation)
- **Offline-first:** all mutations queue in IndexedDB when offline, sync when back online

---

## What NOT to Build (Scope Fence)

Per CLAUDE.md and `requirements.md` — do NOT add:
- Map view / pin dropping (Leo mentioned wanting it, but it's out of v1 scope)
- Push notifications
- Team/crew management
- Photo uploads
- Equipment tracking
- TypeScript
- Any CSS framework (Tailwind, etc.)

---

## Summary: What This Gives Leo

After all phases, Leo's workflow becomes:

1. Open app → see all yards with live hive counts
2. Tap "Archer B Supply" → see 216 hives, event history
3. Tap "Log Event" → tap "Split" → enter 142 → pick "Winfield Farm" → Save
4. Archer B Supply now shows 74 hives; Winfield Farm shows 286 hives
5. Rochelle opens the app → sees the same data, can export CSV
6. No group chat, no manual spreadsheet, no mental math
