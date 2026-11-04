import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { Avatar, Button, Icon, cx } from './ui.jsx';
import { PRIVACY } from './PrivacyPicker.jsx';

/** Join (or request to join) a chat after it was found/previewed */
export async function joinChat({ act, dispatch }, id, via = `/conversations/${id}/join`) {
  const r = await api('POST', via);
  if (r.status === 'requested') {
    act.toast('Request sent — an admin will review it', { icon: 'user-check' });
  } else {
    // pull the conversation we just joined into the sidebar and open it
    const c = await api('GET', `/conversations/${r.conversationId}`);
    dispatch({ type: 'conv/upsert', conv: { unread: 0, lastMessage: null, ...c.conversation } });
    if (r.status === 'joined') act.toast('You joined the chat', { icon: 'circle-check' });
    act.openConv(r.conversationId);
  }
  return r;
}

export default function Discover({ q }) {
  const store = useStore();
  const { act } = store;
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let live = true;
    setItems(null);
    const t = setTimeout(
      () =>
        api('GET', '/conversations/discover?q=' + encodeURIComponent(q.trim()))
          .then((r) => live && setItems(r.results))
          .catch((e) => {
            act.fail(e);
            live && setItems([]);
          }),
      q ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const patch = (id, p) => setItems((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const join = async (it) => {
    setBusyId(it.id);
    try {
      const r = await joinChat(store, it.id);
      if (r.status === 'requested') patch(it.id, { requested: true });
      else setItems((l) => l.filter((x) => x.id !== it.id));
    } catch (e) {
      act.fail(e);
    } finally {
      setBusyId('');
    }
  };
  const cancel = async (it) => {
    try {
      await api('DELETE', `/conversations/${it.id}/join-request`);
      patch(it.id, { requested: false });
    } catch (e) {
      act.fail(e);
    }
  };

  return (
    <div className="list-body" aria-label="Discover chats">
      <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
        {q.trim() ? 'Results' : 'Public groups & channels'}
      </div>
      {items === null && (
        <div className="space-y-3 p-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skel size-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skel h-3 w-1/2" />
                <div className="skel h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      )}
      {items?.length === 0 && (
        <div className="px-4 py-10 text-center text-ink-3">
          <Icon n="compass" s={34} />
          <p className="mt-2">
            {q.trim()
              ? `Nothing found for “${q.trim()}”.`
              : 'No public groups or channels to join yet. Create one with the + button!'}
          </p>
        </div>
      )}
      {items?.map((it) => {
        const p = PRIVACY[it.privacy];
        return (
          <div key={it.id} className="flex items-start gap-3 border-b border-line px-4 py-3">
            <Avatar e={{ id: it.id, name: it.name }} size={44} sq />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <b className="truncate font-semibold">{it.name}</b>
                {it.type === 'channel' && <Icon n="speakerphone" s={13} />}
              </div>
              <div className="text-xs text-ink-3">
                {it.handle && <span className="text-accent">@{it.handle} · </span>}
                {it.memberCount.toLocaleString()}{' '}
                {it.type === 'channel' ? 'subscribers' : 'members'}
              </div>
              {it.desc && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-2">{it.desc}</p>}
              <span
                className={cx(
                  'mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold',
                  it.privacy === 'approval' ? 'bg-warn/20 text-warn' : 'bg-field text-ink-2',
                )}
              >
                <Icon n={p.icon} s={11} /> {p.badge}
              </span>
            </div>
            {it.requested ? (
              <Button
                className="h-8 px-3 text-xs"
                onClick={() => cancel(it)}
                title="Cancel your request"
              >
                Requested ✕
              </Button>
            ) : (
              <Button
                variant="primary"
                className="h-8 px-3 text-xs"
                disabled={busyId === it.id}
                onClick={() => join(it)}
              >
                {it.privacy === 'approval' ? 'Request' : 'Join'}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
