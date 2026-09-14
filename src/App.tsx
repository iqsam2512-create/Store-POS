import { useAuth } from './context/AuthContext';
import { useT } from './i18n';
import LoginPage from './pages/LoginPage';
import PosPage from './pages/PosPage';

export default function App() {
  const { ready, user } = useAuth();
  const { t } = useT();

  if (!ready) {
    return (
      <div className="login-wrap">
        <div className="panel login-card">
          <h1>{t('app.name')}</h1>
          <p>{t('app.starting')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <PosPage />;
}
