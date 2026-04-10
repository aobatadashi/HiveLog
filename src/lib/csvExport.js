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
 * Filter an array of records by date range on a given date field.
 */
function filterByDateRange(records, field, fromDate, toDate) {
  if (!fromDate && !toDate) return records;
  return records.filter((r) => {
    const val = r[field];
    if (!val) return false;
    const d = val.slice(0, 10); // YYYY-MM-DD portion
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  });
}

/**
 * Build a filename with optional date range.
 */
function buildFilename(base, fromDate, toDate) {
  if (fromDate && toDate) return `${base}-${fromDate}-to-${toDate}.csv`;
  return `${base}-${todayStamp()}.csv`;
}

/**
 * Export all events across all yards/colonies.
 * Returns { success: boolean, count: number, offline: boolean }
 * @param {string} [fromDate] - ISO date string like "2026-01-15"
 * @param {string} [toDate] - ISO date string like "2026-03-30"
 */
export async function exportAllEvents(fromDate, toDate) {
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

    let query = supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100000);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate + 'T23:59:59Z');
    const { data: eData, error: eErr } = await query;
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
    if (cachedEvents) events = filterByDateRange(cachedEvents, 'created_at', fromDate, toDate);
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
  downloadCsv(csv, buildFilename('hivelog-events', fromDate, toDate));
  return { success: true, count: events.length, offline };
}

/**
 * Export colony status summary (all colonies across all yards).
 * @param {string} [fromDate] - ISO date string like "2026-01-15"
 * @param {string} [toDate] - ISO date string like "2026-03-30"
 */
export async function exportColonyStatus(fromDate, toDate) {
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

    // Date filter applies to colony created_at (colonies created within the range)
    // TODO: could also filter by last event date in a future version
    let query = supabase
      .from('colonies')
      .select('id, yard_id, label, status, created_at')
      .order('created_at', { ascending: true })
      .limit(100000);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate + 'T23:59:59Z');
    const { data: cData, error: cErr } = await query;
    if (cErr) throw cErr;
    colonies = cData || [];
  } catch {
    offline = true;
    const cachedYards = await cacheGet('yards', 'all');
    const cachedColonies = await cacheGet('colonies', 'all');
    if (cachedYards) yards = cachedYards;
    if (cachedColonies) colonies = filterByDateRange(cachedColonies, 'created_at', fromDate, toDate);
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
  downloadCsv(csv, buildFilename('hivelog-colony-status', fromDate, toDate));
  return { success: true, count: colonies.length, offline };
}

/**
 * Export treatment events log (for compliance reporting).
 * @param {string} [fromDate] - ISO date string like "2026-01-15"
 * @param {string} [toDate] - ISO date string like "2026-03-30"
 */
export async function exportTreatmentLog(fromDate, toDate) {
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

    let query = supabase
      .from('events')
      .select('*')
      .eq('type', 'treatment')
      .order('created_at', { ascending: false })
      .limit(100000);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate + 'T23:59:59Z');
    const { data: eData, error: eErr } = await query;
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
      events = filterByDateRange(
        cachedEvents.filter((e) => e.type === 'treatment'),
        'created_at', fromDate, toDate
      );
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
  downloadCsv(csv, buildFilename('hivelog-treatment-log', fromDate, toDate));
  return { success: true, count: events.length, offline };
}

/**
 * Export ELAP Loss Report — loss events grouped by yard with county/state.
 */
