import { useEffect, useMemo, useState } from 'react';
import {
  api,
  Category,
  Customer,
  Product,
  Settings,
  Transaction,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Key, useT } from '../i18n';
import { formatMoney } from '../money';
import AppShell, { NavView } from '../layout/AppShell';
import TillView from './TillView';
import CatalogView from './CatalogView';
import SettingsView from './SettingsView';
import TransactionsModal from '../components/TransactionsModal';

export default function PosPage() {
  const { hasPerm } = useAuth();
  const { t } = useT();
  const [view, setView] = useState<NavView>('till');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [holdCount, setHoldCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);

  const symbol = settings?.symbol || 'د.ع';

  const loadAll = async () => {
    const [p, c, cust, s] = await Promise.all([
      api.getProducts(),
      api.getCategories(),
      api.getCustomers(),
      api.getSettings(),
    ]);
    setProducts(p);
    setCategories(c);
    setCustomers(cust);
    setSettings(s.settings);

    if (hasPerm('perm_transactions')) {
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const sales = await api.getByDate({
          start: start.toISOString(),
          end: new Date().toISOString(),
          user: 0,
          till: 0,
          status: 1,
        });
        setTodayTotal(sales.reduce((sum: number, t: Transaction) => sum + Number(t.total || 0), 0));
      } catch {
        /* cashiers without perm already filtered */
      }
    }

    try {
      const holds = await api.getOnHold();
      setHoldCount(holds.length);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadAll().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (settings && !settings.store && hasPerm('perm_settings')) {
      setView('settings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const title = useMemo(() => {
    switch (view) {
      case 'till':
        return t('title.till');
      case 'catalog':
        return t('nav.catalog');
      case 'sales':
        return t('title.sales');
      case 'customers':
        return t('nav.customers');
      case 'team':
        return t('nav.team');
      case 'settings':
        return t('nav.settings');
      default:
        return t('app.name');
    }
  }, [view, settings, t]);

  return (
    <AppShell
      view={view}
      onNavigate={setView}
      title={title}
      logo={settings?.img || ''}
      storeName={settings?.store}
      todaySales={
        hasPerm('perm_transactions') ? formatMoney(todayTotal, symbol) : undefined
      }
      stats={
        view === 'till' && holdCount > 0 ? (
          <span className="stat-pill">{t('top.held', { n: holdCount })}</span>
        ) : null
      }
    >
      {error && (
        <div className="error">
          {error}{' '}
          <button type="button" className="btn btn-ghost" onClick={() => setError(null)}>
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {view === 'till' && (
        <TillView
          products={products}
          categories={categories}
          customers={customers}
          settings={settings}
          holdCount={holdCount}
          onHoldCount={setHoldCount}
          onRefresh={loadAll}
        />
      )}

      {view === 'catalog' && (
        <CatalogView
          products={products}
          categories={categories}
          symbol={symbol}
          canProducts={hasPerm('perm_products')}
          canCategories={hasPerm('perm_categories')}
          onChanged={loadAll}
        />
      )}

      {view === 'sales' && (
        <TransactionsModal
          embedded
          open
          symbol={symbol}
          onClose={() => setView('till')}
        />
      )}

      {view === 'customers' && (
        <CustomersPanel customers={customers} onChanged={loadAll} />
      )}

      {view === 'team' && <UsersPanel />}

      {view === 'settings' && (
        <SettingsView settings={settings} onSaved={loadAll} />
      )}
    </AppShell>
  );
}

function CustomersPanel({
  customers,
  onChanged,
}: {
  customers: Customer[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useT();
  const [list, setList] = useState(customers);
  const [form, setForm] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => setList(customers), [customers]);

  const save = async () => {
    if (!form.name.trim()) return;
    if (form.id) {
      await api.updateCustomer({
        _id: form.id,
        id: Number(form.id),
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
      });
    } else {
      await api.saveCustomer({
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
      });
    }
    setForm({ id: '', name: '', phone: '', email: '', address: '' });
    await onChanged();
  };

  const remove = async (id: number) => {
    if (!confirm(t('cust.delete'))) return;
    await api.deleteCustomer(id);
    await onChanged();
  };

  return (
    <div className="page-grid">
      <div className="panel" style={{ padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{form.id ? t('cust.edit') : t('cust.new')}</h3>
        <div className="field">
          <label>{t('common.name')}</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>{t('common.phone')}</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            dir="ltr"
            inputMode="tel"
          />
        </div>
        <div className="field">
          <label>{t('common.email')}</label>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            dir="ltr"
          />
        </div>
        <div className="field">
          <label>{t('common.address')}</label>
          <textarea
            rows={3}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={save}>
          {form.id ? t('cust.update') : t('cust.add')}
        </button>
      </div>
      <div className="panel" style={{ padding: '1rem' }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.phone')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list
              .filter((c) => c.name !== 'Walk-in Customer')
              .map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="num-ltr">{c.phone}</td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        setForm({
                          id: String(c.id),
                          name: c.name,
                          phone: c.phone,
                          email: c.email,
                          address: c.address,
                        })
                      }
                    >
                      {t('common.edit')}
                    </button>{' '}
                    <button type="button" className="btn btn-danger" onClick={() => remove(c.id)}>
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersPanel() {
  const { t } = useT();
  const [list, setList] = useState<Awaited<ReturnType<typeof api.getUsers>>>([]);
  const emptyForm = {
    id: '',
    username: '',
    password: '',
    fullname: '',
    perm_products: true,
    perm_categories: true,
    perm_transactions: true,
    perm_users: false,
    perm_settings: false,
  };
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const load = async () => setList(await api.getUsers());

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const save = async () => {
    setError(null);
    if (!form.username.trim() || !form.fullname.trim()) {
      setError(t('team.required'));
      return;
    }
    if (!form.id && !form.password) {
      setError(t('team.pwRequired'));
      return;
    }
    try {
      await api.saveUser({ ...form });
      await load();
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('team.saveFailed'));
    }
  };

  const perms = [
    'perm_products',
    'perm_categories',
    'perm_transactions',
    'perm_users',
    'perm_settings',
  ] as const;

  return (
    <div className="page-grid">
      <div className="panel" style={{ padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{form.id ? t('team.edit') : t('team.new')}</h3>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>{t('team.username')}</label>
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            dir="ltr"
          />
        </div>
        <div className="field">
          <label>{t('team.fullname')}</label>
          <input
            value={form.fullname}
            onChange={(e) => setForm({ ...form, fullname: e.target.value })}
          />
        </div>
        <div className="field">
          <label>
            {t('team.password')} {form.id ? t('team.keep') : ''}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            dir="ltr"
          />
        </div>
        {perms.map((key) => (
          <label
            key={key}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}
          >
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
            />
            {t(`perm.${key}` as Key)}
          </label>
        ))}
        <button type="button" className="btn btn-primary" onClick={save} style={{ marginTop: '0.75rem' }}>
          {form.id ? t('team.update') : t('team.add')}
        </button>
      </div>
      <div className="panel" style={{ padding: '1rem' }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('team.colUser')}</th>
              <th>{t('team.colName')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td className="num-ltr">{u.username}</td>
                <td>{u.fullname}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setForm({
                        id: String(u.id),
                        username: u.username,
                        password: '',
                        fullname: u.fullname,
                        perm_products: !!u.perm_products,
                        perm_categories: !!u.perm_categories,
                        perm_transactions: !!u.perm_transactions,
                        perm_users: !!u.perm_users,
                        perm_settings: !!u.perm_settings,
                      })
                    }
                  >
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
