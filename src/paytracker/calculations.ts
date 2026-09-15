import {
  DayType,
  HourBreakdown,
  PaySettings,
  ShiftCalculation,
  ShiftEntry,
  TimeBlock,
} from './types';

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToHours(mins: number): number {
  return Math.round((mins / 60) * 100) / 100;
}

/** Duration of a shift in minutes, handling a shift that runs past midnight. */
export function blockDurationMinutes(block: TimeBlock): number {
  const startMin = timeToMinutes(block.start);
  let endMin = timeToMinutes(block.end);
  if (endMin <= startMin) endMin += 24 * 60;
  return endMin - startMin;
}

export function blockPaidMinutes(block: TimeBlock): number {
  const duration = blockDurationMinutes(block);
  const unpaidBreak = block.paidBreak ? 0 : block.breakMinutes;
  return Math.max(0, duration - unpaidBreak);
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function classifyDayType(iso: string, settings: PaySettings, override: DayType | null): DayType {
  if (override) return override;
  if (settings.publicHolidays.includes(iso)) return 'publicHoliday';
  const dow = parseISODate(iso).getDay(); // 0 = Sunday, 6 = Saturday
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

/**
 * Splits the paid minutes of a weekday shift across ordinary vs. evening-rate
 * time, based on settings.eveningStartTime. Non-weekday day types are paid
 * as a single flat category and don't need splitting.
 */
function splitWeekdayMinutes(block: TimeBlock, settings: PaySettings): { ordinaryMin: number; eveningMin: number } {
  const startMin = timeToMinutes(block.start);
  let endMin = timeToMinutes(block.end);
  if (endMin <= startMin) endMin += 24 * 60;

  if (!settings.eveningStartTime) {
    const paidMin = blockPaidMinutes(block);
    return { ordinaryMin: paidMin, eveningMin: 0 };
  }

  const eveningStart = timeToMinutes(settings.eveningStartTime);
  const workedEveningMin = Math.max(0, endMin - Math.max(startMin, eveningStart));
  const workedOrdinaryMin = Math.max(0, endMin - startMin) - workedEveningMin;

  // Remove unpaid break time proportionally isn't precise enough; instead
  // deduct the unpaid break from ordinary time first, then evening, since
  // breaks are most commonly scheduled during ordinary hours.
  const unpaidBreak = block.paidBreak ? 0 : block.breakMinutes;
  let remainingBreak = unpaidBreak;
  let ordinaryMin = workedOrdinaryMin;
  let eveningMin = workedEveningMin;
  const takeFromOrdinary = Math.min(remainingBreak, ordinaryMin);
  ordinaryMin -= takeFromOrdinary;
  remainingBreak -= takeFromOrdinary;
  const takeFromEvening = Math.min(remainingBreak, eveningMin);
  eveningMin -= takeFromEvening;

  return { ordinaryMin: Math.max(0, ordinaryMin), eveningMin: Math.max(0, eveningMin) };
}

export function computeHourBreakdown(block: TimeBlock, dayType: DayType, settings: PaySettings): HourBreakdown {
  const breakdown: HourBreakdown = {
    ordinaryHours: 0,
    eveningHours: 0,
    saturdayHours: 0,
    sundayHours: 0,
    publicHolidayHours: 0,
    dailyOvertimeHours: 0,
    fortnightOvertimeHours: 0,
    totalPaidHours: 0,
  };

  if (dayType === 'weekday') {
    const { ordinaryMin, eveningMin } = splitWeekdayMinutes(block, settings);
    breakdown.ordinaryHours = minutesToHours(ordinaryMin);
    breakdown.eveningHours = minutesToHours(eveningMin);
  } else if (dayType === 'saturday') {
    breakdown.saturdayHours = minutesToHours(blockPaidMinutes(block));
  } else if (dayType === 'sunday') {
    breakdown.sundayHours = minutesToHours(blockPaidMinutes(block));
  } else {
    breakdown.publicHolidayHours = minutesToHours(blockPaidMinutes(block));
  }

  breakdown.totalPaidHours =
    breakdown.ordinaryHours + breakdown.eveningHours + breakdown.saturdayHours + breakdown.sundayHours + breakdown.publicHolidayHours;

  const dailyThreshold = settings.overtime.dailyThresholdHours;
  if (dailyThreshold != null && breakdown.totalPaidHours > dailyThreshold) {
    breakdown.dailyOvertimeHours = Math.round((breakdown.totalPaidHours - dailyThreshold) * 100) / 100;
  }

  return breakdown;
}

/** Base wage pay (before any overtime premium) for a single hour breakdown. */
export function computeBasePay(hours: HourBreakdown, settings: PaySettings): number {
  const rate = settings.baseHourlyRate;
  const casual = settings.employmentType === 'casual';
  const ordinaryLoading = casual ? 1 + settings.casualLoadingPercent / 100 : 1;
  const penaltyLoading = casual && settings.applyCasualLoadingToPenalties ? 1 + settings.casualLoadingPercent / 100 : 1;

  const ordinaryPay = hours.ordinaryHours * rate * ordinaryLoading;
  const eveningPay = hours.eveningHours * rate * settings.multipliers.evening * penaltyLoading;
  const saturdayPay = hours.saturdayHours * rate * settings.multipliers.saturday * penaltyLoading;
  const sundayPay = hours.sundayHours * rate * settings.multipliers.sunday * penaltyLoading;
  const publicHolidayPay = hours.publicHolidayHours * rate * settings.multipliers.publicHoliday * penaltyLoading;

  return ordinaryPay + eveningPay + saturdayPay + sundayPay + publicHolidayPay;
}

/** Extra premium paid on top of base pay for hours beyond the daily OT threshold. */
export function computeDailyOvertimePremium(hours: HourBreakdown, settings: PaySettings): number {
  if (hours.dailyOvertimeHours <= 0) return 0;
  const extraMultiplier = Math.max(0, settings.overtime.dailyMultiplier - 1);
  return hours.dailyOvertimeHours * settings.baseHourlyRate * extraMultiplier;
}

/** Extra premium paid on top of base pay for hours beyond the fortnightly OT threshold. */
export function computeFortnightOvertimePremium(fortnightOvertimeHours: number, settings: PaySettings): number {
  if (fortnightOvertimeHours <= 0) return 0;
  const extraMultiplier = Math.max(0, settings.overtime.fortnightMultiplier - 1);
  return fortnightOvertimeHours * settings.baseHourlyRate * extraMultiplier;
}

export function shiftVarianceMinutes(shift: ShiftEntry): number | null {
  if (!shift.expected || !shift.worked) return null;
  const expectedMin = blockPaidMinutes(shift.expected);
  const workedMin = blockPaidMinutes(shift.worked);
  return workedMin - expectedMin;
}

/**
 * Calculates a single shift in isolation (no cross-shift fortnightly OT applied yet;
 * see applyFortnightOvertime for the second pass across a whole period).
 */
export function calculateShift(shift: ShiftEntry, settings: PaySettings): ShiftCalculation {
  const dayType = classifyDayType(shift.date, settings, shift.dayTypeOverride);
  const emptyHours: HourBreakdown = {
    ordinaryHours: 0,
    eveningHours: 0,
    saturdayHours: 0,
    sundayHours: 0,
    publicHolidayHours: 0,
    dailyOvertimeHours: 0,
    fortnightOvertimeHours: 0,
    totalPaidHours: 0,
  };

  const leaveHours = shift.leave?.hours ?? 0;
  const leavePay = shift.leave && shift.leave.type !== 'unpaid' ? leaveHours * settings.baseHourlyRate : 0;

  if (shift.notWorked || !shift.worked) {
    const allowancePay = 0;
    return {
      shift,
      dayType,
      hours: emptyHours,
      basePay: 0,
      overtimePremiumPay: 0,
      wagePay: 0,
      allowancePay,
      totalPay: leavePay,
      leaveHours,
      leavePay,
      varianceMinutes: null,
    };
  }

  const hours = computeHourBreakdown(shift.worked, dayType, settings);
  const basePay = computeBasePay(hours, settings);
  const dailyOtPremium = computeDailyOvertimePremium(hours, settings);
  const allowancePay = shift.parkingPaid ? shift.parkingAmount : 0;

  return {
    shift,
    dayType,
    hours,
    basePay,
    overtimePremiumPay: dailyOtPremium,
    wagePay: basePay + dailyOtPremium,
    allowancePay,
    totalPay: basePay + dailyOtPremium + allowancePay + leavePay,
    leaveHours,
    leavePay,
    varianceMinutes: shiftVarianceMinutes(shift),
  };
}

/**
 * Second pass: once all shifts in a fortnight are calculated, check whether total
 * paid hours exceed the fortnightly OT threshold and, if so, attribute the excess
 * (taken from the chronologically-last hours worked) as fortnight OT and add the premium.
 */
export function applyFortnightOvertime(calcs: ShiftCalculation[], settings: PaySettings): ShiftCalculation[] {
  const threshold = settings.overtime.fortnightThresholdHours;
  if (threshold == null) return calcs;

  const totalPaidHours = calcs.reduce((sum, c) => sum + c.hours.totalPaidHours, 0);
  let excess = Math.round((totalPaidHours - threshold) * 100) / 100;
  if (excess <= 0) return calcs;

  // Walk shifts latest-first, attributing excess hours to fortnight OT.
  const sorted = [...calcs].sort((a, b) => (a.shift.date < b.shift.date ? 1 : -1));
  const updates = new Map<string, number>();
  for (const c of sorted) {
    if (excess <= 0) break;
    const take = Math.min(excess, c.hours.totalPaidHours);
    if (take > 0) {
      updates.set(c.shift.id, take);
      excess = Math.round((excess - take) * 100) / 100;
    }
  }

  return calcs.map((c) => {
    const fortnightOvertimeHours = updates.get(c.shift.id) ?? 0;
    if (fortnightOvertimeHours <= 0) return c;
    const premium = computeFortnightOvertimePremium(fortnightOvertimeHours, settings);
    return {
      ...c,
      hours: { ...c.hours, fortnightOvertimeHours },
      overtimePremiumPay: c.overtimePremiumPay + premium,
      wagePay: c.wagePay + premium,
      totalPay: c.totalPay + premium,
    };
  });
}

export interface FortnightPeriod {
  index: number;
  start: string; // ISO
  end: string; // ISO inclusive
}

export function getFortnightPeriod(iso: string, anchorIso: string): FortnightPeriod {
  const anchor = parseISODate(anchorIso);
  const date = parseISODate(iso);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((date.getTime() - anchor.getTime()) / dayMs);
  const index = Math.floor(diffDays / 14);
  const startDate = new Date(anchor.getTime() + index * 14 * dayMs);
  const endDate = new Date(startDate.getTime() + 13 * dayMs);
  return { index, start: dateToISO(startDate), end: dateToISO(endDate) };
}

export function isSameOrAfter(a: string, b: string): boolean {
  return a >= b;
}