export async function exportElapLosses(fromDate, toDate) {
  let offline = false;
  let yards = [];
  let colonies = [];
  let events = [];

  try {
    const { data: yData } = await supabase.from('yards').select('id, name, county, state').limit(10000);
    yards = yData || [];
    const { data: cData } = await supabase.from('colonies').select('id, yard_id, label').limit(100000);
    colonies = cData || [];

    let query = supabase.from('events').select('*').eq('type', 'loss').order('created_at', { ascending: false }).limit(100000);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate + 'T23:59:59');
    const { data: eData } = await query;
    events = eData || [];
  } catch {
    offline = true;
    const cachedYards = await cacheGet('yards', 'all');
    if (cachedYards) yards = cachedYards;
    return { success: false, count: 0, offline };
  }

  if (events.length === 0) return { success: false, count: 0, offline };

  const yardMap = {};
  const yardCounty = {};
  const yardState = {};
  for (const y of yards) {
    yardMap[y.id] = y.name;
    yardCounty[y.id] = y.county || '';
    yardState[y.id] = y.state || '';
  }
  const colonyMap = {};
  const colonyYardMap = {};
  for (const c of colonies) {
    colonyMap[c.id] = c.label;
    colonyYardMap[c.id] = c.yard_id;
  }

  const headers = ['Date', 'Yard Name', 'County', 'State', 'Colony', 'Loss Notes'];
  const rows = events.map((e) => {
    const yardId = colonyYardMap[e.colony_id];
    return [
      formatDate(e.created_at),
      yardMap[yardId] || 'Unknown',
      yardCounty[yardId] || '',
      yardState[yardId] || '',
      colonyMap[e.colony_id] || 'Unknown',
      e.notes || '',
    ];
  });

  // Sort by county then yard name
  rows.sort((a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]));

  const csv = arrayToCsv(headers, rows);
  downloadCsv(csv, buildFilename('hivelog-elap-losses', fromDate, toDate));
  return { success: true, count: events.length, offline };
}

/**
 * Export Splits Report — all split yard events with source/destination.
 */
export async function exportSplitsReport(fromDate, toDate) {
  let offline = false;

  try {
    const { data: yards } = await supabase.from('yards').select('id, name').limit(10000);
    const yardMap = {};
    for (const y of (yards || [])) yardMap[y.id] = y.name;

    let query = supabase.from('yard_events').select('*')
      .in('type', ['split_out', 'split_in', 'split_local', 'move_out', 'transfer_out', 'transfer_in'])
      .order('created_at', { ascending: false }).limit(100000);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate + 'T23:59:59');
    const { data: events } = await query;

    if (!events || events.length === 0) return { success: false, count: 0, offline };

    const headers = ['Date', 'Type', 'Yard', 'Count', 'Related Yard', 'Notes'];
    const rows = events.map((e) => [
      formatDate(e.created_at),
      e.type.replace(/_/g, ' '),
      yardMap[e.yard_id] || 'Unknown',
      e.count ?? '',
      e.related_yard_id ? (yardMap[e.related_yard_id] || 'Unknown') : '',
      e.notes || '',
    ]);

    const csv = arrayToCsv(headers, rows);
    downloadCsv(csv, buildFilename('hivelog-splits-report', fromDate, toDate));
    return { success: true, count: events.length, offline };
  } catch {
    return { success: false, count: 0, offline: true };
  }
}

/**
 * Export Full Activity Report — all event types with county/state.
 */
export async function exportFullActivity(fromDate, toDate) {
  let offline = false;

  try {
    const { data: yards } = await supabase.from('yards').select('id, name, county, state').limit(10000);
    const yardMap = {};
    const yardCounty = {};
    const yardState = {};
    for (const y of (yards || [])) {
      yardMap[y.id] = y.name;
      yardCounty[y.id] = y.county || '';
      yardState[y.id] = y.state || '';
    }

    const { data: colonies } = await supabase.from('colonies').select('id, yard_id, label').limit(100000);
    const colonyMap = {};
    const colonyYardMap = {};
    for (const c of (colonies || [])) {
      colonyMap[c.id] = c.label;
      colonyYardMap[c.id] = c.yard_id;
    }

    // Colony-level events
    let query1 = supabase.from('events').select('*').order('created_at', { ascending: false }).limit(100000);
    if (fromDate) query1 = query1.gte('created_at', fromDate);
    if (toDate) query1 = query1.lte('created_at', toDate + 'T23:59:59');
    const { data: colonyEvents } = await query1;

    // Yard-level events
    let query2 = supabase.from('yard_events').select('*').order('created_at', { ascending: false }).limit(100000);
    if (fromDate) query2 = query2.gte('created_at', fromDate);
    if (toDate) query2 = query2.lte('created_at', toDate + 'T23:59:59');
    const { data: yardEvents } = await query2;

    const headers = ['Date', 'Level', 'Yard', 'County', 'State', 'Colony', 'Event Type', 'Count', 'Related Yard', 'Notes'];
    const rows = [];

    for (const e of (colonyEvents || [])) {
      const yardId = colonyYardMap[e.colony_id];
      rows.push([
        formatDate(e.created_at),
        'Colony',
        yardMap[yardId] || 'Unknown',
        yardCounty[yardId] || '',
        yardState[yardId] || '',
        colonyMap[e.colony_id] || 'Unknown',
        e.type,
        '',
        '',
        e.notes || '',
      ]);
    }

    for (const e of (yardEvents || [])) {
      rows.push([
        formatDate(e.created_at),
        'Yard',
        yardMap[e.yard_id] || 'Unknown',
        yardCounty[e.yard_id] || '',
        yardState[e.yard_id] || '',
        '',
        e.type,
        e.count ?? '',
        e.related_yard_id ? (yardMap[e.related_yard_id] || 'Unknown') : '',
        e.notes || '',
      ]);
    }

    if (rows.length === 0) return { success: false, count: 0, offline };

    rows.sort((a, b) => b[0].localeCompare(a[0]));

    const csv = arrayToCsv(headers, rows);
    downloadCsv(csv, buildFilename('hivelog-full-activity', fromDate, toDate));
    return { success: true, count: rows.length, offline };
  } catch {
    return { success: false, count: 0, offline: true };
  }
}

