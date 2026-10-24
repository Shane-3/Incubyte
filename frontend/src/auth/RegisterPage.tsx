import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { type FieldErrors, isEmail, mapApiError } from '../lib/form-errors';
import { AuthLayout, FormAlert } from './AuthLayout';
import { useAuth } from './AuthProvider';

type Field = 'name' | 'email' | 'password';
const LABELS: Record<Field, string> = { name: 'Name', email: 'Email', password: 'Password' };
const MIN_PASSWORD = 8;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors<Field> = {};
    if (!name.trim()) found.name = 'Enter your name';
    if (!email.trim()) found.email = 'Enter your email';
    else if (!isEmail(email)) found.email = 'Enter a valid email, like name@example.com';
    if (password.length < MIN_PASSWORD) found.password = `Use at least ${MIN_PASSWORD} characters`;
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
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
      title="Create your account"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <FormAlert message={formError} />
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Full name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
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
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD} characters`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" variant="primary" className="mt-1 w-full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
