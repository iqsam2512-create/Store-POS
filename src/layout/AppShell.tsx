import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPosBridge } from '../bridge';
import { getUploadsBase } from '../api/client';
import { Key, useT } from '../i18n';

export type NavView =
  | 'till'
  | 'catalog'
  | 'sales'
  | 'customers'
  | 'team'
  | 'settings';

type Props = {
  view: NavView;
  onNavigate: (view: NavView) => void;
  title: string;
  stats?: ReactNode;
  children: ReactNode;
  todaySales?: string;
  logo?: string;
  storeName?: string;
};

export default function AppShell({
  view,
  onNavigate,
  title,
  stats,
  children,
  todaySales,
  logo,
  storeName,
}: Props) {
  const { user, logout, hasPerm, apiInfo } = useAuth();
  const { t, lang, setLang } = useT();
  const logoSrc = logo ? `${getUploadsBase()}/${logo}` : '';

  const items: { id: NavView; label: Key; show: boolean }[] = [
    { id: 'till', label: 'nav.till', show: true },
    { id: 'catalog', label: 'nav.catalog', show: hasPerm('perm_products') || hasPerm('perm_categories') },
    { id: 'sales', label: 'nav.sales', show: hasPerm('perm_transactions') },
    { id: 'customers', label: 'nav.customers', show: true },
    { id: 'team', label: 'nav.team', show: hasPerm('perm_users') },
    { id: 'settings', label: 'nav.settings', show: hasPerm('perm_settings') },
  ];

  const modeShort = (apiInfo?.mode || 'Standalone Point of Sale').replace(' Point of Sale', '');

  return (
    <div className="app">
      <aside className="nav">
        <div className="nav-brand">
          <div className="nav-brand-row">
            {logoSrc ? (
              <img className="nav-logo" src={logoSrc} alt="" />
            ) : (
              <div className="nav-logo nav-logo-fallback" aria-hidden />
            )}
            <div className="nav-brand-text">
              <strong>{storeName || t('app.name')}</strong>
              <span>{t(`mode.${modeShort}` as Key)}</span>
            </div>
          </div>
        </div>
        {items
          .filter((i) => i.show)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-btn ${view === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {t(item.label)}
            </button>
          ))}
        <div className="nav-spacer" />
        <div className="lang-switch" role="group" aria-label={t('nav.language')}>
          <button
            type="button"
            className={lang === 'ar' ? 'active' : ''}
            onClick={() => setLang('ar')}
          >
            عربي
          </button>
          <button
            type="button"
            className={lang === 'en' ? 'active' : ''}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
        <button type="button" className="nav-btn" onClick={() => logout()}>
          {t('nav.signout')}
        </button>
        <button type="button" className="nav-btn" onClick={() => getPosBridge().quit()}>
          {t('nav.quit')}
        </button>
        <div className="nav-meta">
          <div>{user?.fullname}</div>
          <div>{t('nav.tillNo', { n: apiInfo?.till || 1 })}</div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <h1>{title}</h1>
          {stats}
          <div className="spacer" />
          {todaySales != null && (
            <div className="stat-pill money">{t('top.today', { amount: todaySales })}</div>
          )}
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
