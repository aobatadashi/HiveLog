# Home Page Stats Banner — Implementation Prompt

Paste the block below into Claude Code.

---

```
Read CLAUDE.md in the project root before making any changes. Follow the stack and style constraints exactly.

Add a fleet-wide summary stats banner to the Home page (src/pages/Home.jsx). This sits between the page header ("My Yards" + Settings button) and the search bar. No new queries needed — the data is already in the `yards` state array, which has `colony_count` and `last_activity` on each yard object.

## What to build

A single compact stats row that looks like this:

  1,200 colonies  ·  15 yards  ·  3 need attention

Requirements:

1. **Compute from existing state.** After `yards` loads, derive:
   - `totalColonies` = sum of all `yard.colony_count`
   - `totalYards` = `yards.length`
   - `needsAttention` = yards where `last_activity` is null OR older than 14 days from now

2. **Render as a horizontal bar** between the page-header div and the search-wrap div. Use a simple flex row with centered text. Style it:
   - Background: `var(--color-surface)` with `var(--shadow-card)` — same as a card but flatter
   - Border-radius: `var(--radius-md)`
   - Padding: `var(--space-md) var(--space-lg)`
   - Margin-bottom: `var(--space-lg)`
   - Font: `var(--font-body)` (18px), weight 600
   - Separate the three stats with a middle dot (·) in `var(--color-text-secondary)`
   - The "need attention" count should be colored `var(--color-warning)` (#e65100) when > 0, and `var(--color-status-green)` when 0 (show "0 need attention" as a positive signal, don't hide it)

3. **Tappable "need attention" filter.** When the user taps the "N need attention" segment:
   - Set the search/filter state to show only yards needing attention (last_activity null or > 14 days)
   - Add a new state variable `filterAttention` (boolean, default false)
   - When `filterAttention` is true, filter the yards list to only those needing attention, and change the "need attention" text to show "Showing N needing attention" with a small "×" clear button
   - The existing text search should still work alongside this filter (both filters apply)
   - Tapping the "×" or tapping the stat again clears the filter

4. **Don't show the banner when there are no yards.** Only render it when `yards.length > 0` and `!loading`.

5. **Number formatting.** Use `toLocaleString()` for the colony count so large numbers get commas (1,200 not 1200).

6. **Touch target.** The "need attention" segment must be a button with min-height 44px (it's inline within the stats bar, so full 56px would be too tall — 44px is acceptable here since it's a secondary action).

## Code location

All changes go in `src/pages/Home.jsx`. No new files, no new components, no new CSS classes needed — use inline styles consistent with the rest of the codebase.

## What NOT to do

- Don't add new Supabase queries
- Don't create a separate component file for this
- Don't use any CSS framework or new dependencies
- Don't change the existing yard card rendering or search behavior
- Don't add TypeScript
```
