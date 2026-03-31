# HiveLog — 30-Day Field Simulation & Efficiency Analysis

Paste the block below into Claude Code (Opus 4.6).

---

```
Read CLAUDE.md and hivelog-ux-audit.md in the project root for full context on the app, its architecture, and known UX issues.

You are simulating one calendar month (June 2026) in the life of **Jake Tanner**, a commercial beekeeper running a 1,200-hive pollination and honey operation out of Bakersfield, CA. Jake has 18 yards spread across the Central Valley. June is his busiest month — almonds are done, he's pulling supers from orange blossom, treating for varroa, splitting strong colonies, moving loads to sage brush locations, and losing hives to heat stress.

Your job is to write and execute a test script that:
1. Seeds realistic data (yards, colonies, events) into the app via Supabase
2. Simulates Jake's daily workflow through the actual app UI by measuring the interactions programmatically
3. Produces a detailed efficiency analysis comparing HiveLog to a paper ledger

## Phase 1: Seed the Operation

Write a Node.js script (`tests/seed_simulation.js`) that connects to Supabase using the env vars in `.env.local` and creates Jake's operation. Use the Supabase JS client directly (already in package.json).

**Yards (18 total):**
Create yards with realistic Central Valley names and location notes. Mix of sizes:
- 4 large yards (80–120 colonies each) — e.g., "Harris Ranch East", "Lerdo Hwy", "Rosedale North", "Weedpatch"
- 6 medium yards (40–70 colonies each) — e.g., "Panama Ln", "Lamont South", "Edison Rd", "Arvin West", "Shafter #2", "McFarland"
- 8 small yards (15–30 colonies each) — e.g., "Bear Mountain", "Caliente Creek", "Woody", "Glennville", "Alta Sierra", "Sand Canyon", "Bodfish", "Lake Isabella"

Total should land at ~1,200 colonies. Label colonies with the yard prefix + 3-digit number (e.g., HR-001, HR-002 for Harris Ranch East).

**Pre-existing events (May history):**
Seed 2–3 weeks of prior event history so the app doesn't start cold:
- Every colony should have at least 1 inspection from mid-May
- ~30% of colonies should have a feeding event from late May
- ~15% should have a treatment event (Apivar or Formic Pro) from early May with withdrawal periods
- ~5% should already be marked as dead-outs with loss events
- A few queens should be recorded (maybe 20% of colonies) with random marking colors and sources

## Phase 2: Simulate June — Day by Day

Write a second script (`tests/simulate_june.js`) that simulates Jake's daily actions by calling the app's Supabase client directly (mirroring what the UI does). For each day, the script should:

1. **Decide what Jake does today** based on realistic commercial beekeeper patterns:
   - 5–6 days per week in the field (Sun–Fri, Saturdays off)
   - Each field day: visit 2–3 yards, inspect/log 40–80 hives
   - Weather interruptions: 3 random days in June are too hot (>110°F) — Jake only does morning rounds on those days (half the normal volume)
   - One 3-day stretch mid-month where Jake is moving 200 hives to a new sage location (transfers)

2. **Execute the actions** and log them as events in Supabase, tracking:
   - **Tap count per action** based on the actual UI flow:
     - Open app and navigate to a yard: 2 taps (app open + yard card)
     - Walk Yard mode (inspection on N hives): 2 + (N × 2) taps (Walk Yard button + select type once + Save&Next per hive)
     - Log single event on one hive: 5 taps (yard + colony + Log Event + type + Save)
     - Log yard-wide batch event: 4 taps (yard + Log All + type + Save)
     - Transfer a hive: 5 taps (yard + colony + Move button + destination yard + confirm)
     - Mark dead-out from loss event: 6 taps (yard + colony + Log Event + Loss + Save + Confirm)
     - Record treatment with details: 7 taps (yard + colony + Log Event + Treatment + product + Save + done) — not counting dosage/withdrawal typing
   - **Time estimate per action** (conservative, gloves-on):
     - Each tap: 1.5 seconds (gloved, sunlight, phone)
     - Typing a note: 15 seconds
     - Navigating between yards: 3 seconds (back + scroll + tap)
     - Screen load/transition: 1 second
   - **Paper ledger equivalent time** for the same action:
     - Find the right page in the binder: 8 seconds
     - Write one hive inspection line (date, hive #, checkmark): 6 seconds
     - Write a treatment record with product/dosage: 20 seconds
     - Write a transfer note: 15 seconds
     - Flip to dead-out section, record loss: 12 seconds
     - Look up "when did I last inspect yard X": 45–90 seconds (flip through pages)
     - Look up "which hives are in withdrawal": 2–5 minutes (cross-reference treatment dates)
     - End-of-day totals (count inspections done today): 5–10 minutes

3. **Track daily and monthly totals** in a results object:
   - Events created per day (by type)
   - Total taps per day
   - Estimated HiveLog time per day (seconds)
   - Estimated paper time per day (seconds)
   - Offline events (randomly simulate 2–3 days where Jake loses signal for a portion of his route — queue events then sync)
   - Any UI friction moments (e.g., "needed to type a note but wearing gloves — added 20 seconds", "had to scroll past 60 dead-outs to find active hives")

Here's a rough daily schedule for June. Adjust freely to be realistic:

**Week 1 (June 1–6): Post-almond inspection sweep**
- Visiting every yard to assess colony strength after almond season
- Heavy inspection logging — 60–80 inspections per day
- Marking 3–5 dead-outs per day (winter/spring losses discovered now)
- Recording queen status on strong colonies

**Week 2 (June 8–13): Treatment week**
- Applying Apivar strips to ~400 colonies across 6 yards (high mite counts)
- Each treatment needs: product name, dosage (2 strips), application method (strips), withdrawal (42 days)
- Also logging inspections on non-treatment yards
- 2 days with partial offline (foothill yards — Bear Mountain, Caliente Creek)

**Week 3 (June 15–20): Honey harvest + splits**
- Pulling supers from 3 large yards — logging harvest events with notes like "4 supers pulled"
- Splitting 30 strong colonies (split events + requeen events on the new splits)
- Moving 200 hives from almond yards to sage (June 17–19 — transfer events)
- One day too hot (>110°F) — morning-only rounds

**Week 4 (June 22–27): Feeding + catch-up**
- Feeding weak colonies across 4 yards (sugar syrup, 1:1)
- Follow-up inspections on Week 2 treatments
- Two more dead-outs from heat stress
- Recording queen observations on remaining colonies
- End-of-month data export for compliance records

## Phase 3: Generate the Report

After the simulation runs, generate a markdown report (`tests/SIMULATION_REPORT.md`) that includes:

### A. Volume Summary
- Total events logged in June (broken down by type)
- Total colonies touched
- Total yards visited
- Average events per field day
- Peak day (most events)

### B. Tap Efficiency Analysis
- Total taps across the month
- Average taps per field day
- Taps per event (overall and by type)
- Which workflows consumed the most taps
- How many taps Walk Yard mode saved vs. individual logging (calculate both)
- How many taps the "repeat last event type" feature saved

### C. Time Comparison: HiveLog vs. Paper
Build a detailed table:

| Activity | Occurrences | HiveLog Time | Paper Time | Delta |
|----------|------------|-------------|-----------|-------|
| Standard inspection | N | Xs | Ys | -Z% |
| Treatment with details | N | Xs | Ys | -Z% |
| ... | | | | |
| **TOTAL** | | **Xm** | **Ym** | **-Z%** |

Include these paper-only overhead tasks that HiveLog eliminates:
- End-of-day tallying (paper: 10 min/day, HiveLog: 0)
- "Which yards need inspection?" lookup (paper: 5 min/morning, HiveLog: glance at Home screen stats banner — 3 seconds)
- "Which hives are in withdrawal?" (paper: 5–10 min to cross-reference, HiveLog: glance at withdrawal badges — 5 seconds)
- Monthly compliance export (paper: 2–4 hours to compile treatment records into a spreadsheet, HiveLog: 3 taps)
- Lost/illegible records (paper: estimate 2–3% data loss from rain, sweat, smudging — HiveLog: 0%)

### D. Offline Resilience Test
- How many events were queued offline during the simulation
- What would have happened with paper (nothing — paper works offline by default, this is paper's advantage)
- What would have happened if Jake didn't have HiveLog's queue (lost data)
- Net assessment: does HiveLog's offline mode make it trustworthy enough to replace paper?

### E. Friction Log
List every moment where the simulation identified friction:
- "Day 4: needed to record queen color but had to navigate into hive view first (2 extra taps)"
- "Day 11: applying same treatment to 80 hives — Walk Yard mode + treatment form required scrolling on each save"
- "Day 17: transferring 70 hives took 350 taps — no batch transfer feature"
- etc.

### F. Verdict
Based on the numbers, answer these questions plainly:
1. **Is HiveLog faster than paper for a 1,200-hive operation?** By how much?
2. **Where does paper still win?** (Be honest — paper has zero boot time, works in rain, never runs out of battery)
3. **What are the top 3 features that would make the biggest difference for Jake's June?** (based on actual friction encountered, not theoretical)
4. **Would you trust this app to be your only record system?** What would need to change for a commercial operator to ditch the paper backup entirely?

## Execution Notes

- Run both scripts with `node tests/seed_simulation.js` and `node tests/simulate_june.js`
- Both scripts must read VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from `.env.local`
- Use a service role key if available, or create a test user and authenticate first
- Log progress to stdout as the simulation runs so I can watch it
- If the simulation would create more than 20,000 events, that's fine — this is a scale test too
- Clean up: at the end, ask whether to keep or delete the simulation data. Generate a cleanup script (`tests/cleanup_simulation.sql`) either way.
- The simulation scripts should be idempotent — check if simulation data already exists before re-seeding

## What NOT to do

- Don't modify any app source code — this is a read-only simulation against the existing app
- Don't create mock Supabase — use the real instance
- Don't skip the paper comparison — that's the whole point. The customer needs to see hard numbers proving the app is worth switching to.
- Don't be generous with HiveLog's numbers or harsh with paper's. Be realistic. A skeptical 60-year-old beekeeper is reading this report.
```
