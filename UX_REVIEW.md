# HiveLog PWA — Field UX Review

**Reviewer:** Claude (AI-assisted review)
**Date:** March 30, 2026
**Scope:** All screens (Login, Home/Yards, YardView, HiveView, LogEvent, WalkYard, Settings)
**Persona:** Commercial beekeeper, 2,000–10,000+ hives, outdoors in gloves/veil, bright sun, weak signal

---

## Criterion 1: Can this be operated with one hand in work gloves?

### What's working well

The design token system is strong here. Buttons sit at 64–72 px minimum height, and the FAB is 72 px diameter — both above the 56 px floor the spec mandates. Event-type buttons on the LogEvent screen are 100 px+ tall with 48 px padding, which is genuinely generous for a gloved thumb. The `:active` scale-down (`scale(0.96)`) gives immediate visual confirmation of a tap, compensating for the fact that gloves kill haptic feedback.

The Walk Yard flow deserves particular praise. Its "Save & Next / Skip" button pair at the bottom of the screen lands exactly where a right thumb naturally rests on a 5–6 inch phone held one-handed. Treatment details carry forward automatically between hives, so a beekeeper applying Apivar strips across a whole yard taps once to choose the product and then just hammers "Save & Next" for each box.

### Where it breaks down

**Modals are the biggest glove hazard.** The Add Yard, Add Colony, Queen Info, Confirm Delete, and Transfer modals all require precision taps on relatively small Cancel/Confirm button pairs side by side. With nitrile or leather gloves, the risk of hitting Cancel when you meant Confirm (or vice versa) is high. The queen color-picker circles are 56 px, which is at minimum — fine for bare hands, tight for gloves.

**The Settings page inline-edit pattern is nearly unusable in gloves.** Yard and colony names are edited via input fields with a subtle dashed underline. There's no visible "Edit" button — you have to know to tap the text. With gloves on, this is both hard to discover and hard to target. The delete trash-can icons (🗑) sit right next to the editable text, creating a dangerous mis-tap zone: a beekeeper trying to rename a yard could accidentally trigger the delete confirmation.

**Filter chips on YardView scroll horizontally.** Horizontal scrolling with gloves is unreliable — it often registers as a tap instead. The sort buttons (Label / Last Activity / Status) are 44 px tall, which is below the 56 px minimum in the spec.

### Recommendations

1. **Stack modal buttons vertically** instead of side-by-side, with the destructive action at the bottom and visually distinct (red, separated by whitespace).
2. **Add an explicit "Edit" icon-button** on Settings items, and move the delete button to a swipe-to-reveal or a separate "Manage" sub-screen to eliminate the rename/delete mis-tap risk.
3. **Replace horizontal-scroll filter chips** with a full-width dropdown or vertically stacked toggle buttons, each at 56 px+ height.
4. **Increase queen color-picker circles to 64 px** with more spacing between them.

---

## Criterion 2: Is the most frequent action the fewest taps away?

### The happy path

For a beekeeper's most common daily task — "walk a yard, log an inspection on each hive" — the tap count is:

1. Home → tap yard card **(1 tap)**
2. YardView → tap "Walk Yard" **(1 tap)**
3. WalkYard → select event type + tap "Save & Next" **(2 taps per hive, 1 if type carries forward)**
4. Repeat until done → "Back to Yard" **(1 tap)**

That's roughly **2N + 3 taps** for N hives, which is about as lean as it gets. The treatment-detail reuse in Walk Yard is a smart optimization — when you're treating 200 hives with the same product, you don't re-enter it 200 times.

For the second-most-common action — "log a single event on one specific hive" — the path is:

1. Home → tap yard **(1 tap)**
2. YardView → tap colony **(1 tap)**
3. HiveView → tap "Log Event" **(1 tap)**
4. LogEvent → select type + tap "Save" **(2 taps)**

**5 taps total.** Reasonable, but there's an optimization the app misses: the "Log Event" button is fixed at the bottom of HiveView, but the user has to scroll past the entire event history to see it on first load. Since logging is more frequent than reviewing history, consider putting the Log Event button *above* the event list, or making it a FAB that floats over the content.

