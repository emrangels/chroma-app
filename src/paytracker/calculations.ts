import {
  DayType,
  HourBreakdown,
  PaySettings,
  ShiftCalculation,
  ShiftEntry,
  TimeBlock,
  WeekdayShiftCategory,
} from './types';

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function minutesToHours(mins: number): number {
  return round2(mins / 60);
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
 * Classifies a whole weekday shift per EBA cl.32.1: afternoon shift = starts >=12:00
 * and finishes after 18:00 same day; night shift = starts >=18:00 (and, given shifts
 * are capped at ~12hrs, necessarily finishes well before 7:30am the next day).
 */
export function classifyWeekdayShift(block: TimeBlock): WeekdayShiftCategory {
  const startMin = timeToMinutes(block.start);
  let endMin = timeToMinutes(block.end);
  if (endMin <= startMin) endMin += 24 * 60;

  if (startMin >= 18 * 60) return 'night';
  if (startMin >= 12 * 60 && endMin > 18 * 60) return 'afternoon';
  return 'ordinary';
}

function emptyHours(): HourBreakdown {
  return {
    ordinaryHours: 0,
    afternoonHours: 0,
    nightHours: 0,
    saturdayHours: 0,
    sundayHours: 0,
    publicHolidayHours: 0,
    missedMealOvertimeHours: 0,
    overtimeHours: 0,
    totalPaidHours: 0,
  };
}

/** The single per-hour multiplier that applies to this shift's non-overtime, non-missed-meal hours. */
export function categoryMultiplier(dayType: DayType, weekdayCategory: WeekdayShiftCategory | null, settings: PaySettings): number {
  if (dayType === 'saturday') return settings.multipliers.saturday;
  if (dayType === 'sunday') return settings.multipliers.sunday;
  if (dayType === 'publicHoliday') return settings.multipliers.publicHoliday;
  if (weekdayCategory === 'afternoon') return settings.multipliers.afternoonShift;
  if (weekdayCategory === 'night') return settings.multipliers.nightShift;
  return 1;
}

function categoryHours(hours: HourBreakdown): number {
  return hours.ordinaryHours + hours.afternoonHours + hours.nightHours + hours.saturdayHours + hours.sundayHours + hours.publicHolidayHours;
}

function setCategoryHours(hours: HourBreakdown, dayType: DayType, weekdayCategory: WeekdayShiftCategory | null, value: number): HourBreakdown {
  const next = { ...hours, ordinaryHours: 0, afternoonHours: 0, nightHours: 0, saturdayHours: 0, sundayHours: 0, publicHolidayHours: 0 };
  if (dayType === 'saturday') next.saturdayHours = value;
  else if (dayType === 'sunday') next.sundayHours = value;
  else if (dayType === 'publicHoliday') next.publicHolidayHours = value;
  else if (weekdayCategory === 'afternoon') next.afternoonHours = value;
  else if (weekdayCategory === 'night') next.nightHours = value;
  else next.ordinaryHours = value;
  return next;
}

/**
 * EBA cl.31.1: overtime is 150% for the first 2 hours then 200% beyond on Mon-Sat,
 * a flat 200% on Sunday, and a flat 250% on a public holiday. Applied fresh per shift.
 */
export function overtimeRatePay(hours: number, dayType: DayType, settings: PaySettings): number {
  if (hours <= 0) return 0;
  const rate = settings.baseHourlyRate;
  const ot = settings.overtime;
  if (dayType === 'sunday') return hours * rate * ot.sundayMultiplier;
  if (dayType === 'publicHoliday') return hours * rate * ot.publicHolidayMultiplier;
  const tier1Hours = Math.min(hours, ot.weekdaySaturdayTier1Hours);
  const tier2Hours = Math.max(0, hours - ot.weekdaySaturdayTier1Hours);
  return tier1Hours * rate * ot.weekdaySaturdayTier1Multiplier + tier2Hours * rate * ot.weekdaySaturdayTier2Multiplier;
}

function casualLoadingFactor(settings: PaySettings, isPenaltyRate: boolean): number {
  if (settings.employmentType !== 'casual') return 1;
  if (isPenaltyRate && !settings.applyCasualLoadingToPenalties) return 1;
  return 1 + settings.casualLoadingPercent / 100;
}

export function shiftVarianceMinutes(shift: ShiftEntry): number | null {
  if (!shift.expected || !shift.worked) return null;
  return blockPaidMinutes(shift.worked) - blockPaidMinutes(shift.expected);
}

/** Calculates a single shift (before any fortnight-level overtime reallocation). */
export function calculateShift(shift: ShiftEntry, settings: PaySettings): ShiftCalculation {
  const dayType = classifyDayType(shift.date, settings, shift.dayTypeOverride);

  const leaveHours = shift.leave?.hours ?? 0;
  let leavePay = 0;
  if (shift.leave) {
    if (shift.leave.type === 'annual') leavePay = leaveHours * settings.baseHourlyRate * (1 + settings.leave.annualLeaveLoadingPercent / 100);
    else if (shift.leave.type === 'personal' || shift.leave.type === 'other') leavePay = leaveHours * settings.baseHourlyRate;
    // unpaid leave: $0
  }
  const accrualLeaveHours = settings.leave.accrueOnLeaveHoursTaken && shift.leave && shift.leave.type !== 'unpaid' ? leaveHours : 0;

  if (shift.notWorked || !shift.worked) {
    return {
      shift,
      dayType,
      weekdayCategory: null,
      hours: emptyHours(),
      ordinaryPay: 0,
      overtimePay: 0,
      missedMealPay: 0,
      wagePay: 0,
      parkingDeduction: 0,
      leaveHours,
      leavePay,
      accrualHours: accrualLeaveHours,
      totalPay: leavePay,
      varianceMinutes: null,
    };
  }

  const weekdayCategory = dayType === 'weekday' ? classifyWeekdayShift(shift.worked) : null;
  const totalPaidMinutes = blockPaidMinutes(shift.worked);
  const totalPaidHours = minutesToHours(totalPaidMinutes);

  const missedMealHours = Math.min(Math.max(0, shift.missedMealHours || 0), totalPaidHours);
  let dayCategoryHours = round2(totalPaidHours - missedMealHours);

  // EBA cl.24.2: shifts longer than the daily threshold are overtime for the excess.
  let overtimeHours = 0;
  const dailyThreshold = settings.overtime.dailyThresholdHours;
  if (dailyThreshold != null && totalPaidHours > dailyThreshold) {
    overtimeHours = round2(Math.min(dayCategoryHours, totalPaidHours - dailyThreshold));
    dayCategoryHours = round2(dayCategoryHours - overtimeHours);
  }

  let hours = setCategoryHours(emptyHours(), dayType, weekdayCategory, dayCategoryHours);
  hours.missedMealOvertimeHours = missedMealHours;
  hours.overtimeHours = overtimeHours;
  hours.totalPaidHours = totalPaidHours;

  const mult = categoryMultiplier(dayType, weekdayCategory, settings);
  const isPenaltyCategory = mult !== 1;
  const ordinaryPay = dayCategoryHours * settings.baseHourlyRate * mult * casualLoadingFactor(settings, isPenaltyCategory);
  const missedMealPay = overtimeRatePay(missedMealHours, dayType, settings) * casualLoadingFactor(settings, true);
  const overtimePay = overtimeRatePay(overtimeHours, dayType, settings) * casualLoadingFactor(settings, true);

  const parkingDeduction = shift.parkingCharged ? shift.parkingAmount : 0;
  const accrualHours = round2(dayCategoryHours + missedMealHours + accrualLeaveHours);

  return {
    shift,
    dayType,
    weekdayCategory,
    hours,
    ordinaryPay: round2(ordinaryPay),
    overtimePay: round2(overtimePay),
    missedMealPay: round2(missedMealPay),
    wagePay: round2(ordinaryPay + overtimePay + missedMealPay),
    parkingDeduction,
    leaveHours,
    leavePay: round2(leavePay),
    accrualHours,
    totalPay: round2(ordinaryPay + overtimePay + missedMealPay + leavePay),
    varianceMinutes: shiftVarianceMinutes(shift),
  };
}

/**
 * Second pass: EBA cl.24.1 also caps ordinary hours at 76/fortnight. Once all shifts in a
 * fortnight are calculated, reallocate any hours above that cap (taken from the
 * chronologically-last shifts) from their day-type category into overtime.
 */
export function applyFortnightOvertime(calcs: ShiftCalculation[], settings: PaySettings): ShiftCalculation[] {
  const threshold = settings.overtime.fortnightThresholdHours;
  if (threshold == null) return calcs;

  const nonOvertimeTotal = calcs.reduce((sum, c) => sum + categoryHours(c.hours), 0);
  let excess = round2(nonOvertimeTotal - threshold);
  if (excess <= 0) return calcs;

  const sorted = [...calcs].sort((a, b) => (a.shift.date < b.shift.date ? 1 : -1));
  const takeMap = new Map<string, number>();
  for (const c of sorted) {
    if (excess <= 0) break;
    const available = categoryHours(c.hours);
    const take = round2(Math.min(excess, available));
    if (take > 0) {
      takeMap.set(c.shift.id, take);
      excess = round2(excess - take);
    }
  }

  return calcs.map((c) => {
    const take = takeMap.get(c.shift.id) ?? 0;
    if (take <= 0) return c;

    const mult = categoryMultiplier(c.dayType, c.weekdayCategory, settings);
    const isPenaltyCategory = mult !== 1;
    const removedOrdinaryPay = take * settings.baseHourlyRate * mult * casualLoadingFactor(settings, isPenaltyCategory);

    const newCategoryHours = round2(categoryHours(c.hours) - take);
    const newOvertimeHours = round2(c.hours.overtimeHours + take);
    const hours = setCategoryHours(c.hours, c.dayType, c.weekdayCategory, newCategoryHours);
    hours.missedMealOvertimeHours = c.hours.missedMealOvertimeHours;
    hours.overtimeHours = newOvertimeHours;
    hours.totalPaidHours = c.hours.totalPaidHours;

    const newOvertimePay = round2(overtimeRatePay(newOvertimeHours, c.dayType, settings) * casualLoadingFactor(settings, true));
    const ordinaryPay = round2(c.ordinaryPay - removedOrdinaryPay);
    const accrualHours = round2(c.accrualHours - take);

    return {
      ...c,
      hours,
      ordinaryPay,
      overtimePay: newOvertimePay,
      wagePay: round2(ordinaryPay + newOvertimePay + c.missedMealPay),
      accrualHours,
      totalPay: round2(ordinaryPay + newOvertimePay + c.missedMealPay + c.leavePay),
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
