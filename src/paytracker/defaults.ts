import { PaySettings, PayTrackerData, RosterDay } from './types';

function defaultRosterDay(): RosterDay {
  return {
    enabled: false,
    start: '09:00',
    end: '17:00',
    breakMinutes: 30,
    paidBreak: false,
    parkingPaid: false,
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
  '2025-04-21', // Easter Monday
  '2025-04-25', // Anzac Day
  '2025-12-25', // Christmas Day
  '2025-12-26', // Boxing Day
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-04-03', // Good Friday
  '2026-04-04', // Easter Saturday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Saturday)
  '2026-12-25', // Christmas Day
  '2026-12-28', // Boxing Day (observed)
];

export function defaultSettings(): PaySettings {
  return {
    employmentType: 'permanent',
    baseHourlyRate: 35,
    casualLoadingPercent: 25,
    applyCasualLoadingToPenalties: false,
    multipliers: {
      saturday: 1.25,
      sunday: 1.5,
      publicHoliday: 2.5,
      evening: 1.125,
    },
    eveningStartTime: '18:00',
    overtime: {
      dailyThresholdHours: 10,
      dailyMultiplier: 1.5,
      fortnightThresholdHours: 76,
      fortnightMultiplier: 1.5,
    },
    mealBreak: {
      defaultMinutes: 30,
      paidByDefault: false,
    },
    parking: {
      defaultAmount: 0,
    },
    leave: {
      // NES defaults: 4 weeks annual leave/yr = 4/52 hours accrued per hour worked;
      // 10 days personal leave/yr = 2/52 hours accrued per hour worked.
      annualAccrualHoursPerHourWorked: 4 / 52,
      personalAccrualHoursPerHourWorked: 2 / 52,
      openingAnnualBalanceHours: 0,
      openingPersonalBalanceHours: 0,
      openingBalanceAsOfDate: new Date().toISOString().slice(0, 10),
      accrueOnLeaveHours: false,
    },
    payCycleAnchorDate: '2025-01-06',
    publicHolidays: DEFAULT_PUBLIC_HOLIDAYS,
    roster: defaultRoster(),
  };
}

export function emptyData(): PayTrackerData {
  return {
    version: 1,
    settings: defaultSettings(),
    shifts: [],
    payslips: [],
  };
}
