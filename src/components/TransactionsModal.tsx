import { useEffect, useState } from 'react';
import { api, Transaction, User } from '../api/client';
import { useT } from '../i18n';
import { formatDateTime, formatMoney } from '../money';
import Modal from './Modal';

type Props = {
  open?: boolean;
  embedded?: boolean;
  onClose: () => void;
  users?: User[];
  symbol: string;
};

/** Format a Date for <input type="datetime-local"> in local time. */
function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local value as local time → ISO UTC for the API. */
function localInputToIso(value: string, endOfMinute = false) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  if (endOfMinute) d.setSeconds(59, 999);
  return d.toISOString();
}

function defaultRange() {
  // Default to today: that's the question a shop owner asks first.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 0, 0);
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) };
}

export default function TransactionsModal({
  open = true,
  embedded = false,
  onClose,
  symbol,
}: Props) {
  const { t } = useT();
  const initial = defaultRange();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [userId, setUserId] = useState(0);
  const [till, setTill] = useState(0);
  const [status, setStatus] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [list, allUsers] = await Promise.all([
        api.getByDate({
          start: localInputToIso(start),
          end: localInputToIso(end, true),
          user: userId,
          till,
          status,
        }),
        api.getUsers().catch(() => [] as User[]),
      ]);
      setRows(list);
      setUsers(allUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sales.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open || embedded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on open; Filter button refreshes
  }, [open, embedded]);

  const sum = rows.reduce((n, r) => n + Number(r.total || 0), 0);

  const body = (
    <>
      {error && <div className="error">{error}</div>}
      <div className="filters">
        <div className="field">
          <label>{t('sales.from')}</label>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} dir="ltr" />
        </div>
        <div className="field">
          <label>{t('sales.to')}</label>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} dir="ltr" />
        </div>
        <div className="field">
          <label>{t('sales.cashier')}</label>
          <select value={userId} onChange={(e) => setUserId(Number(e.target.value))}>
            <option value={0}>{t('common.all')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullname}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('sales.till')}</label>
          <input
            type="number"
            min={0}
            className="num-ltr"
            value={till}
            onChange={(e) => setTill(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>{t('sales.status')}</label>
          <select value={status} onChange={(e) => setStatus(Number(e.target.value))}>
            <option value={1}>{t('sales.paid')}</option>
            <option value={0}>{t('sales.unpaid')}</option>
          </select>
        </div>
        <button className="btn btn-primary" type="button" onClick={load} disabled={loading}>
          {loading ? t('common.loading') : t('sales.filter')}
        </button>
      </div>
      {rows.length > 0 && (
        <p className="muted" style={{ margin: '0 0 0.5rem' }}>
          {t('sales.sum', { n: rows.length, amount: formatMoney(sum, symbol) })}
        </p>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>{t('sales.colId')}</th>
            <th>{t('sales.colDate')}</th>
            <th>{t('sales.cashier')}</th>
            <th>{t('sales.till')}</th>
            <th>{t('sales.colCustomer')}</th>
            <th>{t('sales.colTotal')}</th>
            <th>{t('sales.colPaid')}</th>
            <th>{t('sales.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="num-ltr">{r.id}</td>
              <td className="num-ltr">{formatDateTime(r.date)}</td>
              <td>{r.user}</td>
              <td className="num-ltr">{r.till}</td>
              <td>{r.customer_name}</td>
              <td className="money">{formatMoney(Number(r.total), symbol)}</td>
              <td className="money">{formatMoney(Number(r.paid), symbol)}</td>
              <td>{r.status === 1 ? t('sales.paid') : t('sales.open')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && !loading && <div className="empty">{t('sales.empty')}</div>}
    </>
  );

  if (embedded) {
    return (
      <div className="panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <strong>{t('sales.title')}</strong>
          <button className="btn" type="button" onClick={onClose}>
            {t('sales.back')}
          </button>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Modal title={t('sales.title')} open={open} onClose={onClose} wide>
      {body}
    </Modal>
  );
}