/**
 * Share a CSV file via Web Share API (or fall back to download).
 */
export async function shareCsv(csvString, filename) {
  if (navigator.share && navigator.canShare) {
    const file = new File([csvString], filename, { type: 'text/csv' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return true;
      } catch {
        // User cancelled or share failed — fall back to download
      }
    }
  }
  downloadCsv(csvString, filename);
  return false;
}

/**
 * Consultant ELAP Loss Report — losses across selected beekeepers, grouped by beekeeper → county.
 * @param {string[]} beekeeperIds - array of beekeeper user IDs
 * @param {string} fromDate
 * @param {string} toDate
 */
export async function exportConsultantElapReport(beekeeperIds, fromDate, toDate) {
  try {
    const { data: yards } = await supabase
      .from('yards')
      .select('id, owner_id, name, hive_count, county, state, colonies(id)')
      .in('owner_id', beekeeperIds)
      .limit(100000);

    if (!yards || yards.length === 0) return { success: false, count: 0 };

    const yardMap = {};
    const yardOwner = {};
    for (const y of yards) {
      yardMap[y.id] = y;
      yardOwner[y.id] = y.owner_id;
    }
    const yardIds = yards.map((y) => y.id);

    // Colony-level losses
    const { data: colonies } = await supabase
      .from('colonies')
      .select('id, yard_id, label')
      .in('yard_id', yardIds)
      .limit(100000);

    const colonyMap = {};
    const colonyYardMap = {};
    for (const c of (colonies || [])) {
      colonyMap[c.id] = c.label;
      colonyYardMap[c.id] = c.yard_id;
    }

    let q1 = supabase.from('events').select('*').eq('type', 'loss').order('created_at', { ascending: false }).limit(100000);
    if (fromDate) q1 = q1.gte('created_at', fromDate);
    if (toDate) q1 = q1.lte('created_at', toDate + 'T23:59:59');
    const { data: colonyLosses } = await q1;

    // Yard-level losses
    let q2 = supabase.from('yard_events').select('*').eq('type', 'loss').in('yard_id', yardIds).order('created_at', { ascending: false }).limit(100000);
    if (fromDate) q2 = q2.gte('created_at', fromDate);
    if (toDate) q2 = q2.lte('created_at', toDate + 'T23:59:59');
    const { data: yardLosses } = await q2;

    const headers = ['Beekeeper', 'Date', 'Yard', 'County', 'State', 'Colony', 'Count', 'Notes'];
    const rows = [];

    // Colony-level loss rows
    for (const e of (colonyLosses || [])) {
      const yardId = colonyYardMap[e.colony_id];
      const yard = yardMap[yardId];
      if (!yard || !beekeeperIds.includes(yard.owner_id)) continue;
      rows.push([
        yard.owner_id.slice(0, 8),
        formatDate(e.created_at),
        yard.name,
        yard.county || '',
        yard.state || '',
        colonyMap[e.colony_id] || '',
        '1',
        e.notes || '',
      ]);
    }

    // Yard-level loss rows
    for (const e of (yardLosses || [])) {
      const yard = yardMap[e.yard_id];
      if (!yard) continue;
      rows.push([
        yard.owner_id.slice(0, 8),
        formatDate(e.created_at),
        yard.name,
        yard.county || '',
        yard.state || '',
        '',
        String(e.count || 0),
        e.notes || '',
      ]);
    }

    if (rows.length === 0) return { success: false, count: 0 };

    // Sort by beekeeper → county → date
    rows.sort((a, b) => a[0].localeCompare(b[0]) || a[3].localeCompare(b[3]) || a[1].localeCompare(b[1]));

    // Add summary rows per beekeeper
    const summaryHeaders = ['', '', '', '', '', '', '', ''];
    const finalRows = [];
    let currentBk = null;
    let bkLossTotal = 0;

    for (const row of rows) {
      if (row[0] !== currentBk) {
        if (currentBk != null) {
          finalRows.push(['', '', '', '', '', '', String(bkLossTotal), `TOTAL for ${currentBk}`]);
          finalRows.push(summaryHeaders);
        }
        currentBk = row[0];
        bkLossTotal = 0;
      }
      bkLossTotal += parseInt(row[6], 10) || 0;
      finalRows.push(row);
    }
    if (currentBk != null) {
      finalRows.push(['', '', '', '', '', '', String(bkLossTotal), `TOTAL for ${currentBk}`]);
    }

    const csv = arrayToCsv(headers, finalRows);
    downloadCsv(csv, buildFilename('hivelog-consultant-elap', fromDate, toDate));
    return { success: true, count: rows.length };
  } catch {
    return { success: false, count: 0 };
  }
}

