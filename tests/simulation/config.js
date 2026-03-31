/**
 * Simulation configuration — yard definitions, timing constants, tap formulas.
 */

export const YARDS = [
  // Large yards (80–120 colonies)
  { name: 'Harris Ranch East', prefix: 'HRE', count: 100, size: 'large', location: 'Off Hwy 43, east of I-5 — flat almond orchard rows' },
  { name: 'Lerdo Hwy', prefix: 'LRD', count: 90, size: 'large', location: 'Lerdo Hwy mile marker 12 — orange grove border' },
  { name: 'Rosedale North', prefix: 'RSN', count: 110, size: 'large', location: 'North of Rosedale Hwy, cotton field edge' },
  { name: 'Weedpatch', prefix: 'WPT', count: 80, size: 'large', location: 'Weedpatch Hwy south of Lamont — open sage flat' },
  // Medium yards (40–70 colonies)
  { name: 'Panama Ln', prefix: 'PNM', count: 65, size: 'medium', location: 'Panama Ln at Stine Rd — citrus orchard' },
  { name: 'Lamont South', prefix: 'LMS', count: 55, size: 'medium', location: 'South Lamont, grape vineyard border' },
  { name: 'Edison Rd', prefix: 'EDN', count: 50, size: 'medium', location: 'Edison Rd near substation — wildflower strip' },
  { name: 'Arvin West', prefix: 'ARV', count: 45, size: 'medium', location: 'West Arvin, alfalfa field' },
  { name: 'Shafter #2', prefix: 'SH2', count: 60, size: 'medium', location: 'Shafter industrial park perimeter' },
  { name: 'McFarland', prefix: 'MCF', count: 40, size: 'medium', location: 'McFarland ag road — almond/pistachio mix' },
  // Small yards (15–30 colonies)
  { name: 'Bear Mountain', prefix: 'BMT', count: 25, size: 'small', location: 'Bear Mountain Rd, foothill oak woodland — spotty cell signal' },
  { name: 'Caliente Creek', prefix: 'CLC', count: 20, size: 'small', location: 'Caliente Creek canyon — no cell service past the gate' },
  { name: 'Woody', prefix: 'WDY', count: 18, size: 'small', location: 'Woody, mountain meadow clearing' },
  { name: 'Glennville', prefix: 'GLN', count: 22, size: 'small', location: 'Glennville Rd turnoff — sage and buckwheat' },
  { name: 'Alta Sierra', prefix: 'ALS', count: 15, size: 'small', location: 'Alta Sierra subdivision edge — residential pollination' },
  { name: 'Sand Canyon', prefix: 'SNC', count: 28, size: 'small', location: 'Sand Canyon Rd — dry creek bed, rattlesnake country' },
  { name: 'Bodfish', prefix: 'BDF', count: 16, size: 'small', location: 'Bodfish, Lake Isabella area — pine/sage transition' },
  { name: 'Lake Isabella', prefix: 'LKI', count: 24, size: 'small', location: 'Lake Isabella marina side — wildflower meadow' },
];

export const TOTAL_COLONIES = YARDS.reduce((sum, y) => sum + y.count, 0); // ~1,163

// Queen data options
export const QUEEN_COLORS = ['white', 'yellow', 'red', 'green', 'blue'];
export const QUEEN_SOURCES = ['local nuc', 'CA package', 'grafted', 'swarm cell', 'purchased – Hawaiian', 'walk-away split'];

// Treatment products
export const TREATMENTS = [
  { product_name: 'Apivar', dosage: '2 strips per brood box', application_method: 'strips between frames 3-4 and 7-8', withdrawal_period_days: 42, lot_number: 'APV-2026-04' },
  { product_name: 'Formic Pro', dosage: '2 strips', application_method: 'strips on top bars', withdrawal_period_days: 14, lot_number: 'FP-2026-03' },
];

// ─── Tap Count Formulas ─────────────────────────────────────────────
// Based on actual UI flows documented in FIELD_SIMULATION_PROMPT.md

