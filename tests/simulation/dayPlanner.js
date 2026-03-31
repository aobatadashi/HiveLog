/**
 * DayPlanner — decides what Jake does on each day of June 2026.
 */
import { DAYS_OFF, HOT_DAYS, MOVE_DAYS, OFFLINE_DAYS, WEEKLY_PLAN } from './config.js';

export class DayPlanner {
  constructor(yardsMap, coloniesMap) {
    // yardsMap: { yardName: yardRow }
    // coloniesMap: { yardId: colonyRow[] }
    this.yardsMap = yardsMap;
    this.coloniesMap = coloniesMap;
  }

  planDay(dayNum) {
    if (DAYS_OFF.includes(dayNum)) {
      return { dayOff: true, description: 'Saturday — day off' };
    }

    const isHot = HOT_DAYS.includes(dayNum);
    const isMove = MOVE_DAYS.includes(dayNum);
    const isOffline = OFFLINE_DAYS.includes(dayNum);
    const week = this._getWeek(dayNum);
    const weekPlan = WEEKLY_PLAN[week];
    const sundayPlan = WEEKLY_PLAN.sundays[dayNum];

    if (sundayPlan) {
      return this._planSunday(dayNum, sundayPlan, isHot);
    }

    if (!weekPlan) {
      return { dayOff: true, description: `Day ${dayNum} — no plan` };
    }

    const dayIdx = weekPlan.days.indexOf(dayNum);
    if (dayIdx === -1) {
      // Check if it's a Sunday handled above
      return { dayOff: true, description: `Day ${dayNum} — not in week plan` };
    }

    const yards = (weekPlan.yardsPerDay[dayIdx] || []).map(name => this.yardsMap[name]).filter(Boolean);
    const actions = [];
    let description = `${weekPlan.focus}`;

    if (isHot) description += ' [HOT DAY — morning only, half volume]';
    if (isOffline) description += ' [PARTIAL OFFLINE]';
    if (isMove) description += ' [MOVE DAY]';

    const volumeMultiplier = isHot ? 0.5 : 1.0;

    // ─── Week-specific action generation ──────────────────────
    if (week === 'week1') {
      this._planWeek1(actions, yards, dayIdx, weekPlan, volumeMultiplier, isOffline);
    } else if (week === 'week2') {
      this._planWeek2(actions, yards, dayIdx, weekPlan, volumeMultiplier, isOffline);
    } else if (week === 'week3') {
      this._planWeek3(actions, yards, dayIdx, weekPlan, volumeMultiplier, isOffline, isMove);
    } else if (week === 'week4') {
      this._planWeek4(actions, yards, dayIdx, weekPlan, volumeMultiplier, isOffline);
    }

    return { dayOff: false, description, actions, yards: yards.map(y => y.name), isHot, isMove, isOffline };
  }

  _planSunday(dayNum, plan, isHot) {
    const yards = plan.yards.map(name => this.yardsMap[name]).filter(Boolean);
    const actions = [];
    const mult = isHot ? 0.5 : 1.0;
    const inspCount = Math.round(plan.inspections * mult);

    // Walk Yard inspections across the Sunday yards
    let remaining = inspCount;
    for (const yard of yards) {
      const colonies = this._activeColonies(yard.id);
      const n = Math.min(remaining, colonies.length);
      if (n > 0) {
        actions.push({
          type: 'walkYardInspection',
          yard,
          colonies: colonies.slice(0, n),
          offline: false,
        });
        remaining -= n;
      }
    }

    return {
      dayOff: false,
      description: `Sunday — ${plan.focus}${isHot ? ' [HOT]' : ''}`,
      actions,
      yards: yards.map(y => y.name),
      isHot,
      isMove: false,
      isOffline: false,
    };
  }

  _planWeek1(actions, yards, dayIdx, plan, mult, offline) {
    // Heavy inspection sweep + deadouts + queen recording
    let inspTarget = Math.round((plan.dailyInspections[dayIdx] || 60) * mult);
    const deadoutTarget = Math.round((plan.deadoutsPerDay[dayIdx] || 3) * mult);
    const queenTarget = Math.round((plan.queensRecorded[dayIdx] || 6) * mult);

    let deadoutsRemaining = deadoutTarget;
    let queensRemaining = queenTarget;

    for (const yard of yards) {
      const colonies = this._activeColonies(yard.id);
      const n = Math.min(inspTarget, colonies.length);
      if (n > 0) {
        actions.push({
          type: 'walkYardInspection',
          yard,
          colonies: colonies.slice(0, n),
          offline: false,
        });
        inspTarget -= n;
      }

      // Deadouts from this yard
      if (deadoutsRemaining > 0) {
        const deadoutColonies = colonies.slice(n, n + deadoutsRemaining);
        for (const col of deadoutColonies) {
          actions.push({ type: 'markDeadout', yard, colony: col, offline: false });
          deadoutsRemaining--;
        }
      }

      // Queen recordings
      if (queensRemaining > 0) {
        const queenColonies = colonies.slice(0, Math.min(queensRemaining, colonies.length));
        for (const col of queenColonies) {
          actions.push({ type: 'recordQueen', yard, colony: col, offline: false });
          queensRemaining--;
          if (queensRemaining <= 0) break;
        }
      }
    }
  }

