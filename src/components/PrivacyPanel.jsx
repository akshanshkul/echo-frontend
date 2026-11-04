import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { Avatar, Button, Icon } from './ui.jsx';
import { PRIVACY } from './PrivacyPicker.jsx';
import { listTime } from '../util.js';

/** side-panel section for groups & channels: privacy, @handle, invite link, join requests */
export default function PrivacyPanel({ conv, admin }) {
  const { act, dispatch } = useStore();
  const p = PRIVACY[conv.privacy || 'private'];
  const link = conv.inviteCode ? `${location.origin}/join/${conv.inviteCode}` : '';
  const [reqs, setReqs] = useState(null);
  const [busy, setBusy] = useState('');

  const loadReqs = () =>
    api('GET', `/conversations/${conv.id}/requests`)
      .then((r) => setReqs(r.requests))
      .catch(() => setReqs([]));
  useEffect(() => {
    setReqs(null);
    if (admin && conv.privacy === 'approval') loadReqs();
  }, [conv.id, conv.pendingRequests, conv.privacy, admin]);

  const decide = async (u, approve) => {
    setBusy(u.id);
    try {
      if (approve) await api('POST', `/conversations/${conv.id}/requests/${u.id}/approve`);
      else await api('DELETE', `/conversations/${conv.id}/requests/${u.id}`);
      setReqs((l) => l.filter((x) => x.user.id !== u.id));
      dispatch({
        type: 'conv/patch',
        id: conv.id,
        patch: { pendingRequests: Math.max(0, (conv.pendingRequests || 1) - 1) },
      });
      act.toast(approve ? `${u.name} was approved` : 'Request declined', {
        icon: approve ? 'user-check' : 'x',
      });
    } catch (e) {
      act.fail(e);
    } finally {
      setBusy('');
    }
  };
  const resetLink = async () => {
    try {
      const r = await api('POST', `/conversations/${conv.id}/invite-link/reset`);
      dispatch({ type: 'conv/patch', id: conv.id, patch: { inviteCode: r.inviteCode } });
      act.toast('Invite link reset — the old link no longer works', { icon: 'link' });
    } catch (e) {
      act.fail(e);
    }
  };
  const copy = (text, msg) => {
    navigator.clipboard?.writeText(text);
    act.toast(msg, { icon: 'copy' });
  };

  return (
    <div className="sec">
      <div className="sec-h">
        <span>Privacy &amp; joining</span>
      </div>
      <div className="flex items-start gap-2.5 pb-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <Icon n={p.icon} s={17} />
        </span>
        <div className="min-w-0">
          <b className="block font-semibold">{p.title}</b>
          <span className="text-xs leading-snug text-ink-3">{p.desc}</span>
        </div>
      </div>
      {conv.handle && (
        <button
          type="button"
          className="mb-2 flex w-full items-center justify-between rounded-md bg-field px-3 py-2 text-left hover:bg-hover"
          onClick={() => copy('@' + conv.handle, 'Handle copied')}
          title="Copy handle"
        >
          <span className="font-medium text-accent">@{conv.handle}</span>
          <Icon n="copy" s={15} />
        </button>
      )}
      {link ? (
        <div className="mb-2">
          <div className="mb-1 text-xs font-semibold text-ink-2">Invite link</div>
          <div className="flex gap-1.5">
            <input
              readOnly
              value={link}
              aria-label="Invite link"
              onFocus={(e) => e.target.select()}
              className="h-8 min-w-0 flex-1 truncate rounded-md border border-transparent bg-field px-2 text-xs outline-none focus:border-accent"
            />
            <Button className="h-8 px-2.5 text-xs" onClick={() => copy(link, 'Invite link copied')}>
              <Icon n="copy" s={14} /> Copy
            </Button>
          </div>
          {admin && (
            <button
              type="button"
              className="mt-1.5 text-xs text-ink-3 hover:text-danger"
              onClick={resetLink}
            >
              Reset link (revokes the old one)
            </button>
          )}
        </div>
      ) : (
        conv.privacy === 'private' &&
        !admin && (
          <p className="pb-2 text-xs text-ink-3">Only admins can share this chat's invite link.</p>
        )
      )}

      {admin && conv.privacy === 'approval' && (
        <div className="pb-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            Join requests
            {reqs?.length > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">
                {reqs.length}
              </span>
            )}
          </div>
          {reqs === null && <div className="skel h-10" />}
          {reqs?.length === 0 && <p className="text-xs text-ink-3">No pending requests.</p>}
          {reqs?.map(({ user: u, at }) => (
            <div key={u.id} className="flex items-center gap-2 py-1.5">
              <Avatar e={u} size={32} />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-medium">{u.name}</b>
                <span className="text-xs text-ink-3">
                  @{u.username} · {listTime(at)}
                </span>
              </span>
              <Button
                variant="primary"
                className="h-7 px-2.5 text-xs"
                disabled={busy === u.id}
                onClick={() => decide(u, true)}
              >
                Approve
              </Button>
              <Button
                className="h-7 px-2 text-xs"
                disabled={busy === u.id}
                onClick={() => decide(u, false)}
                aria-label={'Decline ' + u.name}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