### Where frequency and depth don't match

**The "Log All" batch feature is well-placed** (prominent button at the top of YardView), which matches its frequency — commercial beekeepers do batch treatments constantly.

**The "needs attention" filter on Home is too subtle.** For a beekeeper managing 50+ yards, the most urgent action on any given day is "which yards have overdue hives?" The current implementation is a small text link ("Filter attention") buried in the stats line. This should be the default view, or at minimum a large, prominent toggle.

**Adding a new colony is slightly buried.** The FAB (+) on YardView opens a modal, which then has a "Batch Add" toggle that's easy to miss. For initial setup (adding 200 hives), this flow requires discovering a hidden toggle inside a modal. Consider making batch-add the default, with single-add as the secondary option, since commercial beekeepers rarely add one hive at a time.

### Recommendations

1. **Promote the "Log Event" button** on HiveView — either move it above the event history or make it a persistent FAB.
2. **Make the "needs attention" filter a prominent, always-visible toggle** on the Home screen, possibly the default sort.
3. **Default the Add Colony modal to batch mode** for users with existing colonies, and surface the batch toggle more visibly.

---

## Criterion 3: Will this work on a 5-inch screen in bright sunlight?

### Contrast and legibility

The color system is solid. The primary accent (#7a5200 brown on #fafafa white) hits roughly 8:1 contrast — above WCAG AAA's 7:1 requirement. Body text (#1a1a1a on #fafafa) exceeds 15:1. Font sizes start at 18 px for body, 24 px for headings, and 20 px for buttons, all with semi-bold or bold weights. In direct sunlight, this should remain legible.

The status color system (green/yellow/red dots on colony cards) is well-chosen — these are high-saturation colors that remain distinguishable even with screen brightness cranked up and sun washing out the display. Crucially, every color also has a text label fallback ("Active," "Dead Out," etc.), so it works for colorblind users too.

### What struggles in sunlight

**The offline banner distinction between red (offline) and orange (syncing) may be hard to differentiate** in bright light. Both are warm-toned, and direct sunlight compresses perceived color differences. Consider adding an icon or animation to the syncing state (a spinning arrow, for instance) rather than relying on the red/orange color difference alone.

**Modal overlays use `rgba(0,0,0,0.5)` backdrop.** On a phone in direct sunlight with brightness at max, a 50% black overlay barely dims the background — the modal content can visually blend with what's behind it. Increase to `rgba(0,0,0,0.7)` or use a solid background for the modal body.

**Event type badges use light pastel backgrounds** (light blue for Inspection, light purple for Treatment, etc.). Pastels wash out in sunlight. These should use the saturated versions of those colors, or switch to dark-on-light high-contrast pills.

**The "today" badge on YardCard uses green text on a light green background** — low contrast, likely invisible in sun glare.

### Recommendations

1. **Add an animated sync icon** to the syncing banner state instead of relying on the red/orange color distinction.
2. **Darken modal overlays to 0.7 opacity** and ensure modal bodies are fully opaque with clear borders.
3. **Switch event badges to high-contrast colors** — dark text on medium-saturation backgrounds, or inverted (white text on saturated backgrounds).
4. **Make the "today" badge high-contrast** — white text on solid green, not green-on-green.

---

## Criterion 4: Does the flow match how a beekeeper actually moves through their day?

### What maps well to real-world workflow

The app's information architecture — Yards → Colonies → Events — mirrors exactly how a commercial beekeeper thinks. You drive to a yard, open boxes in sequence, and log what you see. The Walk Yard feature is the standout here: it replicates the physical act of walking down a row of hives, doing the same check on each one, and moving on. The session persistence (resume a walk after closing the app) is critical — phones die, calls interrupt, smokers need refueling. The 24-hour expiry on saved sessions is a reasonable window.

The "Log All" batch feature correctly maps to how treatments work in practice: you mix a batch of syrup or lay Apivar strips, then apply the same treatment to every active colony in a yard. One tap for the type, one for save, done.

The colony status model (active/deadout) with the loss-event trigger that prompts "Mark Dead Out?" matches how beekeepers actually record losses — you open the box, see it's dead, and log it right there.

### Where the flow breaks

**Requeen events interrupt the logging flow.** When a beekeeper logs a requeen, the app immediately opens a QueenModal asking for marking color, source, introduction date, and notes. In the field, the beekeeper may not have this information handy — they may have just installed a queen cell and won't know the marking color for weeks. The modal has no "Skip" or "I'll add this later" option, which forces the user to either fill in incomplete data or find a way to dismiss the modal. This breaks the rhythm of sequential logging.

**The Walk Yard flow doesn't show a running summary.** A beekeeper walking a 200-hive yard wants to occasionally glance at "how many have I done, how many left, did I log that last one?" The progress bar shows position (Hive 45 of 200) but not a breakdown of logged vs. skipped vs. remaining. If you accidentally skip one, there's no way to go back without finishing the walk and starting over.

**There's no "yard-hopping" shortcut.** A beekeeper with multiple yards on a route might finish one yard and want to jump straight to the next. Currently they have to: finish → back to Home → find next yard → tap it. A "Next Yard" suggestion on the Walk Complete screen, based on proximity or creation order, would save time.

**Colony ordering in Walk Yard appears to follow creation order**, not the label sort the user may have set on YardView. If a beekeeper labeled their hives by physical position (Row 1: H-001 to H-020, Row 2: H-021 to H-040), the walk order should match physical layout. The sort preference from YardView should carry into Walk Yard.

### Recommendations

1. **Make the QueenModal skippable** after a requeen event — add "Add Later" button that saves the requeen event without queen details, and surface a reminder on the HiveView.
2. **Add a running tally to Walk Yard** — e.g., "23 logged · 2 skipped · 175 remaining" below the progress bar.
3. **Allow "go back one" in Walk Yard** to fix accidental skips.
4. **Carry sort preference from YardView into Walk Yard** so the walk order matches the physical layout the beekeeper expects.
5. **Add "Next Yard" suggestion** on the Walk Complete screen.

---

## Criterion 5: Are there points where a user could accidentally lose data or get confused about saved vs. unsaved?

### The offline architecture is mostly sound — with critical gaps

The write-path design (write to IndexedDB first, attempt Supabase, keep queued if offline) means the user's data is safe locally even without signal. The OfflineBanner is visible and shows pending change count. This is the right foundation.

### Where data loss or confusion can happen

**Silent permanent sync failures are the most dangerous issue.** The sync engine distinguishes between transient errors (5xx, timeouts — retried with backoff) and permanent errors (4xx — moved to a `failed` store and never retried). The problem: there is no UI anywhere that shows the user their permanently failed mutations. A beekeeper could log 50 inspections offline, drive back to signal, and have 3 of them silently fail with a 400 error due to, say, a deleted colony. They'd see the toast "Synced!" for the ones that worked, but never learn about the failures. For USDA compliance, this is a serious risk — the beekeeper believes the data is recorded, but it isn't.

**Deleting a yard cascades to all colonies and events with no recovery.** The confirmation modal says "This action cannot be undone," but a beekeeper who accidentally deletes a yard (easy to do on the Settings page where the 🗑 button sits next to editable text) loses their entire inspection history for that yard. For a commercial operation, this could mean losing months of compliance records. There is no soft-delete, no trash/archive, and no export-first prompt.

**The "Save" button on LogEvent gives no feedback if the save goes to the offline queue vs. succeeding online.** The user sees "Saved!" in both cases. This is mostly fine — the data is locally persisted either way — but the user has no way to know whether their data has actually reached the server. For compliance-sensitive operations (treatment logs with lot numbers and withdrawal periods), beekeepers need to know: "Is this on the record, or is it still on my phone?" The OfflineBanner shows a pending count, but by the time the user sees the "Saved!" screen, they've mentally moved on.

**Walk Yard session persistence has a subtle data-loss scenario.** If a beekeeper walks 150 of 200 hives, closes the app, and returns 25 hours later, the saved session has expired (24-hour limit). The app starts a fresh walk with no indication that their previous partial walk data was discarded. The 150 events that were already saved are fine (they were written individually), but the beekeeper may re-walk and double-log those 150 hives, creating duplicate records.

**Batch transfer has no preview or confirmation of which colonies are moving.** The user selects 5 colonies, taps "Move," picks a destination yard, and the transfer happens immediately. If the wrong colonies were selected (easy to do in gloves), there's no "Are you sure you want to move H-012, H-013, H-014 to North Field?" confirmation. The colonies vanish from the current yard view, and the user may not realize the mistake until they're physically at the wrong yard and the hive isn't there.

**No "unsaved changes" warning on the LogEvent or Walk Yard screens.** If a beekeeper selects an event type, types notes, then hits the back button (hardware or in-app), the data is silently discarded. There's no "You have unsaved changes" prompt. In a hectic field environment where phones get bumped and accidental back-swipes happen, this is a real data-loss vector.

### Recommendations

1. **Surface permanently failed syncs in the UI.** Add a "Failed Syncs" section in Settings (or a persistent warning badge) that shows what failed and lets the user retry or manually re-enter.
2. **Add a soft-delete / archive pattern for yards.** Instead of immediate cascade-delete, move to an "Archived" state that hides the yard from active views but preserves data for 30 days. Or at minimum, prompt "Export this yard's data before deleting?"
3. **Distinguish "saved locally" from "synced to server"** in the post-save feedback. A simple "Saved (pending sync)" vs. "Saved ✓" with different colors would suffice.
4. **Warn before expiring Walk Yard sessions.** Show a notification or badge on the yard card ("Unfinished walk — 150/200") and extend the expiry to 72 hours, since beekeepers may not return to the same yard for days.
5. **Add a confirmation step to batch transfers** that lists the specific colony labels being moved and the destination.
6. **Implement an "unsaved changes" guard** on LogEvent and Walk Yard that intercepts back-navigation when the form has been partially filled.

---

## Summary of Severity Ratings

| Issue | Criterion | Severity | Effort |
|---|---|---|---|
| Silent permanent sync failures — no UI | 5 (data loss) | **Critical** | Medium |
| Cascade-delete yards with no recovery | 5 (data loss) | **Critical** | Medium |
| No unsaved-changes guard on forms | 5 (data loss) | **High** | Low |
| Requeen modal not skippable | 4 (workflow) | **High** | Low |
| Modal buttons side-by-side (glove mis-tap) | 1 (gloves) | **High** | Low |
| Settings edit/delete mis-tap zone | 1 (gloves) | **High** | Medium |
| Batch transfer has no preview/confirm | 5 (data loss) | **High** | Low |
| Sort chips below 56 px / horizontal scroll | 1 (gloves) | **Medium** | Low |
| "Needs attention" filter too subtle | 2 (frequency) | **Medium** | Low |
| Event badges wash out in sunlight | 3 (sunlight) | **Medium** | Low |
| No "go back" in Walk Yard | 4 (workflow) | **Medium** | Medium |
| Modal backdrop too transparent | 3 (sunlight) | **Medium** | Low |
| Walk session expires without warning | 5 (data loss) | **Medium** | Low |
| Offline/syncing banner color too similar | 3 (sunlight) | **Low** | Low |
| No "Next Yard" on walk-complete | 4 (workflow) | **Low** | Low |
| Batch-add not default in Add Colony | 2 (frequency) | **Low** | Low |

---

## Bottom Line

HiveLog's core architecture is well-suited to its users. The Walk Yard flow, batch logging, offline-first writes, and high-contrast design system all reflect genuine understanding of how commercial beekeepers work. The app gets the 80% case right.

The critical issues cluster around **data trust** — specifically, the user's ability to know with certainty what has been saved, what hasn't, and what can't be recovered. For an app with USDA compliance implications, the gap between "locally queued" and "confirmed on server" needs to be explicit, and destructive actions need stronger guardrails. Fix the sync-failure visibility and the cascade-delete risk first; everything else is refinement.
