export type DayType = 'weekday' | 'saturday' | 'sunday' | 'publicHoliday';

export type LeaveType = 'annual' | 'personal' | 'unpaid' | 'other';

export type WeekdayShiftCategory = 'ordinary' | 'afternoon' | 'night';

export interface TimeBlock {
  start: string; // "09:00"
  end: string; // "17:00" (may be past midnight conceptually, but we assume same-day shifts)
  breakMinutes: number;
  paidBreak: boolean;
}

export interface RosterDay {
  enabled: boolean;
  start: string;
  end: string;
  breakMinutes: number;
  paidBreak: boolean;
  parkingCharged: boolean;
  parkingAmount: number;
}

export interface OvertimeRules {
  dailyThresholdHours: number | null;
  fortnightThresholdHours: number | null;
  weekdaySaturdayTier1Multiplier: number; // first block of OT, Mon-Sat
  weekdaySaturdayTier1Hours: number; // size of that first block, e.g. 2 hours
  weekdaySaturdayTier2Multiplier: number; // OT beyond the first block, Mon-Sat
  sundayMultiplier: number; // flat OT rate on Sunday
  publicHolidayMultiplier: number; // flat OT rate on a public holiday
}

export interface LeaveSettings {
  annualAccrualHoursPerHourWorked: number;
  personalAccrualHoursPerHourWorked: number;
  annualLeaveLoadingPercent: number;
  openingAnnualBalanceHours: number;
  openingPersonalBalanceHours: number;
  openingBalanceAsOfDate: string; // ISO date
  accrueOnLeaveHoursTaken: boolean;
}

export interface PaySettings {
  employmentType: 'casual' | 'permanent';
  baseHourlyRate: number;
  casualLoadingPercent: number;
  applyCasualLoadingToPenalties: boolean;
  multipliers: {
    saturday: number;
    sunday: number;
    publicHoliday: number;
    afternoonShift: number;
    nightShift: number;
  };
  /** Afternoon/night shift loadings only apply Mon-Fri; disable by setting both to 1. */
  overtime: OvertimeRules;
  mealBreak: {
    defaultMinutes: number;
    paidByDefault: boolean;
  };
  parking: {
    defaultAmount: number;
  };
  leave: LeaveSettings;
  payCycleAnchorDate: string; // ISO date known to be the FIRST day of a fortnight
  publicHolidays: string[]; // ISO dates
  roster: RosterDay[]; // length 7, index 0 = Sunday .. 6 = Saturday (matches Date.getDay())
}

export interface ShiftEntry {
  id: string;
  date: string; // ISO yyyy-mm-dd
  usedTemplate: boolean;
  dayTypeOverride: DayType | null;
  notWorked: boolean;
  expected: TimeBlock | null;
  worked: TimeBlock | null;
  /** Hours worked through/instead of an unpaid meal break because the employee wasn't released (EBA cl.30.2) */
  missedMealHours: number;
  leave: { type: LeaveType; hours: number } | null;
  parkingCharged: boolean;
  parkingAmount: number;
  notes: string;
}

export interface PayTrackerData {
  version: number;
  settings: PaySettings;
  shifts: ShiftEntry[];
  payslips: PayslipRecord[];
}

export interface PayslipRecord {
  id: string;
  periodStart: string; // ISO date, start of fortnight
  actualGrossPay: number | null;
  actualAnnualLeaveBalance: number | null;
  actualPersonalLeaveBalance: number | null;
  notes: string;
}

export interface HourBreakdown {
  ordinaryHours: number;
  afternoonHours: number;
  nightHours: number;
  saturdayHours: number;
  sundayHours: number;
  publicHolidayHours: number;
  /** Hours worked through a meal break without release, paid at the OT rate but still "ordinary hours" for leave accrual. */
  missedMealOvertimeHours: number;
  /** Hours in excess of the daily/fortnightly ordinary-hours cap, paid at the OT rate and excluded from leave accrual. */
  overtimeHours: number;
  totalPaidHours: number;
}

export interface ShiftCalculation {
  shift: ShiftEntry;
  dayType: DayType;
  weekdayCategory: WeekdayShiftCategory | null;
  hours: HourBreakdown;
  ordinaryPay: number;
  overtimePay: number;
  missedMealPay: number;
  wagePay: number;
  parkingDeduction: number;
  leaveHours: number;
  leavePay: number;
  /** Hours counted toward leave accrual from this shift (excludes true overtime hours). */
  accrualHours: number;
  totalPay: number;
  varianceMinutes: number | null; // difference between expected and worked, if both present
}
