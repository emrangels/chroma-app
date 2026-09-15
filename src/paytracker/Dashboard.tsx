import React, { useMemo } from 'react';
import { applyFortnightOvertime, calculateShift, dateToISO, getFortnightPeriod } from './calculations';
import { buildLeaveLedger } from './leaveLedger';
import { PaySettings, ShiftEntry } from './types';
import { dayTypeLabel, formatDateLabel, formatHours, formatMoney } from './utils';

interface Props {
  shifts: ShiftEntry[];
  settings: PaySettings;
  onQuickAddToday: () => void;
}

export default function Dashboard({ shifts, settings, onQuickAddToday }: Props) {
  const todayIso = dateToISO(new Date());
  const period = useMemo(() => getFortnightPeriod(todayIso, settings.payCycleAnchorDate), [todayIso, settings.payCycleAnchorDate]);

  const periodShifts = useMemo(
    () => shifts.filter((s) => s.date >= period.start && s.date <= period.end),
    [shifts, period]
  );

  const calcs = useMemo(() => applyFortnightOvertime(periodShifts.map((s) => calculateShift(s, settings)), settings), [periodShifts, settings]);

  const totals = useMemo(
    () => calcs.reduce((acc, c) => ({ hours: acc.hours + c.hours.totalPaidHours, pay: acc.pay + c.totalPay }), { hours: 0, pay: 0 }),
    [calcs]
  );

  const ledger = useMemo(() => buildLeaveLedger(shifts, settings), [shifts, settings]);
  const latestLeave = ledger[ledger.length - 1];

  const todayShift = shifts.find((s) => s.date === todayIso);

  const recentVariances = useMemo(() => {
    const cutoff = dateToISO(new Date(Date.now() - 30 * 86400000));
    return shifts
      .filter((s) => s.date >= cutoff)
      .map((s) => ({ shift: s, calc: calculateShift(s, settings) }))
      .filter(({ calc }) => calc.varianceMinutes != null && Math.abs(calc.varianceMinutes) >= 10)
      .sort((a, b) => (a.shift.date < b.shift.date ? 1 : -1))
      .slice(0, 5);
  }, [shifts, settings]);

  return (
    <div>
      {!todayShift && (
        <button className="pt-btn pt-btn-primary pt-btn-block" onClick={onQuickAddToday}>+ Log today's shift</button>
      )}

      <div className="pt-card" style={{ marginTop: todayShift ? 0 : 14 }}>
        <h2>This fortnight ({formatDateLabel(period.start)} – {formatDateLabel(period.end)})</h2>
        <div className="pt-grid">
          <div className="pt-stat">
            <div className="label">Hours so far</div>
            <div className="value">{formatHours(totals.hours)}</div>
          </div>
          <div className="pt-stat">
            <div className="label">Est. pay so far</div>
            <div className="value">{formatMoney(totals.pay)}</div>
          </div>
        </div>
      </div>

      <div className="pt-card">
        <h2>Leave balances</h2>
        <div className="pt-grid">
          <div className="pt-stat">
            <div className="label">Annual leave</div>
            <div className="value">{latestLeave ? formatHours(latestLeave.annualBalance) : formatHours(settings.leave.openingAnnualBalanceHours)}</div>
          </div>
          <div className="pt-stat">
            <div className="label">Personal / sick</div>
            <div className="value">{latestLeave ? formatHours(latestLeave.personalBalance) : formatHours(settings.leave.openingPersonalBalanceHours)}</div>
          </div>
        </div>
      </div>

      {recentVariances.length > 0 && (
        <div className="pt-card">
          <h2>Worth checking</h2>
          <div className="pt-helptext" style={{ marginTop: -4 }}>Shifts in the last 30 days where actual hours differed from expected by 10+ minutes.</div>
          {recentVariances.map(({ shift, calc }) => (
            <div key={shift.id} className="pt-row">
              <span>{formatDateLabel(shift.date)} <span className={`pt-badge pt-badge-${calc.dayType}`}>{dayTypeLabel(calc.dayType)}</span></span>
              <span className={calc.varianceMinutes! > 0 ? 'pt-variance-pos' : 'pt-variance-neg'}>
                {calc.varianceMinutes! > 0 ? '+' : ''}{calc.varianceMinutes} min
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="pt-card">
        <h2>Recent shifts</h2>
        {[...shifts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5).map((s) => {
          const calc = calculateShift(s, settings);
          return (
            <div key={s.id} className="pt-row">
              <span>{formatDateLabel(s.date)}</span>
              <span>{formatHours(calc.hours.totalPaidHours)} · {formatMoney(calc.totalPay)}</span>
            </div>
          );
        })}
        {shifts.length === 0 && <div className="pt-empty">No shifts logged yet.</div>}
      </div>
    </div>
  );
}
