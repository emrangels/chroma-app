import { PaySettings, ShiftEntry } from './types';
import { calculateShift, dateToISO, FortnightPeriod, getFortnightPeriod, parseISODate } from './calculations';

export interface LeavePeriodLedger {
  period: FortnightPeriod;
  hoursForAccrual: number;
  annualAccrued: number;
  annualTaken: number;
  annualBalance: number;
  personalAccrued: number;
  personalTaken: number;
  personalBalance: number;
  otherLeaveTaken: number;
  unpaidLeaveHours: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function periodForIndex(index: number, anchorIso: string): FortnightPeriod {
  const anchor = parseISODate(anchorIso);
  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(anchor.getTime() + index * 14 * dayMs);
  const end = new Date(start.getTime() + 13 * dayMs);
  return { index, start: dateToISO(start), end: dateToISO(end) };
}

/**
 * Builds a running fortnight-by-fortnight leave ledger from the opening balance
 * date through to the latest shift (or today, whichever is later).
 */
export function buildLeaveLedger(shifts: ShiftEntry[], settings: PaySettings): LeavePeriodLedger[] {
  const anchor = settings.payCycleAnchorDate;
  const openingPeriod = getFortnightPeriod(settings.leave.openingBalanceAsOfDate, anchor);

  const todayIso = dateToISO(new Date());
  const latestShiftDate = shifts.reduce((max, s) => (s.date > max ? s.date : max), todayIso);
  const endPeriod = getFortnightPeriod(latestShiftDate, anchor);

  const byPeriodIndex = new Map<number, ShiftEntry[]>();
  for (const shift of shifts) {
    const p = getFortnightPeriod(shift.date, anchor);
    if (!byPeriodIndex.has(p.index)) byPeriodIndex.set(p.index, []);
    byPeriodIndex.get(p.index)!.push(shift);
  }

  const ledger: LeavePeriodLedger[] = [];
  let annualBalance = settings.leave.openingAnnualBalanceHours;
  let personalBalance = settings.leave.openingPersonalBalanceHours;

  const startIndex = Math.min(openingPeriod.index, endPeriod.index);
  const finishIndex = Math.max(openingPeriod.index, endPeriod.index);

  for (let idx = startIndex; idx <= finishIndex; idx++) {
    const periodShifts = byPeriodIndex.get(idx) ?? [];
    const period = periodForIndex(idx, anchor);

    let hoursForAccrual = 0;
    let annualTaken = 0;
    let personalTaken = 0;
    let otherLeaveTaken = 0;
    let unpaidLeaveHours = 0;

    for (const shift of periodShifts) {
      const calc = calculateShift(shift, settings);
      hoursForAccrual += calc.hours.totalPaidHours;
      if (shift.leave) {
        if (settings.leave.accrueOnLeaveHours && shift.leave.type !== 'unpaid') {
          hoursForAccrual += shift.leave.hours;
        }
        if (shift.leave.type === 'annual') annualTaken += shift.leave.hours;
        else if (shift.leave.type === 'personal') personalTaken += shift.leave.hours;
        else if (shift.leave.type === 'unpaid') unpaidLeaveHours += shift.leave.hours;
        else otherLeaveTaken += shift.leave.hours;
      }
    }

    // Only start accruing/deducting from the period that actually contains the opening date.
    if (idx >= openingPeriod.index) {
      const annualAccrued = hoursForAccrual * settings.leave.annualAccrualHoursPerHourWorked;
      const personalAccrued = hoursForAccrual * settings.leave.personalAccrualHoursPerHourWorked;

      annualBalance = annualBalance + annualAccrued - annualTaken;
      personalBalance = personalBalance + personalAccrued - personalTaken;

      ledger.push({
        period,
        hoursForAccrual: round2(hoursForAccrual),
        annualAccrued: round2(annualAccrued),
        annualTaken: round2(annualTaken),
        annualBalance: round2(annualBalance),
        personalAccrued: round2(personalAccrued),
        personalTaken: round2(personalTaken),
        personalBalance: round2(personalBalance),
        otherLeaveTaken: round2(otherLeaveTaken),
        unpaidLeaveHours: round2(unpaidLeaveHours),
      });
    }
  }

  return ledger;
}
