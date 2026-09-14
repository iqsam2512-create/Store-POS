import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPosBridge } from '../bridge';
import { Key, useT } from '../i18n';

const MODES = [
  'Standalone Point of Sale',
  'Network Point of Sale Server',
  'Network Point of Sale Terminal',
] as const;

export default function LoginPage() {
  const { login, serverError, apiInfo, refreshApiInfo } = useAuth();
  const { t, lang, setLang } = useT();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showConn, setShowConn] = useState(false);
  const [mode, setMode] = useState(apiInfo?.mode || MODES[0]);
  const [serverIp, setServerIp] = useState(apiInfo?.serverIp || '');
  const [connMsg, setConnMsg] = useState<string | null>(null);

  // AuthContext stores "key|ip" so the message can be rendered in the active language.
  const renderServerError = (raw: string) => {
    const [key, ip] = raw.split('|');
    if (key === 'err.terminalUnreachable') return t(key, { ip: ip || t('err.noIp') });
    if (key === 'err.localApi') return t(key);
    return raw;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await refreshApiInfo();
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
    } finally {
      setBusy(false);
    }
  };

  const saveConnection = async () => {
    setConnMsg(null);
    await getPosBridge().setLocalConfig({
      mode,
      serverIp,
      till: apiInfo?.till || 1,
    });
    setConnMsg(t('login.savedRestart'));
    await refreshApiInfo();
  };

  const needsConn =
    Boolean(serverError) ||
    apiInfo?.mode === 'Network Point of Sale Terminal';

  return (
    <div className="login-wrap">
      <form className="panel login-card" onSubmit={onSubmit}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
          <button
            type="button"
            className={`btn btn-ghost ${lang === 'ar' ? 'active' : ''}`}
            onClick={() => setLang('ar')}
            style={{ fontWeight: lang === 'ar' ? 700 : 400 }}
          >
            عربي
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setLang('en')}
            style={{ fontWeight: lang === 'en' ? 700 : 400 }}
          >
            EN
          </button>
        </div>
        <h1>{t('app.name')}</h1>
        <p>{t('login.subtitle')}</p>

        {(serverError || error) && (
          <div className="error">{serverError ? renderServerError(serverError) : error}</div>
        )}

        <div className="field">
          <label htmlFor="username">{t('login.username')}</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            dir="ltr"
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t('login.password')}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            dir="ltr"
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? t('login.busy') : t('login.submit')}
        </button>

        {(needsConn || showConn) && (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', marginBottom: '0.75rem' }}
              onClick={() => setShowConn((v) => !v)}
            >
              {showConn ? t('login.hide') : t('login.network')}
            </button>
            {showConn && (
              <>
                <div className="field">
                  <label>{t('login.mode')}</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    {MODES.map((m) => (
                      <option key={m} value={m}>
                        {t(`mode.${m.replace(' Point of Sale', '')}` as Key)}
                      </option>
                    ))}
                  </select>
                </div>
                {mode === 'Network Point of Sale Terminal' && (
                  <div className="field">
                    <label>{t('login.serverIp')}</label>
                    <input
                      value={serverIp}
                      onChange={(e) => setServerIp(e.target.value)}
                      placeholder="192.168.1.10"
                      dir="ltr"
                    />
                  </div>
                )}
                {connMsg && <p className="muted">{connMsg}</p>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-primary" onClick={saveConnection}>
                    {t('common.save')}
                  </button>
                  <button type="button" className="btn" onClick={() => refreshApiInfo()}>
                    {t('common.retry')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
