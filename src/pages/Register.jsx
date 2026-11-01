import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Leaf } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createAccount, isUsernameAvailable } from '../utils/storage.js';

const initialForm = {
  fullName: '',
  origin: '',
  age: '',
  email: '',
  phoneNumber: '',
  projectType: '',
  username: '',
  password: ''
};

function passwordScore(password) {
  return [
    password.length >= 10,
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
    /[A-Z]/.test(password) && /[a-z]/.test(password)
  ].filter(Boolean).length;
}

function registrationError(error) {
  return error?.message || 'Your account could not be created. Please try again.';
}

export default function Register({ onLogin }) {
  const [form, setForm] = useState(initialForm);
  const [usernameState, setUsernameState] = useState({ checking: false, available: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const strength = passwordScore(form.password);
  const strengthLabel = !form.password || strength < 3 ? 'Weak' : strength === 3 ? 'Medium' : 'Strong';
  const validPassword = form.password.length >= 10
    && /[0-9]/.test(form.password)
    && /[^A-Za-z0-9]/.test(form.password);
  const username = form.username.trim();
  const usernameLower = username.toLowerCase();
  const validUsername = /^[a-zA-Z0-9_-]{3,24}$/.test(username);

  const strengthClass = useMemo(
    () => `password-strength password-strength-${strengthLabel.toLowerCase()}`,
    [strengthLabel]
  );

  async function checkUsername() {
    if (!validUsername) {
      setUsernameState({ checking: false, available: null });
      return;
    }
    setUsernameState({ checking: true, available: null });
    setError('');
    try {
      const available = await isUsernameAvailable(usernameLower);
      setUsernameState({ checking: false, available });
    } catch (requestError) {
      setUsernameState({ checking: false, available: null });
      setError(registrationError(requestError));
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!validUsername) {
      setError('Use 3–24 letters, numbers, hyphens, or underscores for your username.');
      return;
    }
    if (!form.fullName.trim() || !form.origin.trim() || !form.phoneNumber.trim()) {
      setError('Complete your name, origin or city, and phone number before continuing.');
      return;
    }
    if (!validPassword) {
      setError('Use at least 10 characters, including a number and a special character.');
      return;
    }
    if (!form.projectType) {
      setError('Choose the type of project you are building.');
      return;
    }

    setLoading(true);
    try {
      if (!(await isUsernameAvailable(usernameLower))) {
        setUsernameState({ checking: false, available: false });
        setError('That username is already taken. Choose another one.');
        return;
      }

      const user = await createAccount({
        ...form,
        age: Number(form.age),
        email: form.email.trim().toLowerCase(),
        username,
        usernameLower,
        storeSlug: usernameLower
      });
      onLogin(user);
      navigate('/admin', { replace: true });
    } catch (requestError) {
      setError(registrationError(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page register-page">
      <Link to="/login" className="back-link"><ArrowLeft size={16} /> Back to sign in</Link>
      <section className="login-card register-card">
        <div className="login-brand"><span className="brand-mark brand-mark-large"><Leaf size={21} /></span><span className="eyebrow">YOUR OWNER'S STUDIO</span></div>
        <h1>Make a little<br />room for your ideas.</h1>
        <p className="login-intro">Create your account and your own storefront will be ready to fill.</p>
        <form className="login-form register-form" onSubmit={submit}>
          <label htmlFor="register-name">Full name</label>
          <input id="register-name" name="name" autoComplete="name" required maxLength={100} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />

          <label htmlFor="register-origin">Origin or city</label>
          <input id="register-origin" name="address-level2" autoComplete="address-level2" required maxLength={100} value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} />

          <label htmlFor="register-age">Age</label>
          <input id="register-age" name="age" type="number" min="13" max="120" required value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} />

          <label htmlFor="register-email">Email</label>
          <input id="register-email" name="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />

          <label htmlFor="register-phone">Phone number</label>
          <input id="register-phone" name="tel" type="tel" autoComplete="tel" required maxLength={40} value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} />

          <label htmlFor="register-project">Project type</label>
          <select id="register-project" name="projectType" required value={form.projectType} onChange={(event) => setForm({ ...form, projectType: event.target.value })}>
            <option value="">Choose your project type</option>
            <option value="Art and handmade">Art and handmade</option>
            <option value="Beauty and wellness">Beauty and wellness</option>
            <option value="Clothing and accessories">Clothing and accessories</option>
            <option value="Food and drink">Food and drink</option>
            <option value="Home and living">Home and living</option>
            <option value="Other">Other</option>
          </select>

          <label htmlFor="register-username">Username</label>
          <input id="register-username" name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_-]{3,24}" aria-describedby="username-help" value={form.username} onChange={(event) => {
            setForm({ ...form, username: event.target.value });
            setUsernameState({ checking: false, available: null });
          }} onBlur={checkUsername} />
          <small id="username-help" className="field-help">
            {usernameState.checking ? 'Checking availability…'
              : usernameState.available === true ? 'That username is available.'
                : usernameState.available === false ? 'That username is already taken.'
                  : '3–24 letters, numbers, hyphens, or underscores. It becomes your store link.'}
          </small>

          <label htmlFor="register-password">Password</label>
          <input id="register-password" name="new-password" type="password" autoComplete="new-password" required minLength={10} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <div className={strengthClass} aria-live="polite">
            <div className="password-strength-track"><span /></div>
            <span>{strengthLabel}</span>
          </div>
          <small className="field-help">At least 10 characters, with a number and a special character.</small>

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary login-submit" disabled={loading || usernameState.checking || (usernameState.available === false)}>
            {loading ? 'Creating your studio…' : 'Create my store'} {!loading && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="login-register">Already have an account? <Link to="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
