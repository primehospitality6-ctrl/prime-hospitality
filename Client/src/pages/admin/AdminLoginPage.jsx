import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminLoginPage() {
  const { login, isAdmin, loading } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && isAdmin) return <Navigate to="/admin" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login({ username, password });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-prime-night px-4 text-prime-sand">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md border border-white/15 bg-prime-surface/5 p-8 backdrop-blur-md"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-prime-gold">
          Prime Hospitality · Staff only
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-white">
          Staff sign in
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Manage destinations, properties, unit types, bookings and the website. Guests don’t need an
          account to book.
        </p>

        <label className="mt-8 block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            Username
          </span>
          <input
            className="w-full border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-prime-gold"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            Password
          </span>
          <input
            className="w-full border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-prime-gold"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full bg-prime-gold py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-prime-ink disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <Link to="/" className="mt-2 block py-3 text-center text-xs text-white/50 hover:text-white">
          ← Back to site
        </Link>
      </form>
    </div>
  );
}
