export type DayType = 'weekday' | 'saturday' | 'sunday' | 'publicHoliday';

export type LeaveType = 'annual' | 'personal' | 'unpaid' | 'other';

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
  parkingPaid: boolean;
  parkingAmount: number;
}

export interface OvertimeRules {
  dailyThresholdHours: number | null;
  dailyMultiplier: number;
  fortnightThresholdHours: number | null;
  fortnightMultiplier: number;
}

export interface LeaveSettings {
  annualAccrualHoursPerHourWorked: number;
  personalAccrualHoursPerHourWorked: number;
  openingAnnualBalanceHours: number;
  openingPersonalBalanceHours: number;
  openingBalanceAsOfDate: string; // ISO date
  accrueOnLeaveHours: boolean;
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
    evening: number;
  };
  eveningStartTime: string | null; // e.g. "18:00", null disables evening rate
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
  leave: { type: LeaveType; hours: number } | null;
  parkingPaid: boolean;
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
  eveningHours: number;
  saturdayHours: number;
  sundayHours: number;
  publicHolidayHours: number;
  /** Subset of the hours above that exceed the daily OT threshold (informational, used to add an OT premium). */
  dailyOvertimeHours: number;
  /** Subset of hours in this shift attributed to fortnightly OT once the fortnight threshold is crossed. */
  fortnightOvertimeHours: number;
  totalPaidHours: number;
}

export interface ShiftCalculation {
  shift: ShiftEntry;
  dayType: DayType;
  hours: HourBreakdown;
  basePay: number;
  overtimePremiumPay: number;
  wagePay: number;
  allowancePay: number;
  totalPay: number;
  leaveHours: number;
  leavePay: number;
  varianceMinutes: number | null; // difference between expected and worked, if both present
}
