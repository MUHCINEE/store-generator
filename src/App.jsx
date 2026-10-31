import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ProtectdRoute from './components/ProtectdRoute.jsx';
import Login from './pages/Login.jsx';
import StoreFront from './pages/StoreFront.jsx';
import { apiRequest } from './utils/storage.js';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const handleExpiredSession = () => setAuthenticated(false);
    window.addEventListener('atelier:session-expired', handleExpiredSession);
    apiRequest('/api/auth/session')
      .then(({ authenticated: isAuthenticated }) => {
        if (active) setAuthenticated(isAuthenticated);
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
      window.removeEventListener('atelier:session-expired', handleExpiredSession);
    };
  }, []);

  async function signOut() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      setAuthenticated(false);
      navigate('/login');
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <Routes>
      <Route path="/" element={<StoreFront />} />
      <Route path="/storefront" element={<StoreFront />} />
      <Route path="/store/:slug" element={<StoreFront />} />
      <Route path="/login" element={checkingSession
        ? <div className="page-loading"><span className="spinner" />Checking your session…</div>
        : authenticated ? <Navigate to="/admin" replace /> : <Login onLogin={() => setAuthenticated(true)} />
      } />
      <Route path="/admin" element={checkingSession
        ? <div className="page-loading"><span className="spinner" />Checking your session…</div>
        : <ProtectdRoute authenticated={authenticated}><AdminDashboard onSignOut={signOut} /></ProtectdRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}