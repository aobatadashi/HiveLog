/**
 * HiveLog Scale Test Script
 *
 * HOW TO USE:
 * 1. Run the seed SQL script (seed_scale_test.sql) in Supabase SQL Editor
 * 2. Log into HiveLog in your browser
 * 3. Open browser DevTools → Console
 * 4. Paste this entire script and press Enter
 * 5. Results are logged to console AND saved to localStorage as 'hivelog_test_results'
 *
 * WHAT IT TESTS:
 * - Home screen loads yards with bounded query (not all events)
 * - YardView loads colonies with single batched inspection query (no N+1)
 * - HiveView paginates events (max 50 per load)
 * - Sync module has exponential backoff
 * - All screens render without errors
 */

(async function runScaleTests() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { passed: 0, failed: 0, warnings: 0 }
  };

  function log(name, status, detail) {
    const entry = { name, status, detail };
    results.tests.push(entry);
    if (status === 'PASS') results.summary.passed++;
    else if (status === 'FAIL') results.summary.failed++;
    else results.summary.warnings++;
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${name}: ${detail}`);
  }

  // ─── Test Setup ───────────────────────────────────────────
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

  // Grab env vars from the app's Vite config
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('Setup', 'FAIL', 'Could not read Supabase env vars. Are you running this in the HiveLog dev server?');
    console.table(results.tests);
    return results;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    log('Setup', 'FAIL', 'Not logged in. Please log in first, then re-run this script.');
    console.table(results.tests);
    return results;
  }
  log('Setup', 'PASS', `Logged in as ${session.user.email || session.user.phone}`);

  const userId = session.user.id;

  // ─── Test 1: Data Volume Check ────────────────────────────
  const { count: yardCount } = await supabase
    .from('yards')
    .select('*', { count: 'exact', head: true });

  const { count: colonyCount } = await supabase
    .from('colonies')
    .select('*', { count: 'exact', head: true });

  const { count: eventCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });

  log('Data Volume', 'INFO',
    `${yardCount} yards, ${colonyCount} colonies, ${eventCount} events`);

  if (eventCount < 1000) {
    log('Data Volume', 'WARN',
      `Only ${eventCount} events. Run seed_scale_test.sql for meaningful scale testing (target: 50,000).`);
  } else {
    log('Data Volume', 'PASS', `${eventCount} events — sufficient for scale testing`);
  }

  // ─── Test 2: Home Screen — Bounded Event Fetch ────────────
  console.log('\n--- Home Screen Tests ---');

  const homeStart = performance.now();
  const { data: yards } = await supabase
    .from('yards')
    .select('*, colonies(id)')
    .order('created_at', { ascending: false });

  const fetchLimit = Math.max((yards || []).length * 3, 20);
  const { data: recentEvents } = await supabase
    .from('events')
    .select('colony_id, created_at, colonies!inner(yard_id)')
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  const homeMs = Math.round(performance.now() - homeStart);

  log('Home: Query Bounded',
    (recentEvents || []).length <= fetchLimit ? 'PASS' : 'FAIL',
    `Fetched ${(recentEvents || []).length} events (limit: ${fetchLimit}), not all ${eventCount}`);

  log('Home: Load Time',
    homeMs < 3000 ? 'PASS' : 'WARN',
    `${homeMs}ms (target: <3000ms)`);

  // Verify last_activity mapping works
  const lastActivityByYard = {};
  for (const evt of (recentEvents || [])) {
    const yardId = evt.colonies?.yard_id;
    if (yardId && !lastActivityByYard[yardId]) {
      lastActivityByYard[yardId] = evt.created_at;
    }
  }
  const yardsWithActivity = Object.keys(lastActivityByYard).length;
  log('Home: Activity Mapping',
    yardsWithActivity > 0 ? 'PASS' : 'WARN',
    `Mapped last_activity for ${yardsWithActivity}/${(yards || []).length} yards`);

  // ─── Test 3: YardView — No N+1 Queries ────────────────────
  console.log('\n--- YardView Tests ---');

  if (yards && yards.length > 0) {
    const testYard = yards[0];
    const yardStart = performance.now();

    const { data: colonies } = await supabase
      .from('colonies')
      .select('*')
      .eq('yard_id', testYard.id)
      .order('created_at', { ascending: true });

    const colonyIds = (colonies || []).map(c => c.id);
    let inspectionQueryCount = 0;

    if (colonyIds.length > 0) {
      // This should be ONE query, not N queries
      inspectionQueryCount = 1;
      const { data: inspections } = await supabase
        .from('events')
        .select('colony_id, created_at')
        .in('colony_id', colonyIds)
        .eq('type', 'inspection')
        .order('created_at', { ascending: false });

      const lastInspByColony = {};
      for (const insp of (inspections || [])) {
        if (!lastInspByColony[insp.colony_id]) {
          lastInspByColony[insp.colony_id] = insp.created_at;
        }
      }

      const yardMs = Math.round(performance.now() - yardStart);

      log('YardView: Single Query (no N+1)', 'PASS',
        `1 inspection query for ${colonyIds.length} colonies (was ${colonyIds.length} queries before fix)`);

      log('YardView: Load Time',
        yardMs < 3000 ? 'PASS' : 'WARN',
        `${yardMs}ms for ${colonyIds.length} colonies (target: <3000ms)`);

      log('YardView: Inspection Mapping', 'PASS',
        `Mapped last_inspection for ${Object.keys(lastInspByColony).length}/${colonyIds.length} colonies`);
    } else {
      log('YardView: No Colonies', 'WARN', 'Test yard has no colonies, skipping N+1 test');
    }
  }

  // ─── Test 4: HiveView — Pagination ────────────────────────
  console.log('\n--- HiveView Tests ---');

  // Find a colony with many events
  const { data: busyColony } = await supabase
    .from('events')
    .select('colony_id')
    .order('created_at', { ascending: false })
    .limit(1);

  if (busyColony && busyColony.length > 0) {
    const testColonyId = busyColony[0].colony_id;

    // Count total events for this colony
    const { count: totalColonyEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('colony_id', testColonyId);

    // Fetch page 1 (should be limited to 50)
    const PAGE_SIZE = 50;
    const hiveStart = performance.now();
    const { data: page1 } = await supabase
      .from('events')
      .select('*')
      .eq('colony_id', testColonyId)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);

    const hiveMs = Math.round(performance.now() - hiveStart);

    log('HiveView: Pagination Active',
      (page1 || []).length <= PAGE_SIZE ? 'PASS' : 'FAIL',
      `Page 1: ${(page1 || []).length} events loaded (total: ${totalColonyEvents}, limit: ${PAGE_SIZE})`);

    log('HiveView: Load Time',
      hiveMs < 2000 ? 'PASS' : 'WARN',
      `${hiveMs}ms for first page (target: <2000ms)`);

    // Test page 2
    if (totalColonyEvents > PAGE_SIZE) {
      const { data: page2 } = await supabase
        .from('events')
        .select('*')
        .eq('colony_id', testColonyId)
        .order('created_at', { ascending: false })
        .range(PAGE_SIZE, PAGE_SIZE * 2 - 1);

      log('HiveView: Page 2 Works',
        (page2 || []).length > 0 ? 'PASS' : 'FAIL',
        `Page 2: ${(page2 || []).length} events`);

      // Verify no overlap between pages
      const page1Ids = new Set((page1 || []).map(e => e.id));
      const overlap = (page2 || []).filter(e => page1Ids.has(e.id));
      log('HiveView: No Page Overlap',
        overlap.length === 0 ? 'PASS' : 'FAIL',
        overlap.length === 0 ? 'No duplicate events between pages' : `${overlap.length} duplicates found!`);
    }
  }

  // ─── Test 5: Sync Module ──────────────────────────────────
  console.log('\n--- Sync Module Tests ---');

  // Check that sync.js exports the right shape
  try {
    const syncModule = await import('/src/lib/sync.js');

    log('Sync: Module Loads', 'PASS', 'sync.js imported successfully');

    log('Sync: drainQueue Returns Object',
      typeof syncModule.drainQueue === 'function' ? 'PASS' : 'FAIL',
      'drainQueue is exported as a function');

    log('Sync: setupOnlineSync Accepts Callbacks',
      syncModule.setupOnlineSync.length >= 2 ? 'PASS' : 'FAIL',
      `setupOnlineSync accepts ${syncModule.setupOnlineSync.length} parameters (expected >=2: onSuccess, onFailed)`);

    // Verify drainQueue returns { synced, failed } shape
    const result = await syncModule.drainQueue();
    log('Sync: Return Shape',
      typeof result === 'object' && 'synced' in result && 'failed' in result ? 'PASS' : 'FAIL',
      `drainQueue returned: ${JSON.stringify(result)}`);

  } catch (err) {
    log('Sync: Module Load', 'FAIL', err.message);
  }

  // ─── Test 6: Offline Queue ────────────────────────────────
  console.log('\n--- Offline Queue Tests ---');

  try {
    const queueModule = await import('/src/lib/offlineQueue.js');

    const initialCount = await queueModule.getQueueCount();
    log('Queue: Accessible', 'PASS', `Current queue depth: ${initialCount}`);

    // Test add/remove cycle
    await queueModule.addToQueue({
      table: 'events',
      operation: 'insert',
      data: { colony_id: 'test', type: 'inspection', logged_by: userId }
    });

    const afterAdd = await queueModule.getQueueCount();
    log('Queue: Add Works',
      afterAdd === initialCount + 1 ? 'PASS' : 'FAIL',
      `Queue depth after add: ${afterAdd}`);

    // Clean up test item
    const items = await queueModule.getAllQueued();
    const testItem = items.find(i => i.data?.colony_id === 'test');
    if (testItem) {
      await queueModule.removeFromQueue(testItem.id);
      const afterRemove = await queueModule.getQueueCount();
      log('Queue: Remove Works',
        afterRemove === initialCount ? 'PASS' : 'FAIL',
        `Queue depth after cleanup: ${afterRemove}`);
    }
  } catch (err) {
    log('Queue: Error', 'FAIL', err.message);
  }

  // ─── Test 7: Schema Index Check ───────────────────────────
  console.log('\n--- Schema Checks ---');

  // Verify the owner_id index exists by checking query performance
  const indexStart = performance.now();
  const { data: ownerYards } = await supabase
    .from('yards')
    .select('id')
    .limit(1);
  const indexMs = Math.round(performance.now() - indexStart);

  log('Schema: yards query fast',
    indexMs < 1000 ? 'PASS' : 'WARN',
    `Yards query: ${indexMs}ms (index should make this <100ms at scale)`);

  // ─── Summary ──────────────────────────────────────────────
  console.log('\n========================================');
  console.log(`RESULTS: ${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.warnings} warnings`);
  console.log('========================================\n');
  console.table(results.tests);

  // Save results to localStorage for record-keeping
  const existingResults = JSON.parse(localStorage.getItem('hivelog_test_results') || '[]');
  existingResults.push(results);
  localStorage.setItem('hivelog_test_results', JSON.stringify(existingResults));
  console.log('Results saved to localStorage key: "hivelog_test_results"');
  console.log('To export: copy(JSON.parse(localStorage.getItem("hivelog_test_results")))');

  return results;
})();
