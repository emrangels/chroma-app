import React, { useMemo, useState } from 'react';
import { classifyDayType } from './calculations';
import { DayType, LeaveType, PaySettings, ShiftEntry, TimeBlock } from './types';
import { dayTypeLabel, newId } from './utils';

interface Props {
  date: string;
  existing: ShiftEntry | null;
  settings: PaySettings;
  onSave: (shift: ShiftEntry) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

function blankBlock(settings: PaySettings): TimeBlock {
  return { start: '09:00', end: '17:00', breakMinutes: settings.mealBreak.defaultMinutes, paidBreak: settings.mealBreak.paidByDefault };
}

export default function ShiftForm({ date, existing, settings, onSave, onDelete, onCancel }: Props) {
  const weekday = useMemo(() => new Date(date + 'T00:00:00').getDay(), [date]);
  const roster = settings.roster[weekday];

  const [usedTemplate, setUsedTemplate] = useState(existing?.usedTemplate ?? false);
  const [notWorked, setNotWorked] = useState(existing?.notWorked ?? false);
  const [dayTypeOverride, setDayTypeOverride] = useState<DayType | ''>(existing?.dayTypeOverride ?? '');
  const [expected, setExpected] = useState<TimeBlock>(existing?.expected ?? blankBlock(settings));
  const [worked, setWorked] = useState<TimeBlock>(existing?.worked ?? blankBlock(settings));
  const [parkingCharged, setParkingCharged] = useState(existing?.parkingCharged ?? roster.parkingCharged);
  const [parkingAmount, setParkingAmount] = useState(existing?.parkingAmount ?? (roster.parkingAmount || settings.parking.defaultAmount));
  const [missedMealHours, setMissedMealHours] = useState(existing?.missedMealHours ?? 0);
  const [manualOvertimeHours, setManualOvertimeHours] = useState(existing?.manualOvertimeHours ?? 0);
  const [leaveEnabled, setLeaveEnabled] = useState(!!existing?.leave);
  const [leaveType, setLeaveType] = useState<LeaveType>(existing?.leave?.type ?? 'annual');
  const [leaveHours, setLeaveHours] = useState(existing?.leave?.hours ?? 7.6);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const autoDayType = classifyDayType(date, settings, null);

  function applyTemplate(checked: boolean) {
    setUsedTemplate(checked);
    if (checked && roster.enabled) {
      setExpected({ start: roster.start, end: roster.end, breakMinutes: roster.breakMinutes, paidBreak: roster.paidBreak });
      setParkingCharged(roster.parkingCharged);
      setParkingAmount(roster.parkingAmount);
    }
  }

  function copyExpectedToWorked() {
    setWorked({ ...expected });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const shift: ShiftEntry = {
      id: existing?.id ?? newId(),
      date,
      usedTemplate,
      dayTypeOverride: dayTypeOverride || null,
      notWorked,
      expected,
      worked: notWorked ? null : worked,
      missedMealHours: notWorked ? 0 : Number(missedMealHours) || 0,
      manualOvertimeHours: notWorked ? 0 : Number(manualOvertimeHours) || 0,
      leave: leaveEnabled ? { type: leaveType, hours: Number(leaveHours) || 0 } : null,
      parkingCharged,
      parkingAmount: Number(parkingAmount) || 0,
      notes,
    };
    onSave(shift);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="pt-field">
        <label>Day type</label>
        <div className="pt-helptext" style={{ marginBottom: 6 }}>
          Auto-detected as <strong>{dayTypeLabel(autoDayType)}</strong> from the date. Override only if this specific day should be treated differently.
        </div>
        <select value={dayTypeOverride} onChange={(e) => setDayTypeOverride(e.target.value as DayType | '')}>
          <option value="">Use auto ({dayTypeLabel(autoDayType)})</option>
          <option value="weekday">Weekday</option>
          <option value="saturday">Saturday</option>
          <option value="sunday">Sunday</option>
          <option value="publicHoliday">Public holiday</option>
        </select>
      </div>

      <label className="pt-checkbox">
        <input
          type="checkbox"
          checked={usedTemplate}
          onChange={(e) => applyTemplate(e.target.checked)}
        />
        Same as usual roster {!roster.enabled && '(no usual roster set for this day in Settings)'}
      </label>

      <h3>Expected shift</h3>
      <div className="pt-row-2">
        <div className="pt-field">
          <label>Start</label>
          <input type="time" value={expected.start} onChange={(e) => setExpected({ ...expected, start: e.target.value })} />
        </div>
        <div className="pt-field">
          <label>End</label>
          <input type="time" value={expected.end} onChange={(e) => setExpected({ ...expected, end: e.target.value })} />
        </div>
      </div>
      <div className="pt-row-2">
        <div className="pt-field">
          <label>Break (mins)</label>
          <input type="number" min={0} value={expected.breakMinutes} onChange={(e) => setExpected({ ...expected, breakMinutes: Number(e.target.value) })} />
        </div>
        <div className="pt-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label className="pt-checkbox" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={expected.paidBreak} onChange={(e) => setExpected({ ...expected, paidBreak: e.target.checked })} />
            Break is paid
          </label>
        </div>
      </div>

      <div className="pt-divider" />

      <label className="pt-checkbox">
        <input type="checkbox" checked={notWorked} onChange={(e) => setNotWorked(e.target.checked)} />
        I did not work this day (day off / leave / cancelled shift)
      </label>

      {!notWorked && (
        <>
          <h3>Actually worked</h3>
          <div className="pt-row-2">
            <div className="pt-field">
              <label>Start</label>
              <input type="time" value={worked.start} onChange={(e) => setWorked({ ...worked, start: e.target.value })} />
            </div>
            <div className="pt-field">
              <label>End</label>
              <input type="time" value={worked.end} onChange={(e) => setWorked({ ...worked, end: e.target.value })} />
            </div>
          </div>
          <div className="pt-row-2">
            <div className="pt-field">
              <label>Meal break (mins)</label>
              <input type="number" min={0} value={worked.breakMinutes} onChange={(e) => setWorked({ ...worked, breakMinutes: Number(e.target.value) })} />
            </div>
            <div className="pt-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label className="pt-checkbox" style={{ marginBottom: 10 }}>
                <input type="checkbox" checked={worked.paidBreak} onChange={(e) => setWorked({ ...worked, paidBreak: e.target.checked })} />
                Break is paid
              </label>
            </div>
          </div>
          <button type="button" className="pt-btn pt-btn-secondary pt-btn-sm" onClick={copyExpectedToWorked}>
            Copy from expected shift
          </button>

          <div className="pt-field">
            <label>Overtime hours (if you were told/rostered this shift included OT)</label>
            <input type="number" min={0} step="0.1" value={manualOvertimeHours} onChange={(e) => setManualOvertimeHours(Number(e.target.value))} />
          </div>
          <div className="pt-helptext">
            Only needed if it's not already obvious from the times above (e.g. an extra shift, or being asked to stay back) — leave at 0 otherwise. A shift over {settings.overtime.dailyThresholdHours ?? 10}h is detected as overtime automatically.
          </div>

          <div className="pt-field">
            <label>Hours worked through your meal break (not released)</label>
            <input type="number" min={0} step="0.1" value={missedMealHours} onChange={(e) => setMissedMealHours(Number(e.target.value))} />
          </div>
          <div className="pt-helptext">
            If you weren't released for your break, that time is paid at the overtime rate — leave at 0 if you got your break as normal.
          </div>

          <div className="pt-divider" />

          <label className="pt-checkbox">
            <input type="checkbox" checked={parkingCharged} onChange={(e) => setParkingCharged(e.target.checked)} />
            Charged for parking today
          </label>
          {parkingCharged && (
            <div className="pt-field">
              <label>Parking charge ($)</label>
              <input type="number" min={0} step="0.01" value={parkingAmount} onChange={(e) => setParkingAmount(Number(e.target.value))} />
            </div>
          )}
          <div className="pt-helptext">
            Tracked as a deduction from your net pay — it doesn't reduce your gross pay estimate.
          </div>
        </>
      )}

      <div className="pt-divider" />

      <label className="pt-checkbox">
        <input type="checkbox" checked={leaveEnabled} onChange={(e) => setLeaveEnabled(e.target.checked)} />
        Leave taken this day
      </label>
      {leaveEnabled && (
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Leave type</label>
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)}>
              <option value="annual">Annual leave</option>
              <option value="personal">Personal / sick leave</option>
              <option value="unpaid">Unpaid leave</option>
              <option value="other">Other (e.g. long service)</option>
            </select>
          </div>
          <div className="pt-field">
            <label>Hours</label>
            <input type="number" min={0} step="0.1" value={leaveHours} onChange={(e) => setLeaveHours(Number(e.target.value))} />
          </div>
        </div>
      )}

      <div className="pt-field">
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — anything worth remembering about this shift" />
      </div>

      <div className="pt-btn-row">
        <button type="submit" className="pt-btn pt-btn-primary pt-btn-block">Save shift</button>
      </div>
      <div className="pt-btn-row">
        <button type="button" className="pt-btn pt-btn-secondary" onClick={onCancel}>Cancel</button>
        {onDelete && (
          <button type="button" className="pt-btn pt-btn-danger" onClick={onDelete}>Delete</button>
        )}
      </div>
    </form>
  );
}
