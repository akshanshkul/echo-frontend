import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { Avatar, Button, Icon, Modal } from './ui.jsx';
import { PRIVACY } from './PrivacyPicker.jsx';
import { joinChat } from './Discover.jsx';

/** Opened from an invite link: /join/<code> */
export default function JoinInvite({ code, onClose }) {
  const store = useStore();
  const { act } = store;
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api('GET', `/conversations/invite/${encodeURIComponent(code)}`)
      .then((r) => setInv(r.invite))
      .catch((e) => setErr(e.message));
  }, [code]);

  const go = async () => {
    setBusy(true);
    try {
      if (inv.isMember) {
        act.openConv(inv.conversationId);
        return onClose();
      }
      const r = await joinChat(
        store,
        inv.id,
        `/conversations/invite/${encodeURIComponent(code)}/join`,
      );
      if (r.status === 'requested') setDone(true);
      else onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const p = inv && PRIVACY[inv.privacy];
  return (
    <Modal title="Invitation" onClose={onClose}>
      {!inv && !err && <p className="py-6 text-center text-ink-3">Loading invitation…</p>}
      {err && !inv && (
        <div className="py-6 text-center">
          <span className="text-danger">
            <Icon n="link-off" s={34} />
          </span>
          <p className="mt-2 text-ink-2">{err}</p>
          <Button className="mt-4" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
      {inv && (
        <div className="flex flex-col items-center gap-1 py-3 text-center">
          <Avatar e={{ id: inv.id, name: inv.name }} size={84} sq />
          <h3 className="mt-2 text-lg font-semibold">{inv.name}</h3>
          <div className="text-xs text-ink-3">
            {inv.type === 'channel' ? 'Channel' : 'Group'} · {inv.memberCount.toLocaleString()}{' '}
            {inv.type === 'channel' ? 'subscribers' : 'members'}
          </div>
          {inv.desc && <p className="mt-2 max-w-sm text-ink-2">{inv.desc}</p>}
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-field px-2.5 py-1 text-xs text-ink-2">
            <Icon n={p.icon} s={13} /> {p.badge}
          </span>
          {done ? (
            <p className="mt-4 rounded-md bg-accent-soft px-3 py-2 text-[13px]" role="status">
              Request sent. You'll get a notification when an admin approves it.
            </p>
          ) : (
            <Button
              variant="primary"
              className="mt-5 min-w-40"
              disabled={busy || inv.requested}
              onClick={go}
            >
              {inv.isMember
                ? 'Open chat'
                : inv.requested
                  ? 'Request pending'
                  : inv.privacy === 'approval'
                    ? 'Request to join'
                    : 'Join'}
            </Button>
          )}
          {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        </div>
      )}
    </Modal>
  );
}
