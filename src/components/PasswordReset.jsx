import { useState } from 'react';
import { useStore } from '../store.jsx';
import { Card, Title, ErrorText } from './AuthScreen.jsx';
import { Button, Field, Input } from './ui.jsx';

const Link = (p) => <a href="#" {...p} className="font-medium text-accent hover:underline" />;

/** Step 1: ask for the email address; the API always answers the same way (no account enumeration). */
export function ForgotPassword({ initialEmail = '', onBack }) {
  const { act } = useStore();
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await act.forgotPassword(email.trim());
      setSent(true);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <Card onSubmit={(e) => e.preventDefault()}>
        <Title
          sub={
            <>
              If an account exists for <b className="text-ink">{email.trim()}</b>, we've sent a link
              to reset your password. It expires in 1 hour.
            </>
          }
        >
          Check your email
        </Title>
        <p className="mb-3 text-xs text-ink-3">
          Nothing arrived? Check your spam folder and make sure this is the exact email you
          registered with. If you never verified that email, we send you the verification link
          instead. You can try again in a minute.
        </p>
        <Button className="w-full" onClick={() => setSent(false)}>
          Send again
        </Button>
        <p className="mt-3 text-center">
          <Link onClick={(e) => (e.preventDefault(), onBack())}>Back to sign in</Link>
        </p>
      </Card>
    );
  return (
    <Card onSubmit={submit}>
      <Title sub="Enter your account email and we'll send you a link to choose a new password.">
        Forgot password?
      </Title>
      <Field label="Email" htmlFor="fe">
        <Input
          id="fe"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      {err && <ErrorText>{err}</ErrorText>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? 'Sending…' : 'Send reset link'}
      </Button>
      <p className="mt-3 text-center">
        <Link onClick={(e) => (e.preventDefault(), onBack())}>Back to sign in</Link>
      </p>
    </Card>
  );
}

const strength = (v) =>
  [
    v.length >= 8,
    v.length >= 12,
    /[A-Z]/.test(v) && /[a-z]/.test(v),
    /\d/.test(v),
    /[^\w\s]/.test(v),
  ].filter(Boolean).length;
const LABEL = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];

/** Step 2: opened from the emailed link — /reset-password?token=... */
export function ResetPassword({ token, done }) {
  const { act } = useStore();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dead, setDead] = useState(false); // link invalid / expired
  const score = strength(pw);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr('Password must be at least 8 characters');
    if (pw !== pw2) return setErr('Passwords do not match');
    setBusy(true);
    try {
      await act.resetPassword(token, pw);
      history.replaceState(null, '', '/');
      done(true);
    } catch (x) {
      setErr(x.message);
      if (x.code === 'INVALID_TOKEN' || x.code === 'TOKEN_EXPIRED') setDead(true);
    } finally {
      setBusy(false);
    }
  };
  const leave = () => {
    history.replaceState(null, '', '/');
    done(false);
  };

  if (dead)
    return (
      <Card onSubmit={(e) => e.preventDefault()}>
        <Title sub={err}>Reset link problem</Title>
        <Button variant="primary" className="w-full" onClick={leave}>
          Request a new link
        </Button>
      </Card>
    );
  return (
    <Card onSubmit={submit}>
      <Title sub="Choose a new password for your account. You'll be signed out of all other devices.">
        Set a new password
      </Title>
      <Field label="New password" htmlFor="np">
        <Input
          id="np"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          autoFocus
          required
          minLength={8}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <div className="mt-1 flex items-center gap-2" aria-live="polite">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-field">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(pw ? score / 5 : 0) * 100}%`,
                background:
                  score <= 1 ? 'var(--danger)' : score <= 2 ? 'var(--warn)' : 'var(--online)',
              }}
            />
          </div>
          <span className="w-16 text-right text-xs text-ink-3">{pw ? LABEL[score] : ''}</span>
        </div>
      </Field>
      <Field label="Confirm new password" htmlFor="np2">
        <Input
          id="np2"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-3">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show
          passwords
        </label>
      </Field>
      {err && <ErrorText>{err}</ErrorText>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Update password'}
      </Button>
    </Card>
  );
}
