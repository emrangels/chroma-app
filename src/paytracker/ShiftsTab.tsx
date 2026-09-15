import React, { useMemo, useState } from 'react';
import { calculateShift, dateToISO } from './calculations';
import Modal from './Modal';
import ShiftForm from './ShiftForm';
import { PaySettings, ShiftEntry } from './types';
import { dayTypeLabel, formatDateLabel, formatHours, formatMoney } from './utils';

interface Props {
  shifts: ShiftEntry[];
  settings: PaySettings;
  onSave: (shift: ShiftEntry) => void;
  onDelete: (id: string) => void;
  pendingAddDate?: string | null;
  onConsumePendingAddDate?: () => void;
}

export default function ShiftsTab({ shifts, settings, onSave, onDelete, pendingAddDate, onConsumePendingAddDate }: Props) {
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShiftEntry | null>(null);

  const sorted = useMemo(() => [...shifts].sort((a, b) => (a.date < b.date ? 1 : -1)), [shifts]);

  React.useEffect(() => {
    if (pendingAddDate) {
      setEditing(null);
      setModalDate(pendingAddDate);
      onConsumePendingAddDate?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAddDate]);

  function openAdd() {
    setEditing(null);
    setModalDate(dateToISO(new Date()));
  }

  function openEdit(shift: ShiftEntry) {
    setEditing(shift);
    setModalDate(shift.date);
  }

  function handleSave(shift: ShiftEntry) {
    onSave(shift);
    setModalDate(null);
    setEditing(null);
  }

  function handleDelete() {
    if (editing) onDelete(editing.id);
    setModalDate(null);
    setEditing(null);
  }

  return (
    <div>
      <button className="pt-btn pt-btn-primary pt-btn-block" onClick={openAdd}>+ Add a shift</button>

      <div className="pt-card" style={{ marginTop: 14 }}>
        <h2>All shifts</h2>
        {sorted.length === 0 && <div className="pt-empty">No shifts logged yet. Add your first one above.</div>}
        {sorted.map((shift) => {
          const calc = calculateShift(shift, settings);
          const variance = calc.varianceMinutes;
          return (
            <div key={shift.id} className="pt-shift-item" onClick={() => openEdit(shift)} style={{ cursor: 'pointer' }}>
              <div className="pt-shift-top">
                <span className="pt-shift-date">
                  {formatDateLabel(shift.date)}
                  <span className={`pt-badge pt-badge-${calc.dayType}`}>{dayTypeLabel(calc.dayType)}</span>
                </span>
                <strong>{formatMoney(calc.totalPay)}</strong>
              </div>
              <div className="pt-shift-meta">
                {shift.notWorked
                  ? shift.leave
                    ? `Not worked — ${shift.leave.hours}h ${shift.leave.type} leave`
                    : 'Not worked'
                  : `${shift.worked?.start}–${shift.worked?.end} · ${formatHours(calc.hours.totalPaidHours)} paid`}
                {shift.missedMealHours > 0 && ` · ${shift.missedMealHours}h missed meal`}
                {shift.parkingCharged && ` · Parking -${formatMoney(shift.parkingAmount)}`}
                {variance != null && variance !== 0 && (
                  <span className={variance > 0 ? 'pt-variance-pos' : 'pt-variance-neg'}>
                    {' '}· {variance > 0 ? '+' : ''}{variance} min vs. expected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalDate && (
        <Modal title={editing ? 'Edit shift' : 'Add shift'} onClose={() => { setModalDate(null); setEditing(null); }}>
          <div className="pt-field">
            <label>Date</label>
            <input
              type="date"
              value={modalDate}
              onChange={(e) => setModalDate(e.target.value)}
              disabled={!!editing}
            />
          </div>
          <ShiftForm
            key={editing?.id ?? modalDate}
            date={modalDate}
            existing={editing}
            settings={settings}
            onSave={handleSave}
            onDelete={editing ? handleDelete : undefined}
            onCancel={() => { setModalDate(null); setEditing(null); }}
          />
        </Modal>
      )}
    </div>
  );
}
