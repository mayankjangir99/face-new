import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, bootstrapAdmin, isAuthenticated, requiresBootstrap } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (requiresBootstrap) {
        await bootstrapAdmin(form);
      } else {
        await login({
          email: form.email,
          password: form.password
        });
      }

      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.message || requestError.response?.data?.message || 'Unable to complete the request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-400">VisionID</p>
          <h1 className="mt-3 text-2xl font-bold text-white">Attendance</h1>
        </div>
        <div className="surface-panel">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-sky-500 p-3 text-white shadow-lg shadow-sky-500/20">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 className="section-title">{requiresBootstrap ? 'Create admin account' : 'Sign in'}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {requiresBootstrap ? 'Set up the first workspace account.' : 'Use your staff credentials to continue.'}
                  </p>
                </div>
              </div>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                {requiresBootstrap ? (
                  <input
                    className="soft-input"
                    placeholder="Administrator name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  />
                ) : null}

                <input
                  className="soft-input"
                  placeholder="Email address"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />

                <input
                  className="soft-input"
                  placeholder="Password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />

                {error ? (
                  <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">{error}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="soft-button w-full rounded-2xl bg-slate-950 py-3.5 text-white hover:scale-[1.01] dark:bg-sky-500 dark:text-slate-950"
                >
                  {submitting ? 'Please wait...' : requiresBootstrap ? 'Create account' : 'Continue'}
                  {!submitting && <ArrowRight className="size-4" />}
                </button>
              </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
