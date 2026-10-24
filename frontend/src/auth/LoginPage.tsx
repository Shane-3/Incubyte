import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { type FieldErrors, isEmail, mapApiError } from '../lib/form-errors';
import { FormAlert } from '../components/ui/FormAlert';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './AuthProvider';

type Field = 'email' | 'password';
const LABELS: Record<Field, string> = { email: 'Email', password: 'Password' };

export function LoginPage() {
  const { login, notice } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
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
    </AuthLayout>
  );
}
