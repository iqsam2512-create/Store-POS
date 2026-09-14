import { useEffect, useState } from 'react';
import { api, Settings } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getPosBridge } from '../bridge';
import { Key, useT } from '../i18n';
import PhotoPicker from '../components/PhotoPicker';

type Props = {
  settings: Settings | null;
  onSaved: () => Promise<void>;
};

const MODES = [
  'Standalone Point of Sale',
  'Network Point of Sale Server',
  'Network Point of Sale Terminal',
] as const;

export default function SettingsView({ settings, onSaved }: Props) {
  const { apiInfo, refreshApiInfo } = useAuth();
  const { t, lang, setLang } = useT();
  const [form, setForm] = useState({
    app: MODES[0] as string,
    store: '',
    address_one: '',
    address_two: '',
    contact: '',
    tax: '',
    symbol: 'د.ع',
    percentage: '0',
    charge_tax: false,
    footer: '',
    img: '',
    till: '1',
    ip: '',
    pexels_api_key: '',
  });
  const [lanIp, setLanIp] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const info = await refreshApiInfo();
      setLanIp(info.lanIp);
      const s = settings;
      setForm({
        app: s?.app || MODES[0],
        store: s?.store || '',
        address_one: s?.address_one || '',
        address_two: s?.address_two || '',
        contact: s?.contact || '',
        tax: s?.tax || '',
        symbol: s?.symbol || 'د.ع',
        percentage: String(s?.percentage ?? 0),
        charge_tax: !!s?.charge_tax,
        footer: s?.footer || '',
        img: s?.img || '',
        till: String(s?.till || info.till || 1),
        ip: s?.ip || info.serverIp || '',
        pexels_api_key: s?.pexels_api_key || '',
      });
    })();
  }, [settings]);

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'charge_tax') fd.append(k, form.charge_tax ? '1' : '0');
        else fd.append(k, String(v));
      });

      await getPosBridge().setLocalConfig({
        mode: form.app,
        serverIp: form.ip,
        till: parseInt(form.till, 10) || 1,
      });

      try {
        await api.saveSettings(fd);
      } catch (err) {
        // A terminal has no local DB; local prefs are still saved.
        if (form.app !== 'Network Point of Sale Terminal') throw err;
      }

      setMessage(t('set.saved'));
      await refreshApiInfo();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('set.saveFailed'));
    }
  };

  const isTerminal = form.app === 'Network Point of Sale Terminal';
  const isServer = form.app === 'Network Point of Sale Server';

  const seedDemo = async () => {
    setError(null);
    setMessage(null);
    setDemoBusy(true);
    try {
      const result = await api.seedDemo();
      setMessage(
        t('cat.seeded', {
          p: result.productsAdded,
          c: result.categoriesAdded,
          u: result.customersAdded,
        })
      );
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cat.seedFailed'));
    } finally {
      setDemoBusy(false);
    }
  };

  const clearDemo = async () => {
    if (!confirm(t('set.wipeConfirm'))) return;
    setError(null);
    setMessage(null);
    setDemoBusy(true);
    try {
      await api.clearDemo();
      setMessage(t('set.cleared'));
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('set.clearFailed'));
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="panel" style={{ padding: '1.25rem', maxWidth: 880 }}>
      {error && <div className="error">{error}</div>}
      {message && <div className="notice">{message}</div>}

      <div className="page-grid">
        <div>
          <h3 style={{ marginTop: 0 }}>{t('set.store')}</h3>
          <div className="field">
            <label>{t('set.storeName')}</label>
            <input
              value={form.store}
              onChange={(e) => setForm({ ...form, store: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{t('set.address')}</label>
            <input
              value={form.address_one}
              onChange={(e) => setForm({ ...form, address_one: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{t('set.address2')}</label>
            <input
              value={form.address_two}
              onChange={(e) => setForm({ ...form, address_two: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{t('set.contact')}</label>
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              dir="ltr"
              inputMode="tel"
            />
          </div>
          <div className="field">
            <label>{t('set.footer')}</label>
            <input
              value={form.footer}
              onChange={(e) => setForm({ ...form, footer: e.target.value })}
              placeholder={t('receipt.thanks')}
            />
          </div>
          <PhotoPicker
            label={t('set.logo')}
            value={form.img}
            onChange={(img) => setForm({ ...form, img })}
            suggestedQuery={form.store || 'store logo'}
          />
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>{t('set.register')}</h3>
          <div className="field">
            <label>{t('set.language')}</label>
            <select value={lang} onChange={(e) => setLang(e.target.value as 'ar' | 'en')}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="field">
            <label>{t('set.mode')}</label>
            <select value={form.app} onChange={(e) => setForm({ ...form, app: e.target.value })}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`mode.${m.replace(' Point of Sale', '')}` as Key)}
                </option>
              ))}
            </select>
          </div>
          {isTerminal && (
            <div className="field">
              <label>{t('set.serverIp')}</label>
              <input
                value={form.ip}
                onChange={(e) => setForm({ ...form, ip: e.target.value })}
                placeholder="192.168.1.10"
                dir="ltr"
              />
            </div>
          )}
          {isServer && (
            <p className="muted">
              {t('set.terminalsConnect')} <strong className="num-ltr">{lanIp}</strong>
            </p>
          )}
          <div className="field">
            <label>{t('set.tillNumber')}</label>
            <input
              type="number"
              min={1}
              className="num-ltr"
              value={form.till}
              onChange={(e) => setForm({ ...form, till: e.target.value })}
            />
          </div>
          <div className="field">
            <label>{t('set.symbol')}</label>
            <input
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            />
          </div>
          <label
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}
          >
            <input
              type="checkbox"
              checked={form.charge_tax}
              onChange={(e) => setForm({ ...form, charge_tax: e.target.checked })}
            />
            {t('set.chargeTax')}
          </label>
          {form.charge_tax && (
            <>
              <div className="field">
                <label>{t('set.taxLabel')}</label>
                <input
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('set.taxPct')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className="num-ltr"
                  value={form.percentage}
                  onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                />
              </div>
            </>
          )}
          {apiInfo && (
            <p className="muted num-ltr" style={{ fontSize: '0.85rem' }}>
              API {apiInfo.baseUrl}
            </p>
          )}

          <h3>{t('set.media')}</h3>
          <div className="field">
            <label>{t('set.pexelsKey')}</label>
            <input
              type="password"
              value={form.pexels_api_key}
              onChange={(e) => setForm({ ...form, pexels_api_key: e.target.value })}
              placeholder={t('set.pexelsPlaceholder')}
              autoComplete="off"
              dir="ltr"
            />
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            {t('set.pexelsHelp')}{' '}
            <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" dir="ltr">
              pexels.com/api
            </a>
          </p>
        </div>
      </div>

      <button type="button" className="btn btn-primary" onClick={save} style={{ marginTop: '1rem' }}>
        {t('set.save')}
      </button>

      <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--line)' }}>
        <h3 style={{ marginTop: 0 }}>{t('set.demo')}</h3>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 0 }}>
          {t('set.demoHelp')}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" disabled={demoBusy} onClick={seedDemo}>
            {t('set.seed')}
          </button>
          <button type="button" className="btn btn-danger" disabled={demoBusy} onClick={clearDemo}>
            {t('set.wipe')}
          </button>
        </div>
      </div>
    </div>
  );
}
