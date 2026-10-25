import { type FormEvent, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { type FieldErrors, isEmail, mapApiError } from '../lib/form-errors';
import { FormAlert } from '../components/ui/FormAlert';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './AuthProvider';
import { type DemoAccount, demoAdmin } from './demoAccess';

type Field = 'email' | 'password';
const LABELS: Record<Field, string> = { email: 'Email', password: 'Password' };

/** Demo credentials for reviewers: the admin account to sign in with, and a nudge to make your own user. */
function DemoAccess({ admin, onUse }: { admin: DemoAccount; onUse: () => void }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="mt-5 border-t border-border pt-4">
      <h2 id={headingId} className="mb-2 text-xs font-medium text-muted">
        Demo access
      </h2>
      <div className="rounded-control border border-border bg-page p-3">
        <p className="mb-2 text-sm font-medium">Admin</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">Email</dt>
          <dd className="truncate font-mono">{admin.email}</dd>
          <dt className="text-muted">Password</dt>
          <dd className="truncate font-mono">{admin.password}</dd>
        </dl>
        <Button size="sm" className="mt-3 w-full" onClick={onUse}>
          Use admin account
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted">
        <span className="font-medium text-text">User</span>: there is no shared account.{' '}
        <Link to="/register" className="font-medium text-accent hover:underline">
          Create a user account
        </Link>{' '}
        to try the regular view.
      </p>
    </section>
  );
}

export function LoginPage() {
  const { login, notice } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const admin = demoAdmin();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors<Field> = {};
    if (!email.trim()) found.email = 'Enter your email';
    else if (!isEmail(email)) found.email = 'Enter a valid email, like name@example.com';
    if (!password) found.password = 'Enter your password';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      const mapped = mapApiError(err, LABELS);
      setErrors(mapped.fields);
      setFormError(mapped.form);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      footer={
        // The demo panel already points to registration.
        !admin && (
          <>
            New here?{' '}
            <Link to="/register" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        )
      }
    >
      {notice && (
        <p role="status" className="mb-4 rounded-control border border-border bg-page px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <FormAlert message={formError} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" variant="primary" className="mt-1 w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      {admin && (
        <DemoAccess
          admin={admin}
          onUse={() => {
            setEmail(admin.email);
            setPassword(admin.password);
            setErrors({});
            setFormError(null);
          }}
        />
      )}
    </AuthLayout>
  );
}
