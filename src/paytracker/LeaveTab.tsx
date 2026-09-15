import React, { useMemo } from 'react';
import { buildLeaveLedger } from './leaveLedger';
import { PaySettings, ShiftEntry } from './types';
import { formatDateLabel, formatHours } from './utils';

interface Props {
  shifts: ShiftEntry[];
  settings: PaySettings;
}

export default function LeaveTab({ shifts, settings }: Props) {
  const ledger = useMemo(() => buildLeaveLedger(shifts, settings), [shifts, settings]);
  const latest = ledger[ledger.length - 1];

  return (
    <div>
      <div className="pt-card">
        <h2>Current leave balances</h2>
        <div className="pt-inline-note">
          Estimated from your opening balance, hours worked, and leave taken since {formatDateLabel(settings.leave.openingBalanceAsOfDate)}.
          Set your real opening balances in Settings from a recent payslip for accuracy.
        </div>
        <div className="pt-grid">
          <div className="pt-stat">
            <div className="label">Annual leave</div>
            <div className="value">{latest ? formatHours(latest.annualBalance) : formatHours(settings.leave.openingAnnualBalanceHours)}</div>
          </div>
          <div className="pt-stat">
            <div className="label">Personal / sick</div>
            <div className="value">{latest ? formatHours(latest.personalBalance) : formatHours(settings.leave.openingPersonalBalanceHours)}</div>
          </div>
        </div>
      </div>

      <div className="pt-card">
        <h2>Fortnightly ledger</h2>
        {ledger.length === 0 && <div className="pt-empty">No leave history yet.</div>}
        <div style={{ overflowX: 'auto' }}>
          <table className="pt-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Hrs worked</th>
                <th>AL accrued</th>
                <th>AL taken</th>
                <th>AL balance</th>
                <th>PL accrued</th>
                <th>PL taken</th>
                <th>PL balance</th>
              </tr>
            </thead>
            <tbody>
              {[...ledger].reverse().map((row) => (
                <tr key={row.period.index}>
                  <td>{formatDateLabel(row.period.start)}</td>
                  <td>{row.hoursForAccrual}</td>
                  <td>{row.annualAccrued}</td>
                  <td>{row.annualTaken}</td>
                  <td><strong>{row.annualBalance}</strong></td>
                  <td>{row.personalAccrued}</td>
                  <td>{row.personalTaken}</td>
                  <td><strong>{row.personalBalance}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
