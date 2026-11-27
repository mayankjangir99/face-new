import { useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const SignupPage = () => {
  const { registerUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'teacher' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      await registerUser(form);
      setMessage('Staff account created successfully.');
      setForm({ name: '', email: '', password: '', role: 'teacher' });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create the account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface-panel">
        <div className="flex items-center gap-4">
          <div className="rounded-3xl bg-sky-500/10 p-4 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600 dark:text-sky-300">Admin</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Create a staff account</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              Use this page to register teachers or additional admins. Accounts are created by an authenticated admin only.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-panel max-w-xl">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-950/90 p-3 text-white dark:bg-white/10 dark:text-sky-200">
            <UserPlus className="size-5" />
          </div>
          <div>
            <h2 className="section-title">Staff signup</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Add a new authorized teacher or admin account for the attendance system.
            </p>
          </div>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input
            className="soft-input"
            placeholder="Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />

          <input
            className="soft-input"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />

          <input
            className="soft-input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          />

          <select
            className="soft-input"
            value={form.role}
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
          >
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>

          {message ? (
            <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="soft-button w-full rounded-2xl bg-slate-950 py-3.5 text-white hover:scale-[1.01] dark:bg-sky-500 dark:text-slate-950"
          >
            {submitting ? 'Creating account...' : 'Create staff account'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default SignupPage;