  _planWeek2(actions, yards, dayIdx, plan, mult, offline) {
    // Treatment + inspections on side yards
    const treatTarget = Math.round((plan.treatmentsPerDay[dayIdx] || 0) * mult);
    const inspTarget = Math.round((plan.inspectionsPerDay[dayIdx] || 20) * mult);

    const treatmentYardNames = new Set(plan.treatmentYards);

    for (const yard of yards) {
      const colonies = this._activeColonies(yard.id);
      const isOfflineYard = offline && (yard.name === 'Bear Mountain' || yard.name === 'Caliente Creek');

      if (treatmentYardNames.has(yard.name) && treatTarget > 0) {
        // Treatment via Walk Yard mode
        const n = Math.min(treatTarget, colonies.length);
        actions.push({
          type: 'walkYardTreatment',
          yard,
          colonies: colonies.slice(0, n),
          offline: isOfflineYard,
        });
      } else {
        // Inspection on non-treatment yard
        const n = Math.min(inspTarget, colonies.length);
        if (n > 0) {
          actions.push({
            type: 'walkYardInspection',
            yard,
            colonies: colonies.slice(0, n),
            offline: isOfflineYard,
          });
        }
      }
    }
  }

  _planWeek3(actions, yards, dayIdx, plan, mult, offline, isMove) {
    const harvestTarget = Math.round((plan.harvestsPerDay[dayIdx] || 0) * mult);
    const splitTarget = Math.round((plan.splitsPerDay[dayIdx] || 0) * mult);
    const transferTarget = Math.round((plan.transfersPerDay[dayIdx] || 0) * mult);
    const inspTarget = Math.round((plan.inspectionsPerDay[dayIdx] || 15) * mult);

    const harvestYardNames = new Set(plan.harvestYards);
    let harvestRemaining = harvestTarget;
    let splitRemaining = splitTarget;
    let transferRemaining = transferTarget;
    let inspRemaining = inspTarget;

    for (const yard of yards) {
      const colonies = this._activeColonies(yard.id);

      // Harvest events (batch per yard)
      if (harvestYardNames.has(yard.name) && harvestRemaining > 0) {
        const n = Math.min(harvestRemaining, colonies.length);
        actions.push({
          type: 'batchHarvest',
          yard,
          colonies: colonies.slice(0, n),
          offline: false,
        });
        harvestRemaining -= n;
      }

      // Splits (individual)
      if (splitRemaining > 0) {
        const splitColonies = colonies.slice(0, Math.min(splitRemaining, 5));
        for (const col of splitColonies) {
          actions.push({ type: 'splitColony', yard, colony: col, offline: false });
          splitRemaining--;
        }
      }

      // Transfers (individual — no batch transfer feature, big friction point)
      if (isMove && transferRemaining > 0) {
        const transferColonies = colonies.slice(0, Math.min(transferRemaining, colonies.length));
        for (const col of transferColonies) {
          actions.push({ type: 'transferColony', yard, colony: col, offline: false });
          transferRemaining--;
          if (transferRemaining <= 0) break;
        }
      }

      // Inspections
      if (inspRemaining > 0) {
        const n = Math.min(inspRemaining, colonies.length);
        if (n > 0) {
          actions.push({
            type: 'walkYardInspection',
            yard,
            colonies: colonies.slice(0, n),
            offline: false,
          });
          inspRemaining -= n;
        }
      }
    }
  }

  _planWeek4(actions, yards, dayIdx, plan, mult, offline) {
    const feedTarget = Math.round((plan.feedsPerDay[dayIdx] || 0) * mult);
    const inspTarget = Math.round((plan.inspectionsPerDay[dayIdx] || 30) * mult);
    const deadoutTarget = plan.deadoutsPerDay[dayIdx] || 0;
    const queenTarget = Math.round((plan.queensRecorded[dayIdx] || 5) * mult);

    const feedYardNames = new Set(plan.feedYards);
    let feedRemaining = feedTarget;
    let inspRemaining = inspTarget;
    let deadoutsRemaining = deadoutTarget;
    let queensRemaining = queenTarget;

    for (const yard of yards) {
      const colonies = this._activeColonies(yard.id);

      // Feeding (batch per yard)
      if (feedYardNames.has(yard.name) && feedRemaining > 0) {
        const n = Math.min(feedRemaining, colonies.length);
        actions.push({
          type: 'batchFeed',
          yard,
          colonies: colonies.slice(0, n),
          offline: false,
        });
        feedRemaining -= n;
      }

      // Inspections
      if (inspRemaining > 0) {
        const n = Math.min(inspRemaining, colonies.length);
        if (n > 0) {
          actions.push({
            type: 'walkYardInspection',
            yard,
            colonies: colonies.slice(0, n),
            offline: false,
          });
          inspRemaining -= n;
        }
      }

      // Deadouts
      if (deadoutsRemaining > 0) {
        const col = colonies[colonies.length - 1]; // pick from end
        if (col) {
          actions.push({ type: 'markDeadout', yard, colony: col, offline: false });
          deadoutsRemaining--;
        }
      }

      // Queens
      if (queensRemaining > 0) {
        const queenColonies = colonies.slice(0, Math.min(queensRemaining, 3));
        for (const col of queenColonies) {
          actions.push({ type: 'recordQueen', yard, colony: col, offline: false });
          queensRemaining--;
          if (queensRemaining <= 0) break;
        }
      }
    }
  }

  _getWeek(dayNum) {
    if (dayNum >= 1 && dayNum <= 6) return 'week1';
    if (dayNum >= 7 && dayNum <= 13) return 'week2';
    if (dayNum >= 14 && dayNum <= 20) return 'week3';
    if (dayNum >= 21 && dayNum <= 30) return 'week4';
    return null;
  }

  _activeColonies(yardId) {
    return (this.coloniesMap[yardId] || []).filter(c => c.status === 'active');
  }
}
