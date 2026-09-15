import React, { useRef, useState } from 'react';
import { PaySettings } from './types';
import { WEEKDAY_NAMES, formatTimeRange, newId } from './utils';

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
          Defaults below match the Eastwood Private Hospital Enterprise Agreement (cl.24, 29, 31, 32, 34, 35, 37), cross-checked against real payslips. Every rate is still editable if your award/EBA differs or changes.
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

        <h3>Weekend & public holiday rates (cl.29, 35.1)</h3>
        <div className="pt-helptext" style={{ marginTop: -4 }}>These flat rates replace any shift loading below — they don't stack with afternoon/night loadings.</div>
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

        <h3>Weekday shift loadings (cl.32)</h3>
        <div className="pt-helptext" style={{ marginTop: -4 }}>
          Applies to the whole shift when it qualifies — afternoon = starts at/after 12pm and finishes after 6pm; night = starts at/after 6pm. Mon-Fri only.
        </div>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Afternoon shift multiplier</label>
            <input type="number" step="0.001" value={settings.multipliers.afternoonShift} onChange={(e) => set('multipliers', { ...settings.multipliers, afternoonShift: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>Night shift multiplier</label>
            <input type="number" step="0.001" value={settings.multipliers.nightShift} onChange={(e) => set('multipliers', { ...settings.multipliers, nightShift: Number(e.target.value) })} />
          </div>
        </div>

        <h3>Overtime (cl.31)</h3>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Daily OT threshold (hrs/shift)</label>
            <input
              type="number"
              step="0.1"
              value={settings.overtime.dailyThresholdHours ?? ''}
              onChange={(e) => set('overtime', { ...settings.overtime, dailyThresholdHours: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div className="pt-field">
            <label>Fortnight OT threshold (hrs)</label>
            <input
              type="number"
              step="0.1"
              value={settings.overtime.fortnightThresholdHours ?? ''}
              onChange={(e) => set('overtime', { ...settings.overtime, fortnightThresholdHours: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="pt-helptext">Hours beyond either threshold are paid as overtime instead of the day's normal rate. Leave a threshold blank to disable that rule.</div>
        <div className="pt-row-3">
          <div className="pt-field">
            <label>Mon-Sat OT: first N hours</label>
            <input type="number" step="0.5" value={settings.overtime.weekdaySaturdayTier1Hours} onChange={(e) => set('overtime', { ...settings.overtime, weekdaySaturdayTier1Hours: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>...at multiplier</label>
            <input type="number" step="0.01" value={settings.overtime.weekdaySaturdayTier1Multiplier} onChange={(e) => set('overtime', { ...settings.overtime, weekdaySaturdayTier1Multiplier: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>Then multiplier</label>
            <input type="number" step="0.01" value={settings.overtime.weekdaySaturdayTier2Multiplier} onChange={(e) => set('overtime', { ...settings.overtime, weekdaySaturdayTier2Multiplier: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Sunday OT multiplier (flat)</label>
            <input type="number" step="0.01" value={settings.overtime.sundayMultiplier} onChange={(e) => set('overtime', { ...settings.overtime, sundayMultiplier: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>Public holiday OT multiplier (flat)</label>
            <input type="number" step="0.01" value={settings.overtime.publicHolidayMultiplier} onChange={(e) => set('overtime', { ...settings.overtime, publicHolidayMultiplier: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-helptext">
          A missed/interrupted meal break (cl.30.2) is also paid at these overtime rates for the hours worked through it — logged per shift, not here.
        </div>
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
        <h2>Usual work days</h2>
        <div className="pt-helptext" style={{ marginTop: -4 }}>For reference only — which weekdays you're usually rostered on.</div>
        <div className="pt-btn-row">
          {WEEKDAY_NAMES.map((name, i) => {
            const active = settings.usualWorkDays.includes(i);
            return (
              <button
                key={name}
                type="button"
                className={`pt-btn pt-btn-sm ${active ? 'pt-btn-primary' : 'pt-btn-secondary'}`}
                onClick={() => set('usualWorkDays', active ? settings.usualWorkDays.filter((d) => d !== i) : [...settings.usualWorkDays, i].sort())}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-card">
        <h2>Shift presets</h2>
        <div className="pt-helptext" style={{ marginTop: -4 }}>
          Your standard rostered shift times. When logging a shift, tap one to fill in the expected start/end/break instantly — handy since which shift you're on can change week to week.
        </div>
        {settings.shiftPresets.map((preset, i) => (
          <div key={preset.id} style={{ borderBottom: '1px solid #f0f1f4', paddingBottom: 10, marginBottom: 10 }}>
            <div className="pt-row-2">
              <div className="pt-field">
                <label>Start</label>
                <input
                  type="time"
                  value={preset.start}
                  onChange={(e) => {
                    const start = e.target.value;
                    const presets = settings.shiftPresets.map((p, idx) => (idx === i ? { ...p, start, label: formatTimeRange(start, p.end) } : p));
                    set('shiftPresets', presets);
                  }}
                />
              </div>
              <div className="pt-field">
                <label>End</label>
                <input
                  type="time"
                  value={preset.end}
                  onChange={(e) => {
                    const end = e.target.value;
                    const presets = settings.shiftPresets.map((p, idx) => (idx === i ? { ...p, end, label: formatTimeRange(p.start, end) } : p));
                    set('shiftPresets', presets);
                  }}
                />
              </div>
            </div>
            <div className="pt-row-2">
              <div className="pt-field">
                <label>Break (mins)</label>
                <input
                  type="number"
                  value={preset.breakMinutes}
                  onChange={(e) => {
                    const breakMinutes = Number(e.target.value);
                    set('shiftPresets', settings.shiftPresets.map((p, idx) => (idx === i ? { ...p, breakMinutes } : p)));
                  }}
                />
              </div>
              <label className="pt-checkbox" style={{ alignSelf: 'center', marginTop: 18 }}>
                <input
                  type="checkbox"
                  checked={preset.paidBreak}
                  onChange={(e) => {
                    const paidBreak = e.target.checked;
                    set('shiftPresets', settings.shiftPresets.map((p, idx) => (idx === i ? { ...p, paidBreak } : p)));
                  }}
                />
                Break paid
              </label>
            </div>
            <button
              className="pt-btn pt-btn-danger pt-btn-sm"
              onClick={() => set('shiftPresets', settings.shiftPresets.filter((_, idx) => idx !== i))}
            >
              Remove this preset
            </button>
          </div>
        ))}
        <button
          className="pt-btn pt-btn-secondary pt-btn-block"
          onClick={() =>
            set('shiftPresets', [
              ...settings.shiftPresets,
              { id: newId(), label: formatTimeRange('09:00', '17:00'), start: '09:00', end: '17:00', breakMinutes: settings.mealBreak.defaultMinutes, paidBreak: settings.mealBreak.paidByDefault },
            ])
          }
        >
          + Add a shift preset
        </button>
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
        <h2>Leave accrual (cl.34, 37)</h2>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Annual leave accrual (hrs per ordinary hr)</label>
            <input type="number" step="0.0001" value={settings.leave.annualAccrualHoursPerHourWorked} onChange={(e) => set('leave', { ...settings.leave, annualAccrualHoursPerHourWorked: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>Personal leave accrual (hrs per ordinary hr)</label>
            <input type="number" step="0.0001" value={settings.leave.personalAccrualHoursPerHourWorked} onChange={(e) => set('leave', { ...settings.leave, personalAccrualHoursPerHourWorked: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-helptext">
          Default is 5 weeks (190h) annual leave per year for a day worker — set to 6/52 (0.1154) for 6 weeks (228h) if you're a shiftworker under cl.34.1(b) (rostered 7 days/week and regularly work weekends). Personal leave defaults to 10 days/year. Both accrue on ordinary hours (including shift-loaded and missed-meal hours) but not true overtime.
        </div>
        <div className="pt-field">
          <label>Annual leave loading (%)</label>
          <input type="number" step="0.1" value={settings.leave.annualLeaveLoadingPercent} onChange={(e) => set('leave', { ...settings.leave, annualLeaveLoadingPercent: Number(e.target.value) })} />
        </div>
        <div className="pt-helptext">Paid on top of ordinary pay for annual leave taken (cl.34.5). Personal leave has no loading.</div>

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
          <input type="checkbox" checked={settings.leave.accrueOnLeaveHoursTaken} onChange={(e) => set('leave', { ...settings.leave, accrueOnLeaveHoursTaken: e.target.checked })} />
          Paid leave taken still counts toward future leave accrual
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
        <div className="pt-helptext">EBA cl.30.1: shifts over 5 hours get an unpaid break of 30-60 minutes, usually taken between the 4th and 6th hour.</div>
      </div>

      <div className="pt-card">
        <h2>Parking</h2>
        <div className="pt-helptext" style={{ marginTop: -4 }}>
          When you mark a shift as charged for parking, the amount auto-fills based on its start time — edit it on the shift if a particular day was different.
        </div>
        <div className="pt-row-2">
          <div className="pt-field">
            <label>Shift starts before threshold ($)</label>
            <input type="number" step="0.01" value={settings.parking.beforeThresholdAmount} onChange={(e) => set('parking', { ...settings.parking, beforeThresholdAmount: Number(e.target.value) })} />
          </div>
          <div className="pt-field">
            <label>Shift starts at/after threshold ($)</label>
            <input type="number" step="0.01" value={settings.parking.fromThresholdAmount} onChange={(e) => set('parking', { ...settings.parking, fromThresholdAmount: Number(e.target.value) })} />
          </div>
        </div>
        <div className="pt-field">
          <label>Threshold time</label>
          <input type="time" value={settings.parking.thresholdTime} onChange={(e) => set('parking', { ...settings.parking, thresholdTime: e.target.value })} />
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