/**
 * Consultant Quarterly Summary — one section per beekeeper showing
 * starting hives, losses, splits, ending hives, loss percentage.
 * @param {Array} clients - enriched client objects from ConsultantDashboard
 * @param {string} fromDate
 * @param {string} toDate
 */
export async function exportConsultantQuarterlySummary(clients, fromDate, toDate) {
  try {
    const beekeeperIds = clients.map((c) => c.beekeeper_id);

    const { data: yards } = await supabase
      .from('yards')
      .select('id, owner_id, name, hive_count, county, state, colonies(id)')
      .in('owner_id', beekeeperIds)
      .limit(100000);

    const yardIds = (yards || []).map((y) => y.id);

    // Losses in range
    let q1 = supabase.from('yard_events').select('yard_id, count').in('yard_id', yardIds).eq('type', 'loss');
    if (fromDate) q1 = q1.gte('created_at', fromDate);
    if (toDate) q1 = q1.lte('created_at', toDate + 'T23:59:59');
    const { data: losses } = await q1;

    // Splits in range
    let q2 = supabase.from('yard_events').select('yard_id, count').in('yard_id', yardIds).in('type', ['split_local', 'split_in']);
    if (fromDate) q2 = q2.gte('created_at', fromDate);
    if (toDate) q2 = q2.lte('created_at', toDate + 'T23:59:59');
    const { data: splits } = await q2;

    function sumForBeekeeper(events, bkId) {
      let total = 0;
      for (const e of (events || [])) {
        const yard = (yards || []).find((y) => y.id === e.yard_id);
        if (yard && yard.owner_id === bkId) total += (e.count || 0);
      }
      return total;
    }

    const headers = ['Beekeeper', 'Region', 'Current Hives', 'Losses', 'Splits', 'Loss %', 'Expected Max %', 'Status'];
    const rows = clients.map((client) => {
      const bkYards = (yards || []).filter((y) => y.owner_id === client.beekeeper_id);
      const totalHives = bkYards.reduce((sum, y) => sum + Math.max(y.hive_count || 0, y.colonies?.length || 0), 0);
      const totalLosses = sumForBeekeeper(losses, client.beekeeper_id);
      const totalSplits = sumForBeekeeper(splits, client.beekeeper_id);
      const lossRate = totalHives > 0 ? Math.round((totalLosses / totalHives) * 100) : 0;
      const expectedMax = client.expected_winter_loss || 40;
      const status = lossRate <= expectedMax ? 'OK' : lossRate <= expectedMax + 10 ? 'WARNING' : 'CRITICAL';

      return [
        client.beekeeper_id.slice(0, 8),
        client.region || '',
        String(totalHives),
        String(totalLosses),
        String(totalSplits),
        `${lossRate}%`,
        `${expectedMax}%`,
        status,
      ];
    });

    if (rows.length === 0) return { success: false, count: 0 };

    const csv = arrayToCsv(headers, rows);
    downloadCsv(csv, buildFilename('hivelog-quarterly-summary', fromDate, toDate));
    return { success: true, count: rows.length };
  } catch {
    return { success: false, count: 0 };
  }
}
