/**
 * Action executors — each mirrors an actual HiveLog UI workflow.
 * Returns: { type, taps, hivelogSeconds, paperSeconds, eventCount, eventTypes, coloniesTouched, yardName, walkYardTapsSaved, frictionNotes, offline }
 */
import { TAPS, TIME, TREATMENTS, QUEEN_COLORS, QUEEN_SOURCES } from './config.js';

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Walk Yard Inspection ──────────────────────────────────────
export function walkYardInspection(yard, colonies, offline = false) {
  const n = colonies.length;
  const taps = TAPS.walkYard(n);
  // Equivalent if done individually: n × 5 taps
  const individualTaps = n * TAPS.singleEvent;
  const tapsSaved = individualTaps - taps;

  const hivelogSec = (taps * TIME.tapSeconds) + TIME.screenTransition + TIME.navigateBetweenYards;
  // ~10% of hives get a brief note
  const notesCount = Math.ceil(n * 0.1);
  const hivelogWithNotes = hivelogSec + (notesCount * TIME.typingNoteSeconds);

  const paperSec = TIME.paper.findPage + (n * TIME.paper.writeInspectionLine);

  const friction = [];
  if (n > 60) {
    friction.push(`${yard.name}: Walk Yard through ${n} hives — long scrolling session, hand cramps from tapping`);
  }
  if (notesCount > 5) {
    friction.push(`${yard.name}: typed ${notesCount} notes with gloves on (+${notesCount * 20}s fumbling)`);
  }

  return {
    type: 'walkYardInspection',
    taps,
    hivelogSeconds: hivelogWithNotes,
    paperSeconds: paperSec,
    eventCount: n,
    eventTypes: { inspection: n },
    coloniesTouched: colonies.map(c => c.id),
    yardName: yard.name,
    walkYardTapsSaved: tapsSaved,
    frictionNotes: friction,
    offline,
    // Data for DB insertion
    dbEvents: colonies.map(c => ({
      colony_id: c.id,
      type: 'inspection',
      notes: Math.random() < 0.1 ? pickInspectionNote() : null,
    })),
  };
}

// ─── Walk Yard Treatment ───────────────────────────────────────
export function walkYardTreatment(yard, colonies, offline = false) {
  const n = colonies.length;
  // Treatment in Walk Yard: each hive needs treatment form filled = more taps
  // Walk Yard nav (3) + per hive: select treatment(1) + fill form(3 fields ~3 taps) + Save&Next(1) = 5 per hive
  const taps = 3 + (n * 5);
  const treatment = pick(TREATMENTS);

  const hivelogSec = (taps * TIME.tapSeconds) + (n * TIME.typingNoteSeconds * 0.3) + TIME.screenTransition;
  const paperSec = TIME.paper.findPage + (n * TIME.paper.writeTreatmentRecord);

  const friction = [];
  if (n > 40) {
    friction.push(`${yard.name}: applying ${treatment.product_name} to ${n} hives via Walk Yard — treatment form scrolls on each save, tedious`);
  }
  friction.push(`${yard.name}: entering product name "${treatment.product_name}" ${n} times (auto-filled after first, but still 1 tap to confirm each)`);

  return {
    type: 'walkYardTreatment',
    taps,
    hivelogSeconds: hivelogSec,
    paperSeconds: paperSec,
    eventCount: n,
    eventTypes: { treatment: n },
    coloniesTouched: colonies.map(c => c.id),
    yardName: yard.name,
    walkYardTapsSaved: (n * TAPS.treatmentDetailed) - taps,
    frictionNotes: friction,
    offline,
    dbEvents: colonies.map(c => ({
      colony_id: c.id,
      type: 'treatment',
      notes: `${treatment.product_name} applied`,
    })),
    treatmentDetails: colonies.map(c => ({
      colony_id: c.id, // placeholder — linked by event_id after insert
      product_name: treatment.product_name,
      dosage: treatment.dosage,
      application_method: treatment.application_method,
      withdrawal_period_days: treatment.withdrawal_period_days,
      lot_number: treatment.lot_number,
    })),
  };
}

// ─── Batch Harvest ─────────────────────────────────────────────
export function batchHarvest(yard, colonies, offline = false) {
  const n = colonies.length;
  const taps = TAPS.batchEvent; // yard-wide batch
  const supersPerHive = Math.floor(Math.random() * 3) + 2; // 2-4 supers

  const hivelogSec = (taps * TIME.tapSeconds) + TIME.typingNoteSeconds + TIME.screenTransition;
  const paperSec = TIME.paper.findPage + (n * 6); // write harvest line per hive

  return {
    type: 'batchHarvest',
    taps,
    hivelogSeconds: hivelogSec,
    paperSeconds: paperSec,
    eventCount: n,
    eventTypes: { harvest: n },
    coloniesTouched: colonies.map(c => c.id),
    yardName: yard.name,
    walkYardTapsSaved: 0,
    frictionNotes: [],
    offline,
    dbEvents: colonies.map(c => ({
      colony_id: c.id,
      type: 'harvest',
      notes: `${supersPerHive} supers pulled — orange blossom`,
    })),
  };
}

