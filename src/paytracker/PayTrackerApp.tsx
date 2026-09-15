import React, { useEffect, useRef, useState } from 'react';
import Dashboard from './Dashboard';
import { dateToISO } from './calculations';
import { emptyData } from './defaults';
import FortnightsTab from './FortnightsTab';
import LeaveTab from './LeaveTab';
import './PayTracker.css';
import SettingsTab from './SettingsTab';
import ShiftsTab from './ShiftsTab';
import { downloadJSON, loadData, parseImportedJSON, saveData } from './storage';
import { PaySettings, PayslipRecord, PayTrackerData, ShiftEntry } from './types';

type Tab = 'dashboard' | 'shifts' | 'fortnights' | 'leave' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'shifts', label: 'Shifts' },
  { id: 'fortnights', label: 'Fortnights' },
  { id: 'leave', label: 'Leave' },
  { id: 'settings', label: 'Settings' },
];

export default function PayTrackerApp() {
  const [data, setData] = useState<PayTrackerData>(() => loadData());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [pendingAddDate, setPendingAddDate] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveData(data);
  }, [data]);

  function saveShift(shift: ShiftEntry) {
    setData((prev) => {
      const exists = prev.shifts.some((s) => s.id === shift.id);
      const shifts = exists ? prev.shifts.map((s) => (s.id === shift.id ? shift : s)) : [...prev.shifts, shift];
      return { ...prev, shifts };
    });
  }

  function deleteShift(id: string) {
    setData((prev) => ({ ...prev, shifts: prev.shifts.filter((s) => s.id !== id) }));
  }

  function updateSettings(settings: PaySettings) {
    setData((prev) => ({ ...prev, settings }));
  }

  function savePayslip(record: PayslipRecord) {
    setData((prev) => {
      const exists = prev.payslips.some((p) => p.id === record.id);
      const payslips = exists ? prev.payslips.map((p) => (p.id === record.id ? record : p)) : [...prev.payslips, record];
      return { ...prev, payslips };
    });
  }

  function exportAll() {
    downloadJSON(data, `pay-tracker-backup-${dateToISO(new Date())}.json`);
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImportedJSON(String(reader.result));
      if (!parsed) {
        window.alert('That file could not be read as a pay tracker backup.');
        return;
      }
      if (window.confirm('Import this backup? It will replace all shifts, leave records, and settings currently in this browser.')) {
        setData(parsed);
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    setData(emptyData());
  }

  return (
    <div className="pt-root">
      <div className="pt-header">
        <h1>Shift & Pay Tracker</h1>
        <div className="pt-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`pt-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-content">
        {tab === 'dashboard' && (
          <Dashboard
            shifts={data.shifts}
            settings={data.settings}
            onQuickAddToday={() => {
              setPendingAddDate(dateToISO(new Date()));
              setTab('shifts');
            }}
          />
        )}
        {tab === 'shifts' && (
          <ShiftsTab
            shifts={data.shifts}
            settings={data.settings}
            onSave={saveShift}
            onDelete={deleteShift}
            pendingAddDate={pendingAddDate}
            onConsumePendingAddDate={() => setPendingAddDate(null)}
          />
        )}
        {tab === 'fortnights' && (
          <FortnightsTab shifts={data.shifts} settings={data.settings} payslips={data.payslips} onSavePayslip={savePayslip} />
        )}
        {tab === 'leave' && <LeaveTab shifts={data.shifts} settings={data.settings} />}
        {tab === 'settings' && (
          <SettingsTab
            settings={data.settings}
            onChange={updateSettings}
            onExportAll={exportAll}
            onImportFile={importFile}
            onResetAll={resetAll}
            shiftsCount={data.shifts.length}
          />
        )}
      </div>
    </div>
  );
}