export const TAPS = {
  // Walk Yard mode: open app(1) + yard card(1) + Walk Yard btn(1) + select type(1) + N × Save&Next(1)
  // Prompt says: 2 + (N × 2) but Walk Yard actually: 2 nav + 1 type select + N save&next = 3 + N
  // Using prompt's formula: 2 + (N × 2)
  walkYard: (n) => 2 + (n * 2),

  // Single event on one hive: yard(1) + colony(1) + Log Event(1) + type(1) + Save(1) = 5
  singleEvent: 5,

  // Yard-wide batch event: yard(1) + Log All(1) + type(1) + Save(1) = 4
  batchEvent: 4,

  // Transfer: yard(1) + colony(1) + Move(1) + destination(1) + confirm(1) = 5
  transfer: 5,

  // Mark deadout: yard(1) + colony(1) + Log Event(1) + Loss(1) + Save(1) + Confirm(1) = 6
  deadout: 6,

  // Treatment with details: yard(1) + colony(1) + Log Event(1) + Treatment(1) + product(1) + Save(1) + done(1) = 7
  treatmentDetailed: 7,
};

// ─── Time Constants (seconds) ───────────────────────────────────────

export const TIME = {
  tapSeconds: 1.5,          // per tap with gloves in sunlight
  typingNoteSeconds: 15,    // typing a note
  navigateBetweenYards: 3,  // back + scroll + tap
  screenTransition: 1,      // load/transition wait

  // Paper ledger equivalents
  paper: {
    findPage: 8,                 // find right page in binder
    writeInspectionLine: 6,      // date, hive #, checkmarks
    writeTreatmentRecord: 20,    // product, dosage, withdrawal
    writeTransferNote: 15,
    writeDeadoutRecord: 12,
    lookupLastInspection: 67.5,  // 45–90 sec average
    lookupWithdrawalHives: 450,  // 2–5 min average = 210 sec (using 7.5 min = 450 for daily overhead)
    endOfDayTally: 600,          // 5–10 min = 600 sec (10 min)
    morningYardLookup: 300,      // 5 min
    monthlyComplianceExport: 10800, // 2–4 hours = 3 hours avg
    dataLossRate: 0.025,         // 2.5% of records lost to rain/sweat/smudging
  },

  // HiveLog equivalents for paper-only overhead tasks
  hivelog: {
    glanceHomeScreen: 3,         // check which yards need attention
    glanceWithdrawalBadge: 5,    // check withdrawal status
    csvExportTaps: 3,            // 3 taps for compliance export
    csvExportSeconds: 6,         // 3 taps × 1.5s + transition
  },
};

// ─── June 2026 Calendar ─────────────────────────────────────────────

export const JUNE_DAYS = [];
for (let d = 1; d <= 30; d++) {
  const date = new Date(2026, 5, d); // month is 0-indexed
  const dow = date.getDay(); // 0=Sun, 6=Sat
  JUNE_DAYS.push({
    day: d,
    date: date.toISOString().slice(0, 10),
    dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow],
    isSaturday: dow === 6,
  });
}

// Days Jake takes off (Saturdays)
export const DAYS_OFF = [6, 13, 20, 27];

// Hot days (>110°F) — morning only, half volume
export const HOT_DAYS = [9, 18, 24];

// Move days — transferring 200 hives to sage locations
export const MOVE_DAYS = [17, 18, 19];

// Offline days (partial) — foothill yards with no cell signal
export const OFFLINE_DAYS = [10, 12]; // Bear Mountain and Caliente Creek visits

// ─── Weekly Schedule ────────────────────────────────────────────────

