import { lazy, Suspense, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import ProtectdRoute from './components/ProtectdRoute.jsx';
import { ensureFirebaseConfigured, getFirebaseAuth } from './firebase.js';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const StoreFront = lazy(() => import('./pages/StoreFront.jsx'));

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    try {
      ensureFirebaseConfigured();
      return onAuthStateChanged(getFirebaseAuth(), (currentUser) => {
        setUser(currentUser);
        setCheckingAuth(false);
        setAuthError('');
      }, (error) => {
        setAuthError(error.message);
        setCheckingAuth(false);
      });
    } catch (error) {
      setAuthError(error.message);
      setCheckingAuth(false);
      return undefined;
    }
  }, []);

  async function handleSignOut() {
    try {
      await signOut(getFirebaseAuth());
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
          : user ? <Navigate to="/admin" replace /> : <Login onLogin={setUser} authError={authError} />
        } />
        <Route path="/admin" element={checkingAuth
          ? loading
          : <ProtectdRoute authenticated={Boolean(user)}><AdminDashboard onSignOut={handleSignOut} authError={authError} /></ProtectdRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
