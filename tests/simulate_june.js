#!/usr/bin/env node
/**
 * Phase 2: Simulate Jake Tanner's June 2026 — day by day.
 * Authenticates, loads seeded data, runs 30-day simulation, generates report.
 *
 * Run: node tests/simulate_june.js
 */
import { getAuthenticatedClient } from './simulation/auth.js';
import { JUNE_DAYS, YARDS } from './simulation/config.js';
import { MetricsTracker } from './simulation/metrics.js';
import { DayPlanner } from './simulation/dayPlanner.js';
import * as actions from './simulation/actions.js';
import { generateReport } from './simulation/reporter.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

async function main() {
  console.log('=== HiveLog Simulation: June 2026 ===\n');

  // ─── Authenticate ─────────────────────────────────────────────
  const { supabase, user } = await getAuthenticatedClient();
  console.log(`Authenticated as: ${user.email} (${user.id})\n`);

  // ─── Load seeded data ─────────────────────────────────────────
  console.log('Loading operation data...');
  const { data: yardRows, error: yErr } = await supabase
    .from('yards')
    .select('id, name')
    .order('name');

  if (yErr || !yardRows || yardRows.length === 0) {
    console.error('No yards found. Run seed_simulation.js first.');
    process.exit(1);
  }

  const yardsMap = {}; // name → row
  const yardIds = [];
  for (const y of yardRows) {
    yardsMap[y.name] = y;
    yardIds.push(y.id);
  }
  console.log(`  Loaded ${yardRows.length} yards`);

  // Load all colonies grouped by yard
  const coloniesMap = {}; // yardId → colony[]
  let totalActiveColonies = 0;
  for (const yardId of yardIds) {
    const { data: cols } = await supabase
      .from('colonies')
      .select('id, yard_id, label, status')
      .eq('yard_id', yardId)
      .order('label');
    coloniesMap[yardId] = cols || [];
    totalActiveColonies += (cols || []).filter(c => c.status === 'active').length;
  }
  console.log(`  Loaded colonies (${totalActiveColonies} active)\n`);

  // ─── Initialize simulation ────────────────────────────────────
  const metrics = new MetricsTracker();
  const planner = new DayPlanner(yardsMap, coloniesMap);

  let totalInserted = 0;

  // ─── Run June day by day ──────────────────────────────────────
  console.log('─── Simulating June 2026 ───────────────────────\n');

  for (const { day, date, dayOfWeek } of JUNE_DAYS) {
    const plan = planner.planDay(day);

    if (plan.dayOff) {
      metrics.recordDayOff(day);
      console.log(`  June ${day} (${dayOfWeek}): ${plan.description}`);
      continue;
    }

    metrics.startDay(day, plan.description);
    console.log(`  June ${day} (${dayOfWeek}): ${plan.description}`);

    const yardsList = plan.yards || [];
    console.log(`    Yards: ${yardsList.join(', ')}`);

    let dayEvents = 0;
    let dayTaps = 0;

    // Execute each action
    for (const action of plan.actions) {
      let result;

      switch (action.type) {
        case 'walkYardInspection':
          result = actions.walkYardInspection(action.yard, action.colonies, action.offline);
          break;
        case 'walkYardTreatment':
          result = actions.walkYardTreatment(action.yard, action.colonies, action.offline);
          break;
        case 'batchHarvest':
          result = actions.batchHarvest(action.yard, action.colonies, action.offline);
          break;
        case 'batchFeed':
          result = actions.batchFeed(action.yard, action.colonies, action.offline);
          break;
        case 'transferColony':
          result = actions.transferColony(action.yard, action.colony, action.offline);
          break;
        case 'markDeadout':
          result = actions.markDeadout(action.yard, action.colony, action.offline);
          break;
        case 'splitColony':
          result = actions.splitColony(action.yard, action.colony, action.offline);
          break;
        case 'recordQueen':
          result = actions.recordQueen(action.yard, action.colony, action.offline);
          break;
        default:
          console.warn(`    Unknown action: ${action.type}`);
          continue;
      }

      // Record metrics
      metrics.recordAction(day, result);
      dayEvents += result.eventCount || 0;
      dayTaps += result.taps;

      // Insert events into Supabase
      if (result.dbEvents && result.dbEvents.length > 0) {
        const eventsToInsert = result.dbEvents.map(e => ({
          colony_id: e.colony_id,
          type: e.type,
          notes: e.notes,
          logged_by: user.id,
          created_at: `${date}T${randTime()}`,
        }));

        // Batch insert (up to 500)
        for (let i = 0; i < eventsToInsert.length; i += 500) {
          const batch = eventsToInsert.slice(i, i + 500);

          // If we have treatment details, insert one by one to get event_ids
          if (result.treatmentDetails && result.type === 'walkYardTreatment') {
            for (let j = 0; j < batch.length; j++) {
              const { data: created, error } = await supabase
                .from('events')
                .insert(batch[j])
                .select('id')
                .single();

              if (error) {
                // Skip duplicates or other transient errors
                continue;
              }

              // Insert treatment details
              if (result.treatmentDetails[i + j]) {
                const td = result.treatmentDetails[i + j];
                await supabase.from('treatment_details').insert({
                  event_id: created.id,
                  product_name: td.product_name,
                  dosage: td.dosage,
                  application_method: td.application_method,
                  withdrawal_period_days: td.withdrawal_period_days,
                  lot_number: td.lot_number,
                });
              }
              totalInserted++;
            }
          } else {
            const { error } = await supabase.from('events').insert(batch);
            if (error) {
              console.warn(`    Insert error: ${error.message}`);
            }
            totalInserted += batch.length;
          }
        }
      }

      // Mark deadouts in colony table
      if (result.markDeadout) {
        await supabase
          .from('colonies')
          .update({ status: 'deadout' })
          .eq('id', result.markDeadout);

        // Update local state so planner excludes it
        for (const cols of Object.values(coloniesMap)) {
          const col = cols.find(c => c.id === result.markDeadout);
          if (col) col.status = 'deadout';
        }
      }

      // Insert queen records
      if (result.queenData) {
        const qd = result.queenData;
        // Mark existing active queen as replaced
        await supabase
          .from('queens')
          .update({ status: 'replaced' })
          .eq('colony_id', qd.colony_id)
          .eq('status', 'active');

        await supabase.from('queens').insert({
          colony_id: qd.colony_id,
          marking_color: qd.marking_color,
          source: qd.source,
          introduction_date: date,
          status: 'active',
        });
      }
    }

    // Add transfer friction summary for move days
    if (plan.isMove) {
      const transferCount = plan.actions.filter(a => a.type === 'transferColony').length;
      if (transferCount > 10) {
        metrics.totals.frictionLog.push({
          day,
          note: `Transferred ${transferCount} hives — ${transferCount * 5} taps with NO batch transfer. Each hive: navigate(2) + move btn(1) + select yard(1) + confirm(1).`,
        });
      }
    }

    metrics.finishDay(day);
    console.log(`    Events: ${dayEvents} | Taps: ${dayTaps} | DB total: ${totalInserted}`);
  }

  // ─── Generate Report ──────────────────────────────────────────
  console.log('\n─── Generating Report ────────────────────────────\n');
  const summary = metrics.getSummary();

  console.log(`Total events created: ${summary.totalEvents}`);
  console.log(`Total taps: ${summary.totalTaps.toLocaleString()}`);
  console.log(`HiveLog time: ${(summary.totalHivelogSeconds / 3600).toFixed(1)} hours`);
  console.log(`Paper time: ${(summary.totalPaperSeconds / 3600).toFixed(1)} hours`);
  console.log(`Time saved: ${((summary.totalPaperSeconds - summary.totalHivelogSeconds) / 3600).toFixed(1)} hours`);

  generateReport(summary);

  // ─── Generate Cleanup SQL ─────────────────────────────────────
  const yardNames = YARDS.map(y => `'${y.name}'`).join(', ');
  const cleanupSql = `-- HiveLog Simulation Cleanup
-- Run this in the Supabase SQL Editor to remove all simulation data.
-- Cascade deletes will remove colonies, events, queens, and treatment_details.

DELETE FROM yards
WHERE owner_id = '${user.id}'
AND name IN (${yardNames});

-- Verify cleanup:
SELECT count(*) as remaining_yards FROM yards WHERE owner_id = '${user.id}';
`;

  const cleanupPath = resolve(process.cwd(), 'tests', 'cleanup_simulation.sql');
  writeFileSync(cleanupPath, cleanupSql);
  console.log(`\nCleanup SQL written to: ${cleanupPath}`);

  console.log('\n=== Simulation Complete ===');
  console.log('Review: tests/SIMULATION_REPORT.md');
  console.log('Cleanup: Run tests/cleanup_simulation.sql in Supabase SQL Editor');
}

function randTime() {
  const h = String(Math.floor(Math.random() * 10) + 6).padStart(2, '0'); // 06:00–15:59
  const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  const s = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
