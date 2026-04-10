/**
 * Calculate quarterly loss rate for a beekeeper.
 * @param {number} losses - total hive losses in the quarter
 * @param {number} totalHives - total hives at start of quarter (or current)
 * @returns {number} loss rate as percentage (0-100)
 */
export function calcLossRate(losses, totalHives) {
  if (!totalHives || totalHives <= 0) return 0;
  return Math.round((losses / totalHives) * 100);
}

/**
 * Determine if a loss rate exceeds expected range.
 * @param {number} lossRate - current loss rate %
 * @param {number} expectedMax - expected max % (e.g., 40 for winter, 25 for summer)
 * @returns {'ok' | 'warning' | 'critical'}
 */
export function getLossAlertLevel(lossRate, expectedMax) {
  if (lossRate <= expectedMax) return 'ok';
  if (lossRate <= expectedMax + 10) return 'warning';
  return 'critical';
}

/**
 * Get the current season's expected loss rate.
 * Winter = Nov-Mar, Summer = Apr-Oct
 * @param {number} expectedWinter - expected winter loss %
 * @param {number} expectedSummer - expected summer loss %
 * @returns {{ expected: number, season: string }}
 */
export function getSeasonalExpected(expectedWinter, expectedSummer) {
  const month = new Date().getMonth(); // 0-11
  const isWinter = month >= 10 || month <= 2; // Nov-Mar
  return {
    expected: isWinter ? (expectedWinter || 40) : (expectedSummer || 25),
    season: isWinter ? 'Winter' : 'Summer',
  };
}

/**
 * Calculate trend direction comparing current quarter to previous quarter.
 * @param {number} currentRate - current quarter loss rate %
 * @param {number} previousRate - previous quarter loss rate %
 * @returns {'up' | 'down' | 'flat'}
 */
export function getTrendDirection(currentRate, previousRate) {
  if (previousRate == null) return 'flat';
  const diff = currentRate - previousRate;
  if (diff > 3) return 'up';
  if (diff < -3) return 'down';
  return 'flat';
}

/**
 * Get quarter date boundaries.
 * @param {number} quartersBack - 0 = current quarter, 1 = previous, etc.
 * @returns {{ start: string, end: string }}
 */
export function getQuarterRange(quartersBack = 0) {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const year = now.getFullYear();

  const targetQuarter = currentQuarter - quartersBack;
  const targetYear = year + Math.floor(targetQuarter / 4);
  const q = ((targetQuarter % 4) + 4) % 4;

  const startMonth = q * 3;
  const start = new Date(targetYear, startMonth, 1);
  const end = new Date(targetYear, startMonth + 3, 0, 23, 59, 59);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
