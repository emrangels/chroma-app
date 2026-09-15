import React, { useRef, useState } from 'react';
import { PaySettings, RosterDay } from './types';
import { WEEKDAY_NAMES } from './utils';

interface Props {
  settings: PaySettings;
  onChange: (settings: PaySettings) => void;
  onExportAll: () => void;
  onImportFile: (file: File) => void;
  onResetAll: () => void;
  shiftsCount: number;
}

export default function SettingsTab({ settings, onChange, onExportAll, onImportFile, onResetAll, shiftsCount }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newHoliday, setNewHoliday] = useState('');

  function set<K extends keyof PaySettings>(key: K, value: PaySettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  function setRosterDay(index: number, patch: Partial<RosterDay>) {
    const roster = settings.roster.map((d, i) => (i === index ? { ...d, ...patch } : d));
    set('roster', roster);
  }

  function addHoliday() {
    if (!newHoliday) return;
    if (settings.publicHolidays.includes(newHoliday)) return;
    set('publicHolidays', [...settings.publicHolidays, newHoliday].sort());
    setNewHoliday('');
  }

  function removeHoliday(date: string) {
    set('publicHolidays', settings.publicHolidays.filter((d) => d !== date));
  }

  return (
    <div>
      <div className="pt-card">
        <h2>Pay rates</h2>
        <div className="pt-inline-note">
          These start as generic defaults. Update them from your payslip and EBA so calculations match exactly — every rate below is editable.
        </div>
        <div className="pt-field">
          <label>Employment type</label>
          <select value={settings.employmentType} onChange={(e) => set('employmentType', e.target.value as PaySettings['employmentType'])}>
            <option value="permanent">Permanent (accrues paid leave)</option>
            <option value="casual">Casual (loading instead of leave)</option>
          </select>
        </div>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Base hourly rate ($)</label>
            <input type="number" step="0.01" value={settings.baseHourlyRate} onChange={(e) => set('baseHourlyRate', Number(e.target.value))} />
          </div>
          {settings.employmentType === 'casual' && (
            <div className="pt-field">
              <label>Casual loading (%)</label>
              <input type="number" step="0.1" value={settings.casualLoadingPercent} onChange={(e) => set('casualLoadingPercent', Number(e.target.value))} />
            </div>
          )}
        </div>
        {settings.employmentType === 'casual' && (
          <label className="pt-checkbox">
            <input type="checkbox" checked={settings.applyCasualLoadingToPenalties} onChange={(e) => set('applyCasualLoadingToPenalties', e.target.checked)} />
            Apply casual loading on top of penalty rates too (not just ordinary hours)
          </label>
        )}

        <h3>Penalty rate multipliers</h3>
        <div className="pt-row-3">
          <div className="pt-field">
            <label>Saturday</label>
            <input type="number" step="0.01" value={settings.multipliers.saturday} onChange={(e) => set('multipliers', { ...settings.multipliers, saturday: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>Sunday</label>
            <input type="number" step="0.01" value={settings.multipliers.sunday} onChange={(e) => set('multipliers', { ...settings.multipliers, sunday: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>Public holiday</label>
            <input type="number" step="0.01" value={settings.multipliers.publicHoliday} onChange={(e) => set('multipliers', { ...settings.multipliers, publicHoliday: Number(e.target.value) })} />
          </div>
        </div>

        <div className="pt-row-2">
          <div className="pt-field">
            <label>Evening rate starts at</label>
            <input
              type="time"
              value={settings.eveningStartTime ?? ''}
              onChange={(e) => set('eveningStartTime', e.target.value || null)}
            />
          </div>
          <div className="pt-field">
            <label>Evening multiplier</label>
            <input type="number" step="0.01" value={settings.multipliers.evening} onChange={(e) => set('multipliers', { ...settings.multipliers, evening: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-helptext">Leave "evening rate starts at" blank if your EBA has no weeknight evening loading.</div>

        <h3>Overtime</h3>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Daily OT threshold (hrs)</label>
            <input
              type="number"
              step="0.1"
              value={settings.overtime.dailyThresholdHours ?? ''}
              onChange={(e) => set('overtime', { ...settings.overtime, dailyThresholdHours: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div className="pt-field">
            <label>Daily OT multiplier</label>
            <input type="number" step="0.01" value={settings.overtime.dailyMultiplier} onChange={(e) => set('overtime', { ...settings.overtime, dailyMultiplier: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Fortnight OT threshold (hrs)</label>
            <input
              type="number"
              step="0.1"
              value={settings.overtime.fortnightThresholdHours ?? ''}
              onChange={(e) => set('overtime', { ...settings.overtime, fortnightThresholdHours: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div className="pt-field">
            <label>Fortnight OT multiplier</label>
            <input type="number" step="0.01" value={settings.overtime.fortnightMultiplier} onChange={(e) => set('overtime', { ...settings.overtime, fortnightMultiplier: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-helptext">Leave a threshold blank to disable that overtime rule entirely.</div>
      </div>

      <div className="pt-card">
        <h2>Pay cycle</h2>
        <div className="pt-field">
          <label>A date known to be the FIRST day of a fortnight (from any payslip)</label>
          <input type="date" value={settings.payCycleAnchorDate} onChange={(e) => set('payCycleAnchorDate', e.target.value)} />
        </div>
        <div className="pt-helptext">This anchors every fortnight period so "this fortnight" lines up with your actual pay cycle.</div>
      </div>

      <div className="pt-card">
        <h2>Usual roster</h2>
        <div className="pt-helptext" style={{ marginTop: -4 }}>Set your normal expected shift per weekday, so "Same as usual" on a shift can auto-fill it.</div>
        {WEEKDAY_NAMES.map((name, i) => {
          const day = settings.roster[i];
          return (
            <div key={name} style={{ borderBottom: '1px solid #f0f1f4', paddingBottom: 10, marginBottom: 10 }}>
              <label className="pt-checkbox">
                <input type="checkbox" checked={day.enabled} onChange={(e) => setRosterDay(i, { enabled: e.target.checked })} />
                {name}
              </label>
              {day.enabled && (
                <>
                  <div className="pt-row-2">
                    <div className="pt-field">
                      <label>Start</label>
                      <input type="time" value={day.start} onChange={(e) => setRosterDay(i, { start: e.target.value })} />
                    </div>
                    <div className="pt-field">
                      <label>End</label>
                      <input type="time" value={day.end} onChange={(e) => setRosterDay(i, { end: e.target.value })} />
                    </div>
                  </div>
                  <div className="pt-row-2">
                    <div className="pt-field">
                      <label>Break (mins)</label>
                      <input type="number" value={day.breakMinutes} onChange={(e) => setRosterDay(i, { breakMinutes: Number(e.target.value) })} />
                    </div>
                    <label className="pt-checkbox" style={{ alignSelf: 'center', marginTop: 18 }}>
                      <input type="checkbox" checked={day.paidBreak} onChange={(e) => setRosterDay(i, { paidBreak: e.target.checked })} />
                      Break paid
                    </label>
                  </div>
                  <label className="pt-checkbox">
                    <input type="checkbox" checked={day.parkingPaid} onChange={(e) => setRosterDay(i, { parkingPaid: e.target.checked })} />
                    Usually paid for parking
                  </label>
                  {day.parkingPaid && (
                    <div className="pt-field">
                      <label>Usual parking amount ($)</label>
                      <input type="number" step="0.01" value={day.parkingAmount} onChange={(e) => setRosterDay(i, { parkingAmount: Number(e.target.value) })} />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-card">
        <h2>Public holidays</h2>
        <div className="pt-helptext" style={{ marginTop: -4 }}>National dates are pre-filled. Add/remove to match your state and check each year.</div>
        {settings.publicHolidays.map((d) => (
          <div key={d} className="pt-row">
            <span>{d}</span>
            <button className="pt-btn pt-btn-danger pt-btn-sm" onClick={() => removeHoliday(d)}>Remove</button>
          </div>
        ))}
        <div className="pt-field" style={{ marginTop: 10 }}>
          <label>Add a date</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} />
            <button className="pt-btn pt-btn-secondary" onClick={addHoliday}>Add</button>
          </div>
        </div>
      </div>

      <div className="pt-card">
        <h2>Leave accrual</h2>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Annual leave accrual (hrs per hr worked)</label>
            <input type="number" step="0.0001" value={settings.leave.annualAccrualHoursPerHourWorked} onChange={(e) => set('leave', { ...settings.leave, annualAccrualHoursPerHourWorked: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>Personal leave accrual (hrs per hr worked)</label>
            <input type="number" step="0.0001" value={settings.leave.personalAccrualHoursPerHourWorked} onChange={(e) => set('leave', { ...settings.leave, personalAccrualHoursPerHourWorked: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-helptext">Defaults use the NES standard (4 weeks annual / 10 days personal leave per year, full-time). Adjust to match your EBA.</div>

        <h3>Opening balances (from a recent payslip)</h3>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Annual leave balance (hrs)</label>
            <input type="number" step="0.01" value={settings.leave.openingAnnualBalanceHours} onChange={(e) => set('leave', { ...settings.leave, openingAnnualBalanceHours: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>Personal leave balance (hrs)</label>
            <input type="number" step="0.01" value={settings.leave.openingPersonalBalanceHours} onChange={(e) => set('leave', { ...settings.leave, openingPersonalBalanceHours: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-field">
          <label>As of date (the payslip's period end date)</label>
          <input type="date" value={settings.leave.openingBalanceAsOfDate} onChange={(e) => set('leave', { ...settings.leave, openingBalanceAsOfDate: e.target.value })} />
        </div>
        <label className="pt-checkbox">
          <input type="checkbox" checked={settings.leave.accrueOnLeaveHours} onChange={(e) => set('leave', { ...settings.leave, accrueOnLeaveHours: e.target.checked })} />
          Leave taken still counts toward future leave accrual
        </label>
      </div>

      <div className="pt-card">
        <h2>Defaults</h2>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Default meal break (mins)</label>
            <input type="number" value={settings.mealBreak.defaultMinutes} onChange={(e) => set('mealBreak', { ...settings.mealBreak, defaultMinutes: Number(e.target.value) })} />
          </div>
          <label className="pt-checkbox" style={{ alignSelf: 'center', marginTop: 18 }}>
            <input type="checkbox" checked={settings.mealBreak.paidByDefault} onChange={(e) => set('mealBreak', { ...settings.mealBreak, paidByDefault: e.target.checked })} />
            Paid by default
          </label>
        </div>
      </div>

      <div className="pt-card">
        <h2>Your data</h2>
        <div className="pt-helptext" style={{ marginTop: -4 }}>
          Everything is stored only in this browser ({shiftsCount} shift{shiftsCount === 1 ? '' : 's'} saved). Export regularly as a backup, or to move to another device.
        </div>
        <div className="pt-btn-row">
          <button className="pt-btn pt-btn-secondary" onClick={onExportAll}>Export backup (JSON)</button>
          <button className="pt-btn pt-btn-secondary" onClick={() => fileInputRef.current?.click()}>Import backup</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = '';
          }}
        />
        <div className="pt-btn-row">
          <button
            className="pt-btn pt-btn-danger"
            onClick={() => {
              if (window.confirm('This will permanently delete all shifts, leave records, and settings from this browser. Continue?')) {
                onResetAll();
              }
            }}
          >
            Reset all data
          </button>
        </div>
      </div>
    </div>
  );
}
