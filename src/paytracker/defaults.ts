import { PaySettings, PayTrackerData, RosterDay } from './types';

function defaultRosterDay(): RosterDay {
  return {
    enabled: false,
    start: '09:00',
    end: '17:00',
    breakMinutes: 30,
    paidBreak: false,
    parkingCharged: false,
    parkingAmount: 0,
  };
}

// Index 0 = Sunday ... 6 = Saturday, matching Date.getDay()
export function defaultRoster(): RosterDay[] {
  return Array.from({ length: 7 }, () => defaultRosterDay());
}

// A small starter set of Australian national public holidays. State-specific
// days (Labour Day, King's Birthday, Melbourne Cup, etc.) vary and should be
// added/removed in Settings to match your state and EBA.
export const DEFAULT_PUBLIC_HOLIDAYS: string[] = [
  '2025-01-01', // New Year's Day
  '2025-01-27', // Australia Day (observed)
  '2025-04-18', // Good Friday
  '2025-04-19', // Easter Saturday
  '2025-04-20', // Easter Sunday
  '2025-04-21', // Easter Monday
  '2025-04-25', // Anzac Day
  '2025-12-25', // Christmas Day
  '2025-12-26', // Boxing Day
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-04-03', // Good Friday
  '2026-04-04', // Easter Saturday
  '2026-04-05', // Easter Sunday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Saturday)
  '2026-12-25', // Christmas Day
  '2026-12-28', // Boxing Day (observed)
];

/**
 * Defaults are set to the Eastwood Private Hospital Enterprise Agreement 2025
 * (clauses 24, 29, 31, 32, 34, 35, 37) as confirmed against real payslips.
 * Everything below is still editable in Settings.
 */
export function defaultSettings(): PaySettings {
  return {
    employmentType: 'permanent',
    baseHourlyRate: 51.38,
    casualLoadingPercent: 25,
    applyCasualLoadingToPenalties: false,
    multipliers: {
      saturday: 1.5, // EBA cl.29.1
      sunday: 1.75, // EBA cl.29.2
      publicHoliday: 2.0, // EBA cl.35.1(a) — ordinary hours worked on a public holiday
      afternoonShift: 1.125, // EBA cl.32.2 — shift starts >=12pm and finishes after 6pm, Mon-Fri
      nightShift: 1.15, // EBA cl.32.3 — shift starts >=6pm and finishes before 7:30am, Mon-Fri
    },
    overtime: {
      dailyThresholdHours: 10, // EBA cl.24.2 — max ordinary hours per shift
      fortnightThresholdHours: 76, // EBA cl.24.1
      weekdaySaturdayTier1Multiplier: 1.5, // EBA cl.31.1(a)(i) — first 2 hours, Mon-Sat
      weekdaySaturdayTier1Hours: 2,
      weekdaySaturdayTier2Multiplier: 2.0, // EBA cl.31.1(a)(i) — beyond 2 hours, Mon-Sat
      sundayMultiplier: 2.0, // EBA cl.31.1(a)(ii)
      publicHolidayMultiplier: 2.5, // EBA cl.31.1(a)(iii)
    },
    mealBreak: {
      defaultMinutes: 30,
      paidByDefault: false,
    },
    parking: {
      defaultAmount: 0,
    },
    leave: {
      // EBA cl.34.1: 5 weeks/yr (190h) for a day worker, 6 weeks/yr (228h) for a shiftworker
      // (rostered 7 days/wk and regularly works weekends) — change to 6/52 if that applies to you.
      annualAccrualHoursPerHourWorked: 5 / 52,
      // EBA cl.37.1: 10 days personal/carer's leave per year.
      personalAccrualHoursPerHourWorked: 2 / 52,
      annualLeaveLoadingPercent: 17.5, // EBA cl.34.5
      openingAnnualBalanceHours: 0,
      openingPersonalBalanceHours: 0,
      openingBalanceAsOfDate: new Date().toISOString().slice(0, 10),
      // EBA cl.34.1(c)/NES: leave accrues on ordinary hours, which includes hours
      // paid while on leave — confirmed against real payslip accrual figures.
      accrueOnLeaveHoursTaken: true,
    },
    payCycleAnchorDate: '2025-01-06',
    publicHolidays: DEFAULT_PUBLIC_HOLIDAYS,
    roster: defaultRoster(),
  };
}

export function emptyData(): PayTrackerData {
  return {
    version: 2,
    settings: defaultSettings(),
    shifts: [],
    payslips: [],
  };
}