// ─── Batch Feed ────────────────────────────────────────────────
export function batchFeed(yard, colonies, offline = false) {
  const n = colonies.length;
  const taps = TAPS.batchEvent;

  const hivelogSec = (taps * TIME.tapSeconds) + TIME.typingNoteSeconds + TIME.screenTransition;
  const paperSec = TIME.paper.findPage + (n * TIME.paper.writeInspectionLine);

  return {
    type: 'batchFeed',
    taps,
    hivelogSeconds: hivelogSec,
    paperSeconds: paperSec,
    eventCount: n,
    eventTypes: { feed: n },
    coloniesTouched: colonies.map(c => c.id),
    yardName: yard.name,
    walkYardTapsSaved: 0,
    frictionNotes: [],
    offline,
    dbEvents: colonies.map(c => ({
      colony_id: c.id,
      type: 'feed',
      notes: 'Sugar syrup 1:1, top feeder',
    })),
  };
}

// ─── Transfer Colony ───────────────────────────────────────────
export function transferColony(yard, colony, offline = false) {
  const taps = TAPS.transfer;
  const hivelogSec = (taps * TIME.tapSeconds) + TIME.screenTransition;
  const paperSec = TIME.paper.findPage + TIME.paper.writeTransferNote;

  return {
    type: 'transferColony',
    taps,
    hivelogSeconds: hivelogSec,
    paperSeconds: paperSec,
    eventCount: 1,
    eventTypes: { transfer: 1 },
    coloniesTouched: [colony.id],
    yardName: yard.name,
    walkYardTapsSaved: 0,
    frictionNotes: [], // friction added in bulk by caller
    offline,
    dbEvents: [{
      colony_id: colony.id,
      type: 'transfer',
      notes: `Moved from ${yard.name} to sage brush location`,
    }],
  };
}

// ─── Mark Deadout ──────────────────────────────────────────────
export function markDeadout(yard, colony, offline = false) {
  const taps = TAPS.deadout;
  const hivelogSec = (taps * TIME.tapSeconds) + TIME.screenTransition;
  const paperSec = TIME.paper.findPage + TIME.paper.writeDeadoutRecord;

  return {
    type: 'markDeadout',
    taps,
    hivelogSeconds: hivelogSec,
    paperSeconds: paperSec,
    eventCount: 1,
    eventTypes: { loss: 1 },
    coloniesTouched: [colony.id],
    yardName: yard.name,
    walkYardTapsSaved: 0,
    frictionNotes: [],
    offline,
    dbEvents: [{
      colony_id: colony.id,
      type: 'loss',
      notes: pick(['Queenless — no eggs, no brood', 'Collapsed — mite bomb', 'Heat stress — melted comb', 'Absconded', 'Starvation — empty frames']),
    }],
    markDeadout: colony.id,
  };
}

// ─── Split Colony ──────────────────────────────────────────────
export function splitColony(yard, colony, offline = false) {
  // Split = log split event + requeen event on new split
  const taps = TAPS.singleEvent + TAPS.singleEvent; // split + requeen
  const hivelogSec = (taps * TIME.tapSeconds) + TIME.typingNoteSeconds + TIME.screenTransition * 2;
  const paperSec = (TIME.paper.findPage * 2) + TIME.paper.writeInspectionLine + TIME.paper.writeTransferNote;

  return {
    type: 'splitColony',
    taps,
    hivelogSeconds: hivelogSec,
    paperSeconds: paperSec,
    eventCount: 2,
    eventTypes: { split: 1, requeen: 1 },
    coloniesTouched: [colony.id],
    yardName: yard.name,
    walkYardTapsSaved: 0,
    frictionNotes: [],
    offline,
    dbEvents: [
      { colony_id: colony.id, type: 'split', notes: 'Walk-away split — 4 frames brood + 2 honey' },
      { colony_id: colony.id, type: 'requeen', notes: 'New queen from split cell' },
    ],
    queenData: {
      colony_id: colony.id,
      marking_color: pick(QUEEN_COLORS),
      source: 'walk-away split',
      status: 'active',
    },
  };
}

// ─── Record Queen ──────────────────────────────────────────────
export function recordQueen(yard, colony, offline = false) {
  const taps = TAPS.singleEvent + 2; // navigate to queen section + save
  const hivelogSec = (taps * TIME.tapSeconds) + TIME.screenTransition;
  const paperSec = TIME.paper.findPage + TIME.paper.writeInspectionLine;

  return {
    type: 'recordQueen',
    taps,
    hivelogSeconds: hivelogSec,
    paperSeconds: paperSec,
    eventCount: 0, // queen record isn't an event
    eventTypes: {},
    coloniesTouched: [colony.id],
    yardName: yard.name,
    walkYardTapsSaved: 0,
    frictionNotes: [],
    offline,
    dbEvents: [],
    queenData: {
      colony_id: colony.id,
      marking_color: pick(QUEEN_COLORS),
      source: pick(QUEEN_SOURCES),
      status: 'active',
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────

function pickInspectionNote() {
  return pick([
    'Strong colony — 8 frames brood',
    'Light on stores, needs feeding soon',
    'Spotted queen — laying well',
    'Some chalkbrood on outer frames',
    'Beard on front — good population',
    'Supersedure cells — watching',
    'Low mite count — alcohol wash 1/300',
    'Aggressive — consider requeening',
    'Capped honey in super — almost ready',
    'Small hive beetle traps full',
  ]);
}
