# HiveLog — Batch Operations & Walk Yard Optimization

## Context
A 30-day field simulation of a 1,200-hive commercial operation revealed three major friction points that account for 60%+ of unnecessary taps. This prompt addresses all three with minimal, surgical changes to the existing codebase.

**Read `CLAUDE.md` and `requirements.md` first.** Follow all stack, style, and UX constraints defined there.

---

## Priority 1: Treatment Persistence in Walk Yard (Est. ~15 lines changed)

### Problem
During Walk Yard, when a beekeeper selects "Treatment" and fills out the TreatmentForm (product, dosage, method, withdrawal, lot#), those values reset to blank on every hive advance. In a real treatment round, the beekeeper applies the **exact same treatment** to every hive in the yard. With 70 hives, that's 345 redundant form fills.

### Current Code (WalkYard.jsx, lines 150–165)
```js
function advance() {
  const next = currentIndex + 1;
  if (next >= colonies.length) {
    setFinished(true);
  } else {
    setCurrentIndex(next);
    setNotes('');
    setTreatmentDetails({       // ← THIS resets every advance
      product_name: '',
      dosage: '',
      application_method: '',
      withdrawal_period_days: '',
      lot_number: '',
    });
  }
}
```

### Required Changes

**A. Persist treatment details across advances (WalkYard.jsx)**

In the `advance()` function, **do NOT reset `treatmentDetails` when `selectedType === 'treatment'`**. Only reset notes (notes are per-hive). Change the advance function to:

```js
function advance() {
  const next = currentIndex + 1;
  if (next >= colonies.length) {
    setFinished(true);
  } else {
    setCurrentIndex(next);
    setNotes('');
    // Only reset treatment details if the event type is NOT treatment
    // (treatments use the same product/dosage/method across a walk)
    if (selectedType !== 'treatment') {
      setTreatmentDetails({
        product_name: '',
        dosage: '',
        application_method: '',
        withdrawal_period_days: '',
        lot_number: '',
      });
    }
  }
}
```

**B. Add a visual "Same treatment" indicator (WalkYard.jsx)**

When `selectedType === 'treatment'` and `currentIndex > 0` and `treatmentDetails.product_name` is non-empty, show a compact indicator above the TreatmentForm that tells the beekeeper the same treatment values will be applied. Include a "Change" button to expand the form if they need to adjust.

Add state to control form visibility:
```js
const [showTreatmentForm, setShowTreatmentForm] = useState(true);
```

Replace the current treatment form render block (`{selectedType === 'treatment' && (…)}`) with:

```jsx
{selectedType === 'treatment' && (
  <>
    {currentIndex > 0 && treatmentDetails.product_name && !showTreatmentForm ? (
      <div style={{
        backgroundColor: 'var(--color-surface)',
        border: '2px solid var(--color-accent)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        marginBottom: 'var(--space-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-md)',
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-body)' }}>
            Same treatment: {treatmentDetails.product_name}
          </span>
          {treatmentDetails.dosage && (
            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-sm)' }}>
              — {treatmentDetails.dosage}
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ minWidth: 'auto', minHeight: 44, padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--font-body)' }}
          onClick={() => setShowTreatmentForm(true)}
        >
          Change
        </button>
      </div>
    ) : (
      <TreatmentForm value={treatmentDetails} onChange={setTreatmentDetails} />
    )}
  </>
)}
```

When advancing to the next hive, collapse the form again so the compact indicator shows:
In the `advance()` function, after the treatment check, add:
```js
setShowTreatmentForm(false);
```

**C. Tap impact:**
- Before: 7 taps per hive × 70 hives = 490 taps for treatments
- After: 7 taps on first hive + 1 tap × 69 hives = 76 taps
- **Savings: 414 taps per treatment walk (~84% reduction)**

---

## Priority 2: Batch Transfer from Yard View (Est. ~120 lines new code)

### Problem
Transferring 160 hives from one yard to another requires navigating into each hive individually (HiveView → Move → pick yard → confirm). That's 5 taps × 160 hives = 800 taps. Commercial beekeepers regularly move entire pallets (48+ hives) or full yards between locations.

### Required Changes

**A. Add multi-select mode to YardView.jsx**

Add these state variables to the YardView component:
```js
const [selectMode, setSelectMode] = useState(false);
const [selected, setSelected] = useState(new Set());
const [showBatchTransfer, setShowBatchTransfer] = useState(false);
const [batchYards, setBatchYards] = useState([]);
const [batchTransferring, setBatchTransferring] = useState(false);
```

**B. Add a "Select" toggle button** in the yard-wide action bar (alongside "Log All" and "Walk Yard"):

Below the existing `<div style={{ display: 'flex', gap: 'var(--space-md)' }}>` block that contains Log All and Walk Yard, add a second row:

```jsx
{!selectMode ? (
  <button
    className="btn btn-secondary"
    style={{ width: '100%', marginTop: 'var(--space-sm)', height: '56px', fontSize: 'var(--font-body)' }}
    onClick={() => setSelectMode(true)}
  >
    Select Hives to Move
  </button>
) : (
  <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
    <button
      className="btn btn-secondary"
      style={{ flex: 1, height: '56px', fontSize: 'var(--font-body)' }}
      onClick={() => {
        setSelectMode(false);
        setSelected(new Set());
      }}
    >
      Cancel
    </button>
    <button
      className="btn btn-primary"
      style={{ flex: 1, height: '56px', fontSize: 'var(--font-body)' }}
      onClick={() => handleSelectAll(result)}
    >
      {selected.size === result.length ? 'Deselect All' : `Select All (${result.length})`}
    </button>
    {selected.size > 0 && (
      <button
        className="btn btn-primary"
        style={{ flex: 1, height: '56px', fontSize: 'var(--font-body)', backgroundColor: 'var(--color-status-green)', border: 'none' }}
        onClick={openBatchTransferModal}
      >
        Move ({selected.size})
      </button>
    )}
  </div>
)}
```

**Note:** `result` is the filtered/sorted colony list in the render. You'll need to restructure the render slightly so the select buttons have access to the filtered `result` array. The cleanest way: extract the colony filtering/sorting into a `useMemo` before the return statement.

**C. Modify colony card rendering in select mode**

When `selectMode` is true, wrap each ColonyCard in a selectable container. Replace the `onClick` on the ColonyCard to toggle selection instead of navigation:

```jsx
<div
  key={colony.id}
  onClick={() => {
    if (selectMode) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(colony.id)) next.delete(colony.id);
        else next.add(colony.id);
        return next;
      });
    } else {
      navigate(`/hive/${colony.id}`, { state: … });
    }
  }}
  style={selectMode ? {
    position: 'relative',
    border: selected.has(colony.id) ? '3px solid var(--color-accent)' : '3px solid transparent',
    borderRadius: 'var(--radius-md)',
    transition: 'border-color 0.1s',
  } : undefined}
>
  {selectMode && (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: '3px solid var(--color-accent)',
      backgroundColor: selected.has(colony.id) ? 'var(--color-accent)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    }}>
      {selected.has(colony.id) && (
        <span style={{ color: 'var(--color-accent-text)', fontWeight: 700, fontSize: 16 }}>✓</span>
      )}
    </div>
  )}
  <ColonyCard
    colony={colony}
    hasQueen={queenSet.has(colony.id)}
    activeWithdrawal={withdrawalMap[colony.id] || null}
    onClick={selectMode ? undefined : () => navigate(…)}
  />
</div>
```

**D. Add helper functions:**

```js
function handleSelectAll(visibleColonies) {
  if (selected.size === visibleColonies.length) {
    setSelected(new Set());
  } else {
    setSelected(new Set(visibleColonies.map((c) => c.id)));
  }
}

async function openBatchTransferModal() {
  try {
    const { data: yardData } = await supabase
      .from('yards')
      .select('id, name')
      .order('name');
    setBatchYards((yardData || []).filter((y) => y.id !== id));
  } catch {
    const cached = await cacheGet('yards', 'all');
    if (cached) {
      setBatchYards((cached || []).filter((y) => y.id !== id));
    }
  }
  setShowBatchTransfer(true);
}

async function handleBatchTransfer(destYard) {
  setBatchTransferring(true);
  const originName = yard?.name || 'Unknown';
  const colonyIds = [...selected];

  for (const colonyId of colonyIds) {
    const eventData = {
      id: crypto.randomUUID(),
      colony_id: colonyId,
      type: 'transfer',
      notes: `Transferred from ${originName} to ${destYard.name}`,
      logged_by: user.id,
    };
    const updateData = { id: colonyId, yard_id: destYard.id };

    try {
      const { error: updateError } = await supabase
        .from('colonies')
        .update({ yard_id: destYard.id })
        .eq('id', colonyId);
      if (updateError) throw updateError;

      const { error: eventError } = await supabase
        .from('events')
        .insert(eventData);
      if (eventError) throw eventError;
    } catch {
      await addToQueue({ table: 'colonies', operation: 'update', data: updateData });
      await addToQueue({ table: 'events', operation: 'insert', data: eventData });
    }
  }

  setBatchTransferring(false);
  setShowBatchTransfer(false);
  setSelectMode(false);
  setSelected(new Set());

  // Refresh data to reflect moved colonies
  fetchData();
}
```

**E. Add the batch transfer modal** (reuse the same pattern as HiveView's transfer modal):

```jsx
{showBatchTransfer && (
  <div className="modal-overlay" onClick={() => setShowBatchTransfer(false)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <h2>Move {selected.size} {selected.size === 1 ? 'Hive' : 'Hives'}</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
        Select destination yard
      </p>
      {batchYards.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>No other yards available</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {batchYards.map((y) => (
            <button
              key={y.id}
              className="btn btn-secondary"
              style={{
                width: '100%',
                minHeight: 56,
                fontSize: 'var(--font-body)',
                textAlign: 'left',
                justifyContent: 'flex-start',
              }}
              onClick={() => handleBatchTransfer(y)}
              disabled={batchTransferring}
            >
              {batchTransferring ? 'Moving...' : y.name}
            </button>
          ))}
        </div>
      )}
      <button
        className="btn btn-secondary"
        style={{ width: '100%', marginTop: 'var(--space-lg)' }}
        onClick={() => setShowBatchTransfer(false)}
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

**F. Tap impact:**
- Before: 5 taps × 160 hives = 800 taps
- After: 1 (Select) + 1 (Select All) + 1 (Move) + 1 (pick yard) = **4 taps total**
- **Savings: 796 taps (~99.5% reduction)**

---

## Priority 3: Walk Yard Pause & Resume (Est. ~25 lines new code)

### Problem
Walking 70+ hives in one session causes hand fatigue in gloves and heat exhaustion. If the beekeeper taps "Done (finish early)" at hive 34, there's no way to resume from hive 35 later. They'd have to re-walk from hive 1 and skip 34 already-logged hives.

### Required Changes (WalkYard.jsx)

**A. Save session progress on every advance and on "Done"**

Add a localStorage key pattern: `hivelog_walkSession_{yardId}`

After `setCurrentIndex(next)` in the `advance()` function, save the session:
```js
function advance() {
  const next = currentIndex + 1;
  if (next >= colonies.length) {
    // Walk complete — clear saved session
    localStorage.removeItem(`hivelog_walkSession_${yardId}`);
    setFinished(true);
  } else {
    setCurrentIndex(next);
    setNotes('');
    if (selectedType !== 'treatment') {
      setTreatmentDetails({
        product_name: '',
        dosage: '',
        application_method: '',
        withdrawal_period_days: '',
        lot_number: '',
      });
    }
    setShowTreatmentForm(false);

    // Save session so user can resume later
    localStorage.setItem(`hivelog_walkSession_${yardId}`, JSON.stringify({
      currentIndex: next,
      selectedType,
      treatmentDetails: selectedType === 'treatment' ? treatmentDetails : null,
      timestamp: Date.now(),
    }));
  }
}
```

**B. Update `handleDone` to save the pause point:**

```js
function handleDone() {
  // Save pause point so user can resume
  if (currentIndex < colonies.length) {
    localStorage.setItem(`hivelog_walkSession_${yardId}`, JSON.stringify({
      currentIndex,
      selectedType,
      treatmentDetails: selectedType === 'treatment' ? treatmentDetails : null,
      timestamp: Date.now(),
    }));
  }
  setFinished(true);
}
```

**C. On mount, check for a saved session and offer to resume**

Add a state variable:
```js
const [resumePrompt, setResumePrompt] = useState(null);
```

After colonies are fetched (at the end of `fetchColonies`, after `setLoading(false)`), check for a saved session:
```js
// Inside fetchColonies, after setResults(…) and setLoading(false):
const savedSession = localStorage.getItem(`hivelog_walkSession_${yardId}`);
if (savedSession) {
  try {
    const session = JSON.parse(savedSession);
    // Only offer resume if the saved index is valid and session is less than 24 hours old
    const ageHours = (Date.now() - session.timestamp) / 3600000;
    if (session.currentIndex > 0 && session.currentIndex < (colonyData || []).length && ageHours < 24) {
      setResumePrompt(session);
    } else {
      localStorage.removeItem(`hivelog_walkSession_${yardId}`);
    }
  } catch {
    localStorage.removeItem(`hivelog_walkSession_${yardId}`);
  }
}
```

**D. Add a resume prompt UI** — render it before the main walk UI when `resumePrompt` is set and `!finished`:

After the `colonies.length === 0` early return and before the `finished` check, add:

```jsx
if (resumePrompt && !finished) {
  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(`/yard/${yardId}`, { replace: true })}>←</button>
        <h1>Walk Yard</h1>
      </div>
      <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
        <p style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>
          Resume Walk?
        </p>
        <p style={{ fontSize: 'var(--font-body)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)' }}>
          You paused at hive {resumePrompt.currentIndex + 1} of {colonies.length}
          {resumePrompt.selectedType && ` (${resumePrompt.selectedType})`}
        </p>
        <button
          className="btn btn-primary"
          style={{ width: '100%', height: '72px', fontSize: 'var(--font-xl)', marginBottom: 'var(--space-md)' }}
          onClick={() => {
            setCurrentIndex(resumePrompt.currentIndex);
            if (resumePrompt.selectedType) setSelectedType(resumePrompt.selectedType);
            if (resumePrompt.treatmentDetails) setTreatmentDetails(resumePrompt.treatmentDetails);
            setResumePrompt(null);
          }}
        >
          Resume from Hive {resumePrompt.currentIndex + 1}
        </button>
        <button
          className="btn btn-secondary"
          style={{ width: '100%', height: '56px', fontSize: 'var(--font-body)' }}
          onClick={() => {
            localStorage.removeItem(`hivelog_walkSession_${yardId}`);
            setResumePrompt(null);
          }}
        >
          Start Fresh
        </button>
      </div>
    </div>
  );
}
```

**E. Clear session on natural walk completion**

In the `finished` screen's "Back to Yard" button handler, also clear the session:
```js
onClick={() => {
  localStorage.removeItem(`hivelog_walkSession_${yardId}`);
  navigate(`/yard/${yardId}`, { replace: true });
}}
```

**F. Impact:**
- Beekeepers can do 30 hives, take a break, resume from 31
- No data loss — all saves happen immediately via Supabase or offline queue
- 24-hour expiry prevents stale sessions from confusing the UI

---

## Implementation Order

1. **Treatment persistence** (Priority 1) — smallest change, highest per-tap savings, zero risk
2. **Walk Yard pause/resume** (Priority 3) — small change, important QoL at scale
3. **Batch transfer** (Priority 2) — largest change but biggest absolute savings; do last so it gets the most review

## Files Modified

| File | Change Type | Scope |
|---|---|---|
| `src/pages/WalkYard.jsx` | Modified | Treatment persistence + pause/resume |
| `src/pages/YardView.jsx` | Modified | Multi-select + batch transfer |
| No new files | — | All changes fit in existing files |
| No new dependencies | — | Uses only localStorage + existing Supabase client |
| No schema changes | — | Transfer type already in CHECK constraint |

## Testing Checklist

- [ ] Walk Yard: treatment details persist from hive 1 → hive 2 → hive N
- [ ] Walk Yard: "Same treatment" indicator shows on hive 2+ with correct product name
- [ ] Walk Yard: "Change" button expands TreatmentForm; edited values persist forward
- [ ] Walk Yard: non-treatment event types still reset the form as before
- [ ] Walk Yard: tapping "Done (finish early)" then re-entering shows resume prompt
- [ ] Walk Yard: "Resume" restores correct index, event type, and treatment details
- [ ] Walk Yard: "Start Fresh" clears saved session and starts from hive 1
- [ ] Walk Yard: sessions older than 24 hours are auto-cleared
- [ ] Walk Yard: completing all hives clears the saved session
- [ ] YardView: "Select Hives to Move" enters multi-select mode
- [ ] YardView: tapping colony cards toggles checkmark in select mode
- [ ] YardView: "Select All" selects all visible (filtered) colonies
- [ ] YardView: "Move (N)" opens yard picker modal
- [ ] YardView: selecting destination yard transfers all selected colonies
- [ ] YardView: transfer events are logged for each moved colony
- [ ] YardView: offline fallback queues all transfer operations
- [ ] YardView: colony list refreshes after batch transfer completes
- [ ] YardView: "Cancel" exits select mode and clears selections
- [ ] All changes work offline (mutations queued in IndexedDB)
- [ ] No `console.log` statements in final code
- [ ] All touch targets ≥ 56px
- [ ] All text ≥ 18px body / ≥ 20px buttons
- [ ] WCAG AAA contrast maintained on all new elements

## Reminder: Scope Fence

Do NOT add:
- Drag-and-drop multi-select
- Swipe-to-select gestures
- Batch editing of event types (out of scope)
- Colony merging or splitting from select mode
- Any new database tables or columns
- Any new npm dependencies
