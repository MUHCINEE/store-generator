import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowLeft, ArrowRight, Leaf, LockKeyhole } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ensureFirebaseConfigured, getFirebaseAuth } from '../firebase.js';

export default function Login({ onLogin, authError = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      ensureFirebaseConfigured();
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      onLogin(credential.user);
      navigate('/admin', { replace: true });
    } catch (requestError) {
      const messages = {
        'auth/invalid-credential': 'That email and password combination did not match.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/too-many-requests': 'Too many sign-in attempts. Please wait and try again.',
        'auth/network-request-failed': 'Could not reach Firebase. Check your connection and try again.'
      };
      setError(messages[requestError.code] || requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to the shop</Link>
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark brand-mark-large"><Leaf size={21} /></span><span className="eyebrow">THE OWNER'S STUDIO</span></div>
        <h1>Good to have<br />you back.</h1>
        <p className="login-intro">Sign in to tend your little corner of the internet.</p>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {(error || authError) && <p className="form-error" role="alert">{error || authError}</p>}
          <button className="button button-primary login-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Enter your studio'} {!loading && <ArrowRight size={16} />}
          </button>
        </form>
        <div className="login-security"><LockKeyhole size={14} /> Your studio is private and protected.</div>
      </section>
      <p className="login-footer">A little more room for beautiful things.</p>
    </main>
  );
}