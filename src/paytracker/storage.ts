import { emptyData } from './defaults';
import { PayTrackerData } from './types';

const STORAGE_KEY = 'paytracker.data.v1';

export function loadData(): PayTrackerData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    const base = emptyData();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings },
      shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
      payslips: Array.isArray(parsed.payslips) ? parsed.payslips : [],
    };
  } catch {
    return emptyData();
  }
}

export function saveData(data: PayTrackerData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private mode / quota) — fail silently, data stays in memory for the session.
  }
}

export function exportDataAsJSON(data: PayTrackerData): string {
  return JSON.stringify(data, null, 2);
}

export function downloadJSON(data: PayTrackerData, filename: string): void {
  const blob = new Blob([exportDataAsJSON(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseImportedJSON(text: string): PayTrackerData | null {
  try {
    const parsed = JSON.parse(text);
    const base = emptyData();
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings },
      shifts: Array.isArray(parsed.shifts) ? parsed.shifts : [],
      payslips: Array.isArray(parsed.payslips) ? parsed.payslips : [],
    };
  } catch {
    return null;
  }
}
