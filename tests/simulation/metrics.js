/**
 * MetricsTracker — accumulates all simulation statistics for the report.
 */

export class MetricsTracker {
  constructor() {
    this.days = {}; // keyed by day number
    this.totals = {
      eventsByType: {},
      totalTaps: 0,
      totalHivelogSeconds: 0,
      totalPaperSeconds: 0,
      offlineEvents: 0,
      frictionLog: [],
      walkYardTapsSaved: 0,
      repeatTypeTapsSaved: 0,
      coloniesTouched: new Set(),
      yardsVisited: new Set(),
      fieldDays: 0,
      peakDay: { day: 0, events: 0 },
      actionBreakdown: {},
    };
    this._currentDay = null;
  }

  startDay(dayNum, description) {
    this._currentDay = dayNum;
    this.days[dayNum] = {
      description,
      events: {},
      taps: 0,
      hivelogSeconds: 0,
      paperSeconds: 0,
      offlineEvents: 0,
      friction: [],
      actions: [],
    };
    this.totals.fieldDays++;
  }

  recordAction(dayNum, result) {
    const day = this.days[dayNum];
    if (!day) return;

    day.actions.push(result.type);
    day.taps += result.taps;
    day.hivelogSeconds += result.hivelogSeconds;
    day.paperSeconds += result.paperSeconds;

    if (result.offline) {
      day.offlineEvents += result.eventCount || 0;
      this.totals.offlineEvents += result.eventCount || 0;
    }

    // Event counts by type
    if (result.eventTypes) {
      for (const [type, count] of Object.entries(result.eventTypes)) {
        day.events[type] = (day.events[type] || 0) + count;
        this.totals.eventsByType[type] = (this.totals.eventsByType[type] || 0) + count;
      }
    }

    // Accumulate totals
    this.totals.totalTaps += result.taps;
    this.totals.totalHivelogSeconds += result.hivelogSeconds;
    this.totals.totalPaperSeconds += result.paperSeconds;

    // Track colonies and yards
    if (result.coloniesTouched) {
      for (const id of result.coloniesTouched) {
        this.totals.coloniesTouched.add(id);
      }
    }
    if (result.yardName) {
      this.totals.yardsVisited.add(result.yardName);
    }

    // Walk Yard savings
    if (result.walkYardTapsSaved) {
      this.totals.walkYardTapsSaved += result.walkYardTapsSaved;
    }

    // Friction
    if (result.frictionNotes) {
      for (const note of result.frictionNotes) {
        day.friction.push(note);
        this.totals.frictionLog.push({ day: dayNum, note });
      }
    }

    // Action breakdown
    const key = result.type;
    if (!this.totals.actionBreakdown[key]) {
      this.totals.actionBreakdown[key] = { count: 0, taps: 0, hivelogSec: 0, paperSec: 0, events: 0 };
    }
    const ab = this.totals.actionBreakdown[key];
    ab.count++;
    ab.taps += result.taps;
    ab.hivelogSec += result.hivelogSeconds;
    ab.paperSec += result.paperSeconds;
    ab.events += result.eventCount || 0;
  }

  finishDay(dayNum) {
    const day = this.days[dayNum];
    if (!day) return;

    // Add paper-only daily overhead
    const paperOverhead = 600 + 300 + 450; // tally(10min) + morning(5min) + withdrawal(7.5min)
    day.paperSeconds += paperOverhead;
    this.totals.totalPaperSeconds += paperOverhead;

    // HiveLog equivalent overhead (glancing at screens)
    const hivelogOverhead = 3 + 5; // home screen + withdrawal badge
    day.hivelogSeconds += hivelogOverhead;
    this.totals.totalHivelogSeconds += hivelogOverhead;

    // Track peak day
    const totalDayEvents = Object.values(day.events).reduce((s, v) => s + v, 0);
    if (totalDayEvents > this.totals.peakDay.events) {
      this.totals.peakDay = { day: dayNum, events: totalDayEvents };
    }
  }

  recordDayOff(dayNum) {
    this.days[dayNum] = { description: 'Day off (Saturday)', events: {}, taps: 0, hivelogSeconds: 0, paperSeconds: 0, offlineEvents: 0, friction: [], actions: [], off: true };
  }

  getSummary() {
    const totalEvents = Object.values(this.totals.eventsByType).reduce((s, v) => s + v, 0);
    return {
      totalEvents,
      eventsByType: { ...this.totals.eventsByType },
      totalTaps: this.totals.totalTaps,
      totalHivelogSeconds: this.totals.totalHivelogSeconds,
      totalPaperSeconds: this.totals.totalPaperSeconds,
      fieldDays: this.totals.fieldDays,
      avgEventsPerDay: Math.round(totalEvents / Math.max(this.totals.fieldDays, 1)),
      avgTapsPerDay: Math.round(this.totals.totalTaps / Math.max(this.totals.fieldDays, 1)),
      peakDay: this.totals.peakDay,
      coloniesTouched: this.totals.coloniesTouched.size,
      yardsVisited: this.totals.yardsVisited.size,
      offlineEvents: this.totals.offlineEvents,
      frictionLog: this.totals.frictionLog,
      walkYardTapsSaved: this.totals.walkYardTapsSaved,
      repeatTypeTapsSaved: this.totals.repeatTypeTapsSaved,
      actionBreakdown: this.totals.actionBreakdown,
      days: this.days,
    };
  }
}
