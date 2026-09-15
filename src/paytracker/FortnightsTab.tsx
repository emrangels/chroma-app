import React, { useMemo, useState } from 'react';
import { applyFortnightOvertime, calculateShift, dateToISO, getFortnightPeriod, parseISODate } from './calculations';
import { downloadCSV } from './storage';
import { PaySettings, PayslipRecord, ShiftEntry } from './types';
import { dayTypeLabel, formatDateLabel, formatHours, formatMoney, newId } from './utils';

interface Props {
  shifts: ShiftEntry[];
  settings: PaySettings;
  payslips: PayslipRecord[];
  onSavePayslip: (record: PayslipRecord) => void;
}

export default function FortnightsTab({ shifts, settings, payslips, onSavePayslip }: Props) {
  const currentPeriod = useMemo(() => getFortnightPeriod(dateToISO(new Date()), settings.payCycleAnchorDate), [settings.payCycleAnchorDate]);
  const [periodIndex, setPeriodIndex] = useState(currentPeriod.index);

  const period = useMemo(() => {
    const anchor = parseISODate(settings.payCycleAnchorDate);
    const start = new Date(anchor.getTime() + periodIndex * 14 * 86400000);
    const end = new Date(start.getTime() + 13 * 86400000);
    return { index: periodIndex, start: dateToISO(start), end: dateToISO(end) };
  }, [periodIndex, settings.payCycleAnchorDate]);

  const periodShifts = useMemo(
    () => shifts.filter((s) => s.date >= period.start && s.date <= period.end).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [shifts, period]
  );

  const calcs = useMemo(() => {
    const raw = periodShifts.map((s) => calculateShift(s, settings));
    return applyFortnightOvertime(raw, settings);
  }, [periodShifts, settings]);

  const totals = useMemo(() => {
    return calcs.reduce(
      (acc, c) => ({
        ordinary: acc.ordinary + c.hours.ordinaryHours,
        evening: acc.evening + c.hours.eveningHours,
        saturday: acc.saturday + c.hours.saturdayHours,
        sunday: acc.sunday + c.hours.sundayHours,
        publicHoliday: acc.publicHoliday + c.hours.publicHolidayHours,
        overtime: acc.overtime + c.hours.dailyOvertimeHours + c.hours.fortnightOvertimeHours,
        totalPaidHours: acc.totalPaidHours + c.hours.totalPaidHours,
        leaveHours: acc.leaveHours + c.leaveHours,
        wagePay: acc.wagePay + c.wagePay,
        allowancePay: acc.allowancePay + c.allowancePay,
        leavePay: acc.leavePay + c.leavePay,
        totalPay: acc.totalPay + c.totalPay,
      }),
      { ordinary: 0, evening: 0, saturday: 0, sunday: 0, publicHoliday: 0, overtime: 0, totalPaidHours: 0, leaveHours: 0, wagePay: 0, allowancePay: 0, leavePay: 0, totalPay: 0 }
    );
  }, [calcs]);

  const payslip = payslips.find((p) => p.periodStart === period.start) ?? null;
  const [actualPay, setActualPay] = useState<string>(payslip?.actualGrossPay != null ? String(payslip.actualGrossPay) : '');

  React.useEffect(() => {
    setActualPay(payslip?.actualGrossPay != null ? String(payslip.actualGrossPay) : '');
  }, [payslip, period.start]);

  const variance = payslip?.actualGrossPay != null ? payslip.actualGrossPay - totals.totalPay : null;

  function savePayslipAmount() {
    const amount = actualPay === '' ? null : Number(actualPay);
    onSavePayslip({
      id: payslip?.id ?? newId(),
      periodStart: period.start,
      actualGrossPay: amount,
      actualAnnualLeaveBalance: payslip?.actualAnnualLeaveBalance ?? null,
      actualPersonalLeaveBalance: payslip?.actualPersonalLeaveBalance ?? null,
      notes: payslip?.notes ?? '',
    });
  }

  function exportCSV() {
    const header = ['Date', 'Day type', 'Expected', 'Worked', 'Paid hours', 'Leave', 'Parking', 'Total pay'];
    const rows = calcs.map((c) => [
      c.shift.date,
      dayTypeLabel(c.dayType),
      c.shift.expected ? `${c.shift.expected.start}-${c.shift.expected.end}` : '',
      c.shift.worked ? `${c.shift.worked.start}-${c.shift.worked.end}` : 'Not worked',
      c.hours.totalPaidHours.toString(),
      c.shift.leave ? `${c.shift.leave.hours}h ${c.shift.leave.type}` : '',
      c.shift.parkingPaid ? c.shift.parkingAmount.toString() : '',
      c.totalPay.toFixed(2),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCSV(csv, `fortnight-${period.start}.csv`);
  }

  return (
    <div>
      <div className="pt-card">
        <div className="pt-fortnight-nav">
          <button className="pt-btn pt-btn-secondary pt-btn-sm" onClick={() => setPeriodIndex((i) => i - 1)}>← Prev</button>
          <div className="range">
            {formatDateLabel(period.start)} – {formatDateLabel(period.end)}
            {period.index === currentPeriod.index && <div className="pt-badge pt-badge-ok" style={{ marginTop: 4 }}>Current</div>}
          </div>
          <button className="pt-btn pt-btn-secondary pt-btn-sm" onClick={() => setPeriodIndex((i) => i + 1)}>Next →</button>
        </div>

        <div className="pt-grid">
          <div className="pt-stat"><div className="label">Paid hours</div><div className="value">{formatHours(totals.totalPaidHours)}</div></div>
          <div className="pt-stat"><div className="label">Leave hours</div><div className="value">{formatHours(totals.leaveHours)}</div></div>
          <div className="pt-stat"><div className="label">Overtime</div><div className="value">{formatHours(totals.overtime)}</div></div>
          <div className="pt-stat"><div className="label">Est. gross pay</div><div className="value">{formatMoney(totals.totalPay)}</div></div>
        </div>
      </div>

      <div className="pt-card">
        <h2>Breakdown</h2>
        <div className="pt-row"><span>Ordinary hours</span><span>{formatHours(totals.ordinary)}</span></div>
        <div className="pt-row"><span>Evening hours</span><span>{formatHours(totals.evening)}</span></div>
        <div className="pt-row"><span>Saturday hours</span><span>{formatHours(totals.saturday)}</span></div>
        <div className="pt-row"><span>Sunday hours</span><span>{formatHours(totals.sunday)}</span></div>
        <div className="pt-row"><span>Public holiday hours</span><span>{formatHours(totals.publicHoliday)}</span></div>
        <div className="pt-row"><span>Wages (incl. OT premium)</span><span>{formatMoney(totals.wagePay)}</span></div>
        <div className="pt-row"><span>Allowances (parking etc.)</span><span>{formatMoney(totals.allowancePay)}</span></div>
        <div className="pt-row"><span>Leave paid</span><span>{formatMoney(totals.leavePay)}</span></div>
        <div className="pt-row"><strong>Total estimated gross</strong><strong>{formatMoney(totals.totalPay)}</strong></div>
      </div>

      <div className="pt-card">
        <h2>Compare against your payslip</h2>
        <div className="pt-field">
          <label>Actual gross pay from payslip ($)</label>
          <input type="number" step="0.01" value={actualPay} onChange={(e) => setActualPay(e.target.value)} onBlur={savePayslipAmount} placeholder="e.g. 2450.30" />
        </div>
        {variance != null && (
          <div className={Math.abs(variance) < 1 ? 'pt-inline-note' : 'pt-inline-note'} style={{ background: Math.abs(variance) < 1 ? '#dcfce7' : '#fdeceb', color: Math.abs(variance) < 1 ? '#166534' : '#b42318' }}>
            {Math.abs(variance) < 1
              ? 'Matches your estimate — looks correct.'
              : `Payslip is ${variance > 0 ? formatMoney(variance) + ' more' : formatMoney(-variance) + ' less'} than estimated. Worth checking your payslip line items against the breakdown above.`}
          </div>
        )}
        <button className="pt-btn pt-btn-secondary" onClick={exportCSV}>Export this fortnight as CSV</button>
      </div>

      <div className="pt-card">
        <h2>Shifts this fortnight</h2>
        {calcs.length === 0 && <div className="pt-empty">No shifts logged in this period yet.</div>}
        {calcs.map((c) => (
          <div key={c.shift.id} className="pt-row">
            <span>{formatDateLabel(c.shift.date)} <span className={`pt-badge pt-badge-${c.dayType}`}>{dayTypeLabel(c.dayType)}</span></span>
            <span>{formatHours(c.hours.totalPaidHours)} · {formatMoney(c.totalPay)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
