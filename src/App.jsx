import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import ProtectdRoute from './components/ProtectdRoute.jsx';
import { getCurrentUser, signOutAccount } from './utils/storage.js';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const StoreFront = lazy(() => import('./pages/StoreFront.jsx'));

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();

  function handleLogin(currentUser) {
    setUser(currentUser);
    setAuthError('');
  }

  useEffect(() => {
    let active = true;
    getCurrentUser().then((currentUser) => {
      if (!active) return;
      setUser(currentUser);
      setAuthError('');
    }).catch((error) => {
      if (!active) return;
      setAuthError(error.message);
    }).finally(() => {
      if (active) setCheckingAuth(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    try {
      await signOutAccount();
      setUser(null);
      navigate('/login', { replace: true });
    } catch (error) {
      setAuthError(error.message);
    }
  }

  const loading = <div className="page-loading"><span className="spinner" />Checking your session…</div>;

  return (
    <Suspense fallback={loading}>
      <Routes>
        <Route path="/" element={<StoreFront />} />
        <Route path="/storefront" element={<StoreFront />} />
        <Route path="/store/:slug" element={<StoreFront />} />
        <Route path="/login" element={checkingAuth
          ? loading
          : user ? <Navigate to="/admin" replace /> : <Login onLogin={handleLogin} authError={authError} />
        } />
        <Route path="/register" element={checkingAuth
          ? loading
          : user ? <Navigate to="/admin" replace /> : <Register onLogin={handleLogin} />
        } />
        <Route path="/admin" element={checkingAuth
          ? loading
          : <ProtectdRoute authenticated={Boolean(user)}><AdminDashboard user={user} onSignOut={handleSignOut} authError={authError} /></ProtectdRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
