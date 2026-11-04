import { useState } from 'react';
import { useStore } from '../store.jsx';
import { Button, Field, Input, Logo } from './ui.jsx';
import { ForgotPassword } from './PasswordReset.jsx';
import { APP_NAME } from '../config.js';

export function Card({ children, onSubmit }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-chat p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[400px] rounded-xl border border-line bg-elev p-7 shadow-pop"
      >
        <Logo size={64} className="drop-shadow-[0_4px_10px_rgba(0,60,200,.25)]" />
        {children}
      </form>
    </div>
  );
}
export const Title = ({ children, sub }) => (
  <>
    <h1 className="mb-1 mt-3 text-xl font-semibold tracking-tight text-ink">{children}</h1>
    <p className="mb-4 text-ink-3">{sub}</p>
  </>
);
export const ErrorText = ({ children }) => (
  <div role="alert" className="mb-2 text-[12.5px] text-danger">
    {children}
  </div>
);
const Link = (p) => <a href="#" {...p} className="font-medium text-accent hover:underline" />;

export default function AuthScreen({ notice, success }) {
  const { act } = useStore();
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState('');
  const [errCode, setErrCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(null);
  const [sent, setSent] = useState('');
  const [forgot, setForgot] = useState(false);
  const [f, setF] = useState({ name: '', username: '', email: '', login: '', password: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const unverified = errCode === 'EMAIL_NOT_VERIFIED' || errCode === 'EMAIL_UNVERIFIED';

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setErrCode(null);
    setSent('');
    setBusy(true);
    try {
      if (mode === 'login') await act.login({ login: f.login.trim(), password: f.password });
      else {
        const r = await act.register({
          ...f,
          name: f.name.trim(),
          username: f.username.trim(),
          email: f.email.trim(),
        });
        setPending(r.email);
      }
    } catch (x) {
      setErr(x.message);
      setErrCode(x.code);
    } finally {
      setBusy(false);
    }
  };
  const resend = async (email) => {
    if (!email) return setErr('Enter your email address to resend the link.');
    setBusy(true);
    try {
      setSent((await act.resend(email)).message);
      setErr('');
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  if (forgot)
    return (
      <ForgotPassword
        initialEmail={f.login.includes('@') ? f.login.trim() : ''}
        onBack={() => setForgot(false)}
      />
    );
  if (pending)
    return (
      <Card onSubmit={(e) => e.preventDefault()}>
        <Title
          sub={
            <>
              We sent a verification link to <b className="text-ink">{pending}</b>. Open it to
              activate your account — then you'll add your mobile number.
            </>
          }
        >
          Check your email
        </Title>
        {sent && (
          <p role="status" className="mb-3 text-xs text-online">
            {sent}
          </p>
        )}
        {err && <ErrorText>{err}</ErrorText>}
        <Button className="w-full" disabled={busy} onClick={() => resend(pending)}>
          Resend verification email
        </Button>
        <p className="mt-3 text-center text-ink-2">
          <Link
            onClick={(e) => {
              e.preventDefault();
              setPending(null);
              setSent('');
              setMode('login');
            }}
          >
            Back to sign in
          </Link>
        </p>
      </Card>
    );
  return (
    <Card onSubmit={submit}>
      <Title
        sub={
          mode === 'login' ? 'Welcome back.' : "Use a real email — we'll send a link to verify it."
        }
      >
        {mode === 'login' ? `Sign in to ${APP_NAME}` : 'Create your account'}
      </Title>
      {success && (
        <p role="status" className="mb-3 rounded-md bg-accent-soft px-3 py-2 text-[13px] text-ink">
          {success}
        </p>
      )}
      {notice && <ErrorText>{notice}</ErrorText>}
      {mode === 'register' && (
        <>
          <Field label="Full name" htmlFor="n">
            <Input id="n" value={f.name} onChange={set('name')} required autoFocus />
          </Field>
          <Field label="Username" htmlFor="u" hint="3–24 letters, numbers, _ or .">
            <Input
              id="u"
              value={f.username}
              onChange={set('username')}
              required
              pattern="[A-Za-z0-9_.]{3,24}"
              autoComplete="username"
            />
          </Field>
          <Field label="Email" htmlFor="e">
            <Input
              id="e"
              type="email"
              value={f.email}
              onChange={set('email')}
              required
              autoComplete="email"
            />
          </Field>
        </>
      )}
      {mode === 'login' && (
        <Field label="Username or email" htmlFor="l">
          <Input
            id="l"
            value={f.login}
            onChange={set('login')}
            required
            autoFocus
            autoComplete="username"
          />
        </Field>
      )}
      <Field label="Password" htmlFor="p">
        <Input
          id="p"
          type={show ? 'text' : 'password'}
          value={f.password}
          onChange={set('password')}
          required
          minLength={mode === 'register' ? 8 : 1}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-3">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show
          password
        </label>
        {mode === 'login' && (
          <div className="text-right">
            <Link onClick={(e) => (e.preventDefault(), setForgot(true))}>Forgot password?</Link>
          </div>
        )}
      </Field>
      {err && <ErrorText>{err}</ErrorText>}
      {sent && (
        <p role="status" className="mb-2 text-xs text-online">
          {sent}
        </p>
      )}
      {unverified && (
        <Button
          className="mb-2 w-full"
          disabled={busy}
          onClick={() =>
            resend(
              mode === 'register' ? f.email.trim() : f.login.includes('@') ? f.login.trim() : '',
            )
          }
        >
          Resend verification email
        </Button>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </Button>
      <p className="mt-3 text-center text-ink-2">
        {mode === 'login' ? 'New here? ' : 'Already registered? '}
        <Link
          onClick={(e) => {
            e.preventDefault();
            setErr('');
            setErrCode(null);
            setSent('');
            setMode(mode === 'login' ? 'register' : 'login');
          }}
        >
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </Link>
      </p>
    </Card>
  );
}
