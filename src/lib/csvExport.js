import { supabase } from '../supabaseClient.js';
import { cacheGet } from './cache.js';

/**
 * Escape a CSV field value — handles commas, quotes, and newlines.
 */
function escapeCsvField(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Convert an array of row objects to a CSV string.
 * @param {string[]} headers - Column headers
 * @param {string[][]} rows - Array of row arrays (each matching headers length)
 */
function arrayToCsv(headers, rows) {
  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Trigger a browser download of a CSV string.
 */
function downloadCsv(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Export all events across all yards/colonies.
 * Returns { success: boolean, count: number, offline: boolean }
 */
export async function exportAllEvents() {
  let offline = false;
  let yards = [];
  let colonies = [];
  let events = [];

  try {
    const { data: yData, error: yErr } = await supabase
      .from('yards')
      .select('id, name')
      .limit(10000);
    if (yErr) throw yErr;
    yards = yData || [];

    const { data: cData, error: cErr } = await supabase
      .from('colonies')
      .select('id, yard_id, label')
      .limit(100000);
    if (cErr) throw cErr;
    colonies = cData || [];

    const { data: eData, error: eErr } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100000);
    if (eErr) throw eErr;
    events = eData || [];
  } catch {
    // Try cache fallback
    offline = true;
    const cachedYards = await cacheGet('yards', 'all');
    const cachedColonies = await cacheGet('colonies', 'all');
    const cachedEvents = await cacheGet('events', 'all');
    if (cachedYards) yards = cachedYards;
    if (cachedColonies) colonies = cachedColonies;
    if (cachedEvents) events = cachedEvents;
  }

  if (events.length === 0) {
    return { success: false, count: 0, offline };
  }

  const yardMap = {};
  for (const y of yards) yardMap[y.id] = y.name;
  const colonyMap = {};
  const colonyYardMap = {};
  for (const c of colonies) {
    colonyMap[c.id] = c.label;
    colonyYardMap[c.id] = c.yard_id;
  }

  const headers = ['Date', 'Yard', 'Colony', 'Event Type', 'Notes'];
  const rows = events.map((e) => [
    formatDate(e.created_at),
    yardMap[colonyYardMap[e.colony_id]] || 'Unknown',
    colonyMap[e.colony_id] || 'Unknown',
    e.type,
    e.notes || '',
  ]);

  const csv = arrayToCsv(headers, rows);
  downloadCsv(csv, `hivelog-events-${todayStamp()}.csv`);
  return { success: true, count: events.length, offline };
}

/**
 * Export colony status summary (all colonies across all yards).
 */
export async function exportColonyStatus() {
  let offline = false;
  let yards = [];
  let colonies = [];

  try {
    const { data: yData, error: yErr } = await supabase
      .from('yards')
      .select('id, name, location_note')
      .limit(10000);
    if (yErr) throw yErr;
    yards = yData || [];

    const { data: cData, error: cErr } = await supabase
      .from('colonies')
      .select('id, yard_id, label, status, created_at')
      .order('created_at', { ascending: true })
      .limit(100000);
    if (cErr) throw cErr;
    colonies = cData || [];
  } catch {
    offline = true;
    const cachedYards = await cacheGet('yards', 'all');
    const cachedColonies = await cacheGet('colonies', 'all');
    if (cachedYards) yards = cachedYards;
    if (cachedColonies) colonies = cachedColonies;
  }

  if (colonies.length === 0) {
    return { success: false, count: 0, offline };
  }

  const yardMap = {};
  for (const y of yards) yardMap[y.id] = { name: y.name, location: y.location_note || '' };

  const headers = ['Yard', 'Location', 'Colony', 'Status', 'Created'];
  const rows = colonies.map((c) => {
    const yard = yardMap[c.yard_id] || { name: 'Unknown', location: '' };
    return [
      yard.name,
      yard.location,
      c.label,
      c.status,
      formatDate(c.created_at),
    ];
  });

  const csv = arrayToCsv(headers, rows);
  downloadCsv(csv, `hivelog-colony-status-${todayStamp()}.csv`);
  return { success: true, count: colonies.length, offline };
}

/**
 * Export treatment events log (for compliance reporting).
 * Will be enhanced in Feature 3 with treatment_details fields.
 */
export async function exportTreatmentLog() {
  let offline = false;
  let yards = [];
  let colonies = [];
  let events = [];

  try {
    const { data: yData, error: yErr } = await supabase
      .from('yards')
      .select('id, name')
      .limit(10000);
    if (yErr) throw yErr;
    yards = yData || [];

    const { data: cData, error: cErr } = await supabase
      .from('colonies')
      .select('id, yard_id, label')
      .limit(100000);
    if (cErr) throw cErr;
    colonies = cData || [];

    const { data: eData, error: eErr } = await supabase
      .from('events')
      .select('*')
      .eq('type', 'treatment')
      .order('created_at', { ascending: false })
      .limit(100000);
    if (eErr) throw eErr;
    events = eData || [];
  } catch {
    offline = true;
    const cachedYards = await cacheGet('yards', 'all');
    const cachedColonies = await cacheGet('colonies', 'all');
    const cachedEvents = await cacheGet('events', 'all');
    if (cachedYards) yards = cachedYards;
    if (cachedColonies) colonies = cachedColonies;
    if (cachedEvents) {
      events = cachedEvents.filter((e) => e.type === 'treatment');
    }
  }

  if (events.length === 0) {
    return { success: false, count: 0, offline };
  }

  // Fetch treatment_details for these events
  const eventIds = events.map((e) => e.id);
  const tdMap = {};
  if (!offline) {
    try {
      const { data: tdData } = await supabase
        .from('treatment_details')
        .select('*')
        .in('event_id', eventIds);
      if (tdData) {
        for (const td of tdData) tdMap[td.event_id] = td;
      }
    } catch {
      // Continue without details
    }
  }

  const yardMap = {};
  for (const y of yards) yardMap[y.id] = y.name;
  const colonyMap = {};
  const colonyYardMap = {};
  for (const c of colonies) {
    colonyMap[c.id] = c.label;
    colonyYardMap[c.id] = c.yard_id;
  }

  const headers = ['Date', 'Yard', 'Colony', 'Product', 'Dosage', 'Method', 'Withdrawal Days', 'Lot Number', 'Notes'];
  const rows = events.map((e) => {
    const td = tdMap[e.id];
    return [
      formatDate(e.created_at),
      yardMap[colonyYardMap[e.colony_id]] || 'Unknown',
      colonyMap[e.colony_id] || 'Unknown',
      td?.product_name || '',
      td?.dosage || '',
      td?.application_method || '',
      td?.withdrawal_period_days ?? '',
      td?.lot_number || '',
      e.notes || '',
    ];
  });

  const csv = arrayToCsv(headers, rows);
  downloadCsv(csv, `hivelog-treatment-log-${todayStamp()}.csv`);
  return { success: true, count: events.length, offline };
}