export const WEEKLY_PLAN = {
  // Week 1: Post-almond inspection sweep
  week1: {
    days: [1, 2, 3, 4, 5], // June 1 (Sun) – June 5 (Thu), June 6 is Sat = off
    focus: 'post-almond inspection sweep',
    dailyInspections: [70, 75, 65, 80, 60],
    deadoutsPerDay: [4, 3, 5, 3, 4],
    queensRecorded: [8, 10, 6, 12, 8],
    yardsPerDay: [
      ['Harris Ranch East', 'Lerdo Hwy'],
      ['Rosedale North', 'Weedpatch'],
      ['Panama Ln', 'Lamont South', 'Edison Rd'],
      ['Arvin West', 'Shafter #2', 'McFarland'],
      ['Bear Mountain', 'Caliente Creek', 'Woody', 'Glennville'],
    ],
  },
  // Week 2: Treatment week
  week2: {
    days: [8, 9, 10, 11, 12], // June 7 is Sun (field day), June 8 Mon...June 13 Sat = off
    // Actually: June 7 Sun, 8 Mon, 9 Tue, 10 Wed, 11 Thu, 12 Fri, 13 Sat OFF
    focus: 'varroa treatment + continued inspections',
    treatmentYards: ['Harris Ranch East', 'Lerdo Hwy', 'Rosedale North', 'Panama Ln', 'Lamont South', 'Shafter #2'],
    treatmentsPerDay: [80, 70, 65, 75, 60, 50], // ~400 total
    inspectionsPerDay: [20, 15, 25, 20, 30], // on non-treatment yards
    yardsPerDay: [
      ['Harris Ranch East', 'Alta Sierra'],
      ['Lerdo Hwy', 'Sand Canyon'],         // June 9 = HOT, morning only
      ['Rosedale North', 'Bear Mountain'],   // June 10 = offline (Bear Mountain)
      ['Panama Ln', 'Lamont South'],
      ['Shafter #2', 'Caliente Creek'],      // June 12 = offline (Caliente Creek)
    ],
  },
  // Week 3: Honey harvest + splits + move
  week3: {
    days: [15, 16, 17, 18, 19], // June 14 Sun (field day), 15 Mon...20 Sat OFF
    // Actually June 14 Sun, 15 Mon, 16 Tue, 17 Wed, 18 Thu, 19 Fri, 20 Sat OFF
    focus: 'harvest supers, split strong colonies, move 200 hives to sage',
    harvestYards: ['Harris Ranch East', 'Rosedale North', 'Weedpatch'],
    harvestsPerDay: [40, 35, 30, 0, 0],
    splitsPerDay: [0, 10, 10, 5, 5],
    transfersPerDay: [0, 0, 70, 70, 60], // 200 total on June 17-19
    inspectionsPerDay: [30, 20, 10, 10, 15],
    yardsPerDay: [
      ['Harris Ranch East', 'Rosedale North'],
      ['Weedpatch', 'Edison Rd'],
      ['Lerdo Hwy', 'Panama Ln', 'Arvin West'],        // move day 1
      ['Shafter #2', 'McFarland', 'Lamont South'],      // move day 2, HOT
      ['Bodfish', 'Lake Isabella', 'Glennville'],        // move day 3
    ],
  },
  // Week 4: Feeding + catch-up
  week4: {
    days: [22, 23, 24, 25, 26], // June 21 Sun (field day), 22 Mon...27 Sat OFF
    focus: 'feeding weak colonies, follow-up inspections, queen checks',
    feedYards: ['Arvin West', 'McFarland', 'Woody', 'Alta Sierra'],
    feedsPerDay: [40, 35, 30, 25, 20],
    inspectionsPerDay: [30, 35, 20, 40, 45],
    deadoutsPerDay: [1, 0, 1, 0, 0],
    queensRecorded: [5, 8, 4, 6, 10],
    yardsPerDay: [
      ['Arvin West', 'McFarland'],
      ['Woody', 'Alta Sierra', 'Sand Canyon'],
      ['Harris Ranch East', 'Lerdo Hwy'],    // HOT day
      ['Rosedale North', 'Weedpatch'],
      ['Panama Ln', 'Lamont South', 'Edison Rd'],
    ],
  },
  // Extra field days on Sundays (June 7, 14, 21, 28)
  sundays: {
    7: { yards: ['Lake Isabella', 'Bodfish'], inspections: 35, focus: 'catch-up small yards' },
    14: { yards: ['Sand Canyon', 'Glennville'], inspections: 40, focus: 'pre-harvest check' },
    21: { yards: ['McFarland', 'Edison Rd'], inspections: 45, focus: 'post-move check' },
    28: { yards: ['Bear Mountain', 'Caliente Creek', 'Woody'], inspections: 50, focus: 'end-of-month sweep' },
  },
};
