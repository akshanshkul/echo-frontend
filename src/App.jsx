import { useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore, sideIsOpen } from './store.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import {
  VerifyEmail,
  PhoneScreen,
  PendingApproval,
  AccountDisabled,
} from './components/Onboarding.jsx';
import { ResetPassword } from './components/PasswordReset.jsx';
import JoinInvite from './components/JoinInvite.jsx';
import Rail from './components/Rail.jsx';
import ConversationList from './components/ConversationList.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import SidePanel from './components/SidePanel.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import SearchModal from './components/SearchModal.jsx';
import { Toasts } from './components/ui.jsx';

function Resizer({ k, min, max, dir, cls = '' }) {
  const { state, dispatch } = useStore();
  const drag = useRef(null);
  const down = (e) => {
    drag.current = { x: e.clientX, w: state.settings[k] };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.getElementById('app').classList.add('resizing');
  };
  const move = (e) => {
    if (drag.current)
      dispatch({
        type: 'settings',
        patch: {
          [k]: Math.max(min, Math.min(max, drag.current.w + (e.clientX - drag.current.x) * dir)),
        },
      });
  };
  const up = () => {
    drag.current = null;
    document.getElementById('app').classList.remove('resizing');
  };
  const key = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      dispatch({
        type: 'settings',
        patch: {
          [k]: Math.max(
            min,
            Math.min(max, state.settings[k] + (e.key === 'ArrowRight' ? 16 : -16) * dir),
          ),
        },
      });
    }
  };
  return (
    <div
      className={`resizer ${cls}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onKeyDown={key}
    />
  );
}

function Shell() {
  const { state, dispatch } = useStore();
  const { me, booting, active, settings, screen } = state;
  const [section, setSection] = useState('all');
  const [modal, setModal] = useState(null);
  const [, force] = useState(0);
  useEffect(() => {
    const r = () => force((n) => n + 1);
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  useEffect(() => {
    const k = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setModal('search');
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  const [verifying, setVerifying] = useState(() =>
    location.pathname === '/verify-email'
      ? new URLSearchParams(location.search).get('token') || 'missing'
      : null,
  );
  const [resetting, setResetting] = useState(() =>
    location.pathname === '/reset-password'
      ? new URLSearchParams(location.search).get('token') || 'missing'
      : null,
  );
  const [resetNotice, setResetNotice] = useState('');
  const [joinCode, setJoinCode] = useState(() => {
    const m = location.pathname.match(/^\/join\/([\w-]+)$/); // invite link, survives sign-in
    return m ? m[1] : null;
  });
  if (verifying) return <VerifyEmail token={verifying} done={() => setVerifying(null)} />;
  if (resetting)
    return (
      <ResetPassword
        token={resetting}
        done={(ok) => {
          setResetting(null);
          if (ok) setResetNotice('Password updated. Sign in with your new password.');
        }}
      />
    );
  if (booting) return <div className="splash">Loading…</div>;
  if (!me) return <AuthScreen success={resetNotice} />;
  if (me.disabled) return <AccountDisabled />;
  if (!me.phoneSet) return <PhoneScreen />;
  if (!me.approved) return <PendingApproval />;
  const sideOpen = sideIsOpen(state) && active;
  return (
    <>
      <div
        id="app"
        onClick={(e) => {
          if (e.target === e.currentTarget && innerWidth <= 1180 && sideOpen)
            dispatch({ type: 'side', open: false });
        }}
        className={`app ${sideOpen ? '' : 'no-side'}`}
        data-screen={screen}
        style={{ '--list-w': settings.listW + 'px', '--side-w': settings.sideW + 'px' }}
      >
        <Rail section={section} setSection={setSection} openSettings={() => setModal('settings')} />
        <ConversationList section={section} openSearch={() => setModal('search')} />
        <Resizer k="listW" min={240} max={520} dir={1} />
        <ChatWindow openSearch={() => setModal('search')} />
        <Resizer k="sideW" min={280} max={560} dir={-1} cls="rs-side" />
        <SidePanel />
      </div>
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal === 'search' && <SearchModal onClose={() => setModal(null)} />}
      {joinCode && (
        <JoinInvite
          code={joinCode}
          onClose={() => {
            setJoinCode(null);
            history.replaceState(null, '', '/');
          }}
        />
      )}
    </>
  );
}
export default function App() {
  return (
    <StoreProvider>
      <Shell />
      <Toasts />
    </StoreProvider>
  );
}
