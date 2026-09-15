import React, { useMemo, useRef, useState } from 'react';
import { applyFortnightOvertime, calculateShift, dateToISO, getFortnightPeriod, parseISODate } from './calculations';
import { recognizePayslipImage } from './payslipOcr';
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
        afternoon: acc.afternoon + c.hours.afternoonHours,
        night: acc.night + c.hours.nightHours,
        saturday: acc.saturday + c.hours.saturdayHours,
        sunday: acc.sunday + c.hours.sundayHours,
        publicHoliday: acc.publicHoliday + c.hours.publicHolidayHours,
        missedMeal: acc.missedMeal + c.hours.missedMealOvertimeHours,
        overtime: acc.overtime + c.hours.overtimeHours,
        totalPaidHours: acc.totalPaidHours + c.hours.totalPaidHours,
        leaveHours: acc.leaveHours + c.leaveHours,
        ordinaryPay: acc.ordinaryPay + c.ordinaryPay,
        overtimePay: acc.overtimePay + c.overtimePay,
        missedMealPay: acc.missedMealPay + c.missedMealPay,
        leavePay: acc.leavePay + c.leavePay,
        parkingDeduction: acc.parkingDeduction + c.parkingDeduction,
        totalPay: acc.totalPay + c.totalPay,
      }),
      {
        ordinary: 0, afternoon: 0, night: 0, saturday: 0, sunday: 0, publicHoliday: 0, missedMeal: 0, overtime: 0,
        totalPaidHours: 0, leaveHours: 0, ordinaryPay: 0, overtimePay: 0, missedMealPay: 0, leavePay: 0, parkingDeduction: 0, totalPay: 0,
      }
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

  const [ocrStatus, setOcrStatus] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [ocrMessage, setOcrMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePayslipUpload(file: File) {
    setOcrStatus('reading');
    setOcrMessage('Reading payslip…');
    try {
      const parsed = await recognizePayslipImage(file);
      if (parsed.grossPay == null && parsed.periodStart == null) {
        setOcrStatus('error');
        setOcrMessage("Couldn't read this clearly — try a clearer photo, or enter the gross pay manually below.");
        return;
      }

      const targetPeriodStart = parsed.periodStart ?? period.start;
      const existing = payslips.find((p) => p.periodStart === targetPeriodStart) ?? null;
      onSavePayslip({
        id: existing?.id ?? newId(),
        periodStart: targetPeriodStart,
        actualGrossPay: parsed.grossPay,
        actualAnnualLeaveBalance: existing?.actualAnnualLeaveBalance ?? null,
        actualPersonalLeaveBalance: existing?.actualPersonalLeaveBalance ?? null,
        notes: existing?.notes ?? '',
      });

      if (parsed.periodStart) {
        setPeriodIndex(getFortnightPeriod(parsed.periodStart, settings.payCycleAnchorDate).index);
      }

      setOcrStatus('done');
      const periodText = parsed.periodStart && parsed.periodEnd ? `${formatDateLabel(parsed.periodStart)} – ${formatDateLabel(parsed.periodEnd)}` : "this fortnight (couldn't read the period dates)";
      const grossText = parsed.grossPay != null ? formatMoney(parsed.grossPay) : "couldn't read the gross pay";
      setOcrMessage(`Read payslip for ${periodText}: gross pay ${grossText}.`);
    } catch {
      setOcrStatus('error');
      setOcrMessage("Something went wrong reading that image — enter the gross pay manually below.");
    }
  }

  function exportCSV() {
    const header = ['Date', 'Day type', 'Expected', 'Worked', 'Paid hours', 'Missed meal hrs', 'OT hrs', 'Leave', 'Parking charge', 'Gross pay'];
    const rows = calcs.map((c) => [
      c.shift.date,
      dayTypeLabel(c.dayType),
      c.shift.expected ? `${c.shift.expected.start}-${c.shift.expected.end}` : '',
      c.shift.worked ? `${c.shift.worked.start}-${c.shift.worked.end}` : 'Not worked',
      c.hours.totalPaidHours.toString(),
      c.hours.missedMealOvertimeHours.toString(),
      c.hours.overtimeHours.toString(),
      c.shift.leave ? `${c.shift.leave.hours}h ${c.shift.leave.type}` : '',
      c.shift.parkingCharged ? c.shift.parkingAmount.toString() : '',
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
        <div className="pt-row"><span>Afternoon shift hours</span><span>{formatHours(totals.afternoon)}</span></div>
        <div className="pt-row"><span>Night shift hours</span><span>{formatHours(totals.night)}</span></div>
        <div className="pt-row"><span>Saturday hours</span><span>{formatHours(totals.saturday)}</span></div>
        <div className="pt-row"><span>Sunday hours</span><span>{formatHours(totals.sunday)}</span></div>
        <div className="pt-row"><span>Public holiday hours</span><span>{formatHours(totals.publicHoliday)}</span></div>
        <div className="pt-row"><span>Missed meal break hours</span><span>{formatHours(totals.missedMeal)}</span></div>
        <div className="pt-row"><span>Overtime hours</span><span>{formatHours(totals.overtime)}</span></div>
        <div className="pt-divider" />
        <div className="pt-row"><span>Ordinary + shift/weekend pay</span><span>{formatMoney(totals.ordinaryPay)}</span></div>
        <div className="pt-row"><span>Missed meal break pay</span><span>{formatMoney(totals.missedMealPay)}</span></div>
        <div className="pt-row"><span>Overtime pay</span><span>{formatMoney(totals.overtimePay)}</span></div>
        <div className="pt-row"><span>Leave paid</span><span>{formatMoney(totals.leavePay)}</span></div>
        <div className="pt-row"><strong>Total estimated gross</strong><strong>{formatMoney(totals.totalPay)}</strong></div>
        {totals.parkingDeduction > 0 && (
          <div className="pt-row"><span>Parking charged (not part of gross)</span><span>-{formatMoney(totals.parkingDeduction)}</span></div>
        )}
      </div>

      <div className="pt-card">
        <h2>Compare against your payslip</h2>

        <div className="pt-field">
          <label>Upload a payslip screenshot or photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePayslipUpload(file);
              e.target.value = '';
            }}
          />
        </div>
        {ocrStatus !== 'idle' && (
          <div
            className="pt-inline-note"
            style={
              ocrStatus === 'error'
                ? { background: '#fdeceb', color: '#b42318' }
                : ocrStatus === 'done'
                ? { background: '#dcfce7', color: '#166534' }
                : undefined
            }
          >
            {ocrMessage}
          </div>
        )}
        <div className="pt-helptext" style={{ marginTop: -4 }}>
          Reads the pay period and gross pay straight off the photo and fills them in below — runs entirely in your browser, the photo itself is never uploaded anywhere.
        </div>

        <div className="pt-divider" />

        <div className="pt-field">
          <label>Actual gross pay from payslip ($)</label>
          <input type="number" step="0.01" value={actualPay} onChange={(e) => setActualPay(e.target.value)} onBlur={savePayslipAmount} placeholder="e.g. 2450.30" />
        </div>
        {variance != null && (
          <div className="pt-inline-note" style={{ background: Math.abs(variance) < 1 ? '#dcfce7' : '#fdeceb', color: Math.abs(variance) < 1 ? '#166534' : '#b42318' }}>
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
