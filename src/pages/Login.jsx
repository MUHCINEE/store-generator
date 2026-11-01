import { useState } from 'react';
import { ArrowLeft, ArrowRight, Leaf, LockKeyhole } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from '../utils/storage.js';

export default function Login({ onLogin, authError = '' }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await signIn(identifier.trim(), password);
      onLogin(user);
      navigate('/admin', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Sign-in failed. Check your connection and try again.');
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
          <label htmlFor="identifier">Email or username</label>
          <input id="identifier" name="username" type="text" autoComplete="username" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {(error || authError) && <p className="form-error" role="alert">{error || authError}</p>}
          <button className="button button-primary login-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Enter your studio'} {!loading && <ArrowRight size={16} />}
          </button>
        </form>
        <div className="login-security"><LockKeyhole size={14} /> Your studio is private and protected.</div>
        <p className="login-register">New around here? <Link to="/register">Create your store</Link></p>
      </section>
      <p className="login-footer">A little more room for beautiful things.</p>
    </main>
  );
}