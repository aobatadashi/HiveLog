#!/usr/bin/env node
/**
 * Phase 1: Seed Jake Tanner's 1,200-hive operation into Supabase.
 * Creates 18 yards, ~1,163 colonies, and 2–3 weeks of May 2026 history.
 *
 * Idempotent: checks for existing simulation data before inserting.
 * Run: node tests/seed_simulation.js
 */
import { getAuthenticatedClient } from './simulation/auth.js';
import { YARDS, TREATMENTS, QUEEN_COLORS, QUEEN_SOURCES } from './simulation/config.js';

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDate(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString();
}
function pad(n, w = 3) { return String(n).padStart(w, '0'); }

async function main() {
  console.log('=== HiveLog Simulation: Seeding Operation ===\n');

  const { supabase, user } = await getAuthenticatedClient();
  console.log(`Authenticated as: ${user.email} (${user.id})\n`);

  // ─── Idempotency check ────────────────────────────────────────
  const { data: existing } = await supabase
    .from('yards')
    .select('id')
    .eq('name', 'Harris Ranch East')
    .limit(1);

  if (existing && existing.length > 0) {
    console.log('Simulation data already exists (found "Harris Ranch East").');
    console.log('To re-seed, run cleanup_simulation.sql first.');
    process.exit(0);
  }

  // ─── Phase 1a: Create Yards ───────────────────────────────────
  console.log('Creating 18 yards...');
  const yardRows = YARDS.map(y => ({
    owner_id: user.id,
    name: y.name,
    location_note: y.location,
  }));

  const { data: createdYards, error: yardErr } = await supabase
    .from('yards')
    .insert(yardRows)
    .select('id, name');

  if (yardErr) {
    console.error('Failed to create yards:', yardErr.message);
    process.exit(1);
  }

  const yardMap = {}; // name → { id, name }
  for (const y of createdYards) yardMap[y.name] = y;
  console.log(`  Created ${createdYards.length} yards`);

  // ─── Phase 1b: Create Colonies ────────────────────────────────
  console.log('Creating ~1,163 colonies...');
  let totalColonies = 0;
  const allColonies = []; // { id, yard_id, label, yard_name }

  for (const yardDef of YARDS) {
    const yard = yardMap[yardDef.name];
    if (!yard) continue;

    const colonyRows = [];
    for (let i = 1; i <= yardDef.count; i++) {
      colonyRows.push({
        yard_id: yard.id,
        label: `${yardDef.prefix}-${pad(i)}`,
        status: 'active',
      });
    }

    // Insert in batches of 200
    for (let i = 0; i < colonyRows.length; i += 200) {
      const batch = colonyRows.slice(i, i + 200);
      const { data: created, error } = await supabase
        .from('colonies')
        .insert(batch)
        .select('id, yard_id, label, status');

      if (error) {
        console.error(`Failed to create colonies for ${yardDef.name}:`, error.message);
        process.exit(1);
      }

      for (const c of created) {
        allColonies.push({ ...c, yard_name: yardDef.name });
      }
      totalColonies += created.length;
    }

    process.stdout.write(`  ${yardDef.name}: ${yardDef.count} colonies\r`);
  }
  console.log(`\n  Total: ${totalColonies} colonies\n`);

  // ─── Phase 1c: Seed May History ───────────────────────────────
  console.log('Seeding May 2026 event history...');

  const events = [];
  const treatmentDetails = [];
  const queens = [];
  const deadoutUpdates = [];

  for (const colony of allColonies) {
    // Every colony: 1 inspection from mid-May
    events.push({
      colony_id: colony.id,
      type: 'inspection',
      notes: null,
      logged_by: user.id,
      created_at: randDate('2026-05-12', '2026-05-25'),
    });

    // 30% feeding from late May
    if (Math.random() < 0.30) {
      events.push({
        colony_id: colony.id,
        type: 'feed',
        notes: 'Sugar syrup 1:1',
        logged_by: user.id,
        created_at: randDate('2026-05-20', '2026-05-31'),
      });
    }

    // 15% treatment from early May
    if (Math.random() < 0.15) {
      const treatment = pick(TREATMENTS);
      const treatDate = randDate('2026-05-01', '2026-05-10');
      events.push({
        colony_id: colony.id,
        type: 'treatment',
        notes: `${treatment.product_name} applied`,
        logged_by: user.id,
        created_at: treatDate,
        _treatment: treatment, // marker for linking
      });
    }

    // 5% deadout with loss event
    if (Math.random() < 0.05) {
      events.push({
        colony_id: colony.id,
        type: 'loss',
        notes: pick(['Queenless collapse', 'Mite bomb', 'Starvation', 'Unknown — empty hive']),
        logged_by: user.id,
        created_at: randDate('2026-05-15', '2026-05-25'),
      });
      deadoutUpdates.push(colony.id);
    }

    // 20% queen records
    if (Math.random() < 0.20) {
      queens.push({
        colony_id: colony.id,
        marking_color: pick(QUEEN_COLORS),
        source: pick(QUEEN_SOURCES),
        introduction_date: '2026-04-15',
        notes: null,
        status: 'active',
      });
    }
  }

  // Separate treatment-linked events from plain events
  const plainEvents = [];
  const treatmentEvents = [];
  for (const e of events) {
    if (e._treatment) {
      const { _treatment, ...rest } = e;
      treatmentEvents.push({ event: rest, treatment: _treatment });
    } else {
      plainEvents.push(e);
    }
  }

  // Insert plain events in batches
  let insertedEvents = 0;
  for (let i = 0; i < plainEvents.length; i += 500) {
    const batch = plainEvents.slice(i, i + 500);
    const { error } = await supabase.from('events').insert(batch);
    if (error) {
      console.error('Failed to insert events:', error.message);
      process.exit(1);
    }
    insertedEvents += batch.length;
    process.stdout.write(`  Events: ${insertedEvents}/${plainEvents.length + treatmentEvents.length}\r`);
  }

  // Insert treatment events one at a time (need event_id for treatment_details)
  for (const { event, treatment } of treatmentEvents) {
    const { data: created, error } = await supabase
      .from('events')
      .insert(event)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to insert treatment event:', error.message);
      continue;
    }

    const { error: tdErr } = await supabase.from('treatment_details').insert({
      event_id: created.id,
      product_name: treatment.product_name,
      dosage: treatment.dosage,
      application_method: treatment.application_method,
      withdrawal_period_days: treatment.withdrawal_period_days,
      lot_number: treatment.lot_number,
    });

    if (tdErr) {
      console.error('Failed to insert treatment details:', tdErr.message);
    }
    insertedEvents++;
    process.stdout.write(`  Events: ${insertedEvents}/${plainEvents.length + treatmentEvents.length}\r`);
  }

  console.log(`\n  Inserted ${insertedEvents} events (${treatmentEvents.length} with treatment details)`);

  // Mark deadouts
  if (deadoutUpdates.length > 0) {
    for (const colId of deadoutUpdates) {
      await supabase.from('colonies').update({ status: 'deadout' }).eq('id', colId);
    }
    console.log(`  Marked ${deadoutUpdates.length} colonies as deadout`);
  }

  // Insert queens
  if (queens.length > 0) {
    for (let i = 0; i < queens.length; i += 200) {
      const batch = queens.slice(i, i + 200);
      const { error } = await supabase.from('queens').insert(batch);
      if (error) console.error('Failed to insert queens:', error.message);
    }
    console.log(`  Created ${queens.length} queen records`);
  }

  // ─── Summary ──────────────────────────────────────────────────
  console.log('\n=== Seed Complete ===');
  console.log(`  Yards: ${createdYards.length}`);
  console.log(`  Colonies: ${totalColonies} (${deadoutUpdates.length} deadout)`);
  console.log(`  Events: ${insertedEvents}`);
  console.log(`  Queens: ${queens.length}`);
  console.log(`  Treatment details: ${treatmentEvents.length}`);
  console.log('\nNext: node tests/simulate_june.js');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
