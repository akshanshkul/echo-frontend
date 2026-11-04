import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { Card, Title, ErrorText } from './AuthScreen.jsx';
import { Button, Field, Input, Select } from './ui.jsx';

/** Opened from the emailed link: /verify-email?token=... */
export function VerifyEmail({ token, done }) {
  const { act } = useStore();
  const [state, setState] = useState('working');
  const [msg, setMsg] = useState('');
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true; // the link is single-use, so guard against double invocation
    act
      .verifyEmail(token)
      .then(() => {
        history.replaceState(null, '', '/');
        done();
      })
      .catch((e) => {
        setState('error');
        setMsg(e.message);
      });
  }, []);
  if (state === 'working')
    return (
      <div className="grid min-h-dvh place-items-center text-ink-3">Verifying your email…</div>
    );
  return (
    <Card onSubmit={(e) => e.preventDefault()}>
      <Title sub={msg}>Verification failed</Title>
      <Button
        variant="primary"
        className="w-full"
        onClick={() => {
          history.replaceState(null, '', '/');
          done();
        }}
      >
        Go to sign in
      </Button>
    </Card>
  );
}

const CODES = [
  ['+1', 'US/CA'],
  ['+44', 'UK'],
  ['+91', 'IN'],
  ['+61', 'AU'],
  ['+49', 'DE'],
  ['+33', 'FR'],
  ['+34', 'ES'],
  ['+39', 'IT'],
  ['+55', 'BR'],
  ['+81', 'JP'],
  ['+86', 'CN'],
  ['+971', 'AE'],
  ['+65', 'SG'],
  ['+27', 'ZA'],
  ['+234', 'NG'],
  ['+92', 'PK'],
  ['+880', 'BD'],
];
/** Step 2 after email verification: mobile number (required, one account per number) */
export function PhoneScreen() {
  const { state, act } = useStore();
  const [cc, setCc] = useState('+91');
  const [num, setNum] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const digits = num.replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length < 6) return setErr('Enter a valid mobile number');
    setBusy(true);
    try {
      await act.savePhone(cc + digits);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card onSubmit={submit}>
      <Title
        sub={`Email verified${state.me?.email ? ` for ${state.me.email}` : ''}. One last step — each mobile number can be linked to only one account.`}
      >
        Add your mobile number
      </Title>
      <Field label="Mobile number" htmlFor="ph">
        <div className="flex gap-2">
          <Select
            className="w-[118px]"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            aria-label="Country code"
          >
            {CODES.map(([c, n]) => (
              <option key={c} value={c}>
                {n} {c}
              </option>
            ))}
          </Select>
          <Input
            id="ph"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            autoFocus
            placeholder="98765 43210"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            required
          />
        </div>
      </Field>
      {err && <ErrorText>{err}</ErrorText>}
      <Button type="submit" variant="primary" className="w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Continue'}
      </Button>
      <p className="mt-3 text-center">
        <a
          href="#"
          className="text-accent hover:underline"
          onClick={(e) => {
            e.preventDefault();
            act.logout();
          }}
        >
          Sign out
        </a>
      </p>
    </Card>
  );
}

/** Shown after email + phone are done, until an admin approves the account. Checks again automatically. */
export function PendingApproval() {
  const { state, act } = useStore();
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    await act.refreshMe();
    setChecking(false);
  };
  useEffect(() => {
    const id = setInterval(() => act.refreshMe(), 8000);
    const onFocus = () => act.refreshMe();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  return (
    <Card onSubmit={(e) => e.preventDefault()}>
      <Title
        sub={`Thanks${state.me?.name ? `, ${state.me.name.split(' ')[0]}` : ''}! Your email and mobile number are confirmed. An administrator needs to approve your account before you can start chatting.`}
      >
        Waiting for approval
      </Title>
      <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-accent-soft px-3 py-2.5 text-[13px] text-ink-2">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
        This page updates automatically as soon as you're approved.
      </div>
      <Button className="w-full" disabled={checking} onClick={check}>
        {checking ? 'Checking…' : 'Check again'}
      </Button>
      <p className="mt-3 text-center">
        <a
          href="#"
          className="text-accent hover:underline"
          onClick={(e) => {
            e.preventDefault();
            act.logout();
          }}
        >
          Sign out
        </a>
      </p>
    </Card>
  );
}

/** Shown when an admin has temporarily disabled the account. Re-checks automatically so access returns when re-enabled. */
export function AccountDisabled() {
  const { act } = useStore();
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const id = setInterval(() => act.refreshMe(), 15000);
    const onFocus = () => act.refreshMe();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  return (
    <Card onSubmit={(e) => e.preventDefault()}>
      <Title sub="An administrator has temporarily disabled your account, so you can't use the app right now. Your chats and data are safe. If you think this is a mistake, please contact support.">
        Account disabled
      </Title>
      <Button
        className="w-full"
        disabled={checking}
        onClick={async () => {
          setChecking(true);
          await act.refreshMe();
          setChecking(false);
        }}
      >
        {checking ? 'Checking…' : 'Check again'}
      </Button>
      <p className="mt-3 text-center">
        <a
          href="#"
          className="text-accent hover:underline"
          onClick={(e) => {
            e.preventDefault();
            act.logout();
          }}
        >
          Sign out
        </a>
      </p>
    </Card>
  );
}
