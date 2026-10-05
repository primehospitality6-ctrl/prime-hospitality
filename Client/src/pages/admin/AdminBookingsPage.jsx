import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Download } from 'lucide-react';
import api from '../../api/client';
import { AdminPageHeader } from '../../components/admin/AdminUi';
import { formatMoney } from '../../theme/brand';
import { cn } from '../../utils/cn';

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(fields, items) {
  const header = fields.map((f) => csvCell(f.label)).join(',');
  const rows = items.map((b) => b.pms.map((r) => csvCell(r.value)).join(','));
  const blob = new Blob([`\uFEFF${[header, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `website-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_STYLES = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};

/** Website bookings with the 17 PMS data fields, in sheet order */
export default function AdminBookingsPage() {
  const [fields, setFields] = useState([]);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .adminGetBookings()
      .then((data) => {
        setFields(data.fields || []);
        setItems(data.items || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((b) =>
      [b.voucherNumber, b.primaryGuestName, b.email, b.phone, b.property, b.destination]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [items, query]);

  const issues = useMemo(() => items.filter((b) => b.kwentraIssue), [items]);

  return (
    <div>
      <AdminPageHeader
        title="Bookings"
        lede="Every reservation made on the website, with the PMS data fields sent to Kwentra. Channel is always “Website”."
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              className="prime-input w-64"
              placeholder="Search voucher, guest, property…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              disabled={!visible.length}
              onClick={() => downloadCsv(fields, visible)}
              className="inline-flex items-center gap-2 border border-prime-line px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:border-prime-gold disabled:opacity-40"
            >
              <Download size={13} aria-hidden />
              Export CSV
            </button>
          </div>
        }
      />
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {issues.length ? (
        <div className="mb-4 flex items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              {issues.length === 1 ? '1 booking needs' : `${issues.length} bookings need`} attention in Kwentra
            </p>
            <ul className="mt-1 space-y-0.5 text-[13px]">
              {issues.slice(0, 5).map((b) => (
                <li key={b.id}>
                  <button type="button" className="text-start underline-offset-2 hover:underline" onClick={() => setOpen(b.id)}>
                    <span className="font-semibold tabular-nums">{b.voucherNumber || b.id}</span> — {b.kwentraIssue}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto border border-prime-line bg-prime-surface">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-prime-line text-[11px] uppercase tracking-[0.16em] text-prime-muted">
            <tr>
              <th className="px-3 py-3">Voucher</th>
              <th className="px-3 py-3">Primary guest</th>
              <th className="px-3 py-3">Property · Room type</th>
              <th className="px-3 py-3">Stay</th>
              <th className="px-3 py-3">Guests</th>
              <th className="px-3 py-3">Rate plan</th>
              <th className="px-3 py-3 text-end">Amount</th>
              <th className="px-3 py-3">Payment</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => {
              const expanded = open === b.id;
              return (
                <Fragment key={b.id}>
                  <tr
                    className={cn('cursor-pointer border-b border-prime-line/70 hover:bg-prime-mist/40', expanded && 'bg-prime-mist/50')}
                    onClick={() => setOpen(expanded ? null : b.id)}
                  >
                    <td className="px-3 py-3 font-semibold tabular-nums">{b.voucherNumber || '—'}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{b.primaryGuestName}</p>
                      <p className="text-xs text-prime-muted">{b.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{b.property}</p>
                      <p className="text-xs text-prime-muted">
                        {[b.roomType, b.destination].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {b.arrivalDate} → {b.departureDate}
                      <p className="text-xs text-prime-muted">{b.nights} nights</p>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {b.adults}A{b.children ? ` · ${b.children}C` : ''}
                    </td>
                    <td className="px-3 py-3">{b.ratePlanName}</td>
                    <td className="px-3 py-3 text-end tabular-nums">{formatMoney(b.rateAmount, b.rateCurrency)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
                          STATUS_STYLES[b.paymentStatus] || 'border-prime-line text-prime-muted'
                        )}
                      >
                        {b.paymentStatus || b.status || '—'}
                      </span>
                      {b.kwentraIssue ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                          <AlertTriangle size={12} aria-hidden />
                          Needs attention
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-end">
                      <ChevronDown size={15} className={cn('inline transition', expanded && 'rotate-180')} aria-hidden />
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-prime-line bg-prime-sand">
                      <td colSpan={9} className="px-5 py-4">
                        {b.kwentraIssue ? (
                          <p className="mb-4 flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                            <span>
                              {b.kwentraIssue}
                              {b.kwentraReservationId ? ` (Kwentra reservation ${b.kwentraReservationId})` : ''}
                            </span>
                          </p>
                        ) : null}
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-prime-muted">
                          PMS data fields
                        </p>
                        <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                          {b.pms.map((row) => (
                            <div key={row.no} className="flex justify-between gap-4 border-b border-prime-line/70 py-2 text-[13px]">
                              <dt className="text-prime-muted">
                                <span className="me-1.5 tabular-nums text-prime-muted/70">{row.no}.</span>
                                {row.field}
                                {row.required ? <span className="text-prime-gold-deep"> *</span> : null}
                              </dt>
                              <dd className="m-0 text-end font-medium">{String(row.value ?? '') || '—'}</dd>
                            </div>
                          ))}
                        </dl>
                        {(b.phone || b.notes) && (
                          <p className="mt-3 text-xs text-prime-muted">
                            {b.phone ? `Phone: ${b.phone}` : ''}
                            {b.phone && b.notes ? ' · ' : ''}
                            {b.notes ? `Requests: ${b.notes}` : ''}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!loading && !visible.length && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-prime-muted">
                  No website bookings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
