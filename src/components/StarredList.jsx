import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore, convTitle } from '../store.jsx';
import { Avatar, Icon } from './ui.jsx';
import { listTime, snippet } from '../util.js';

/** "Starred Messages": every message the user starred, across all chats */
export default function StarredList({ q }) {
  const { state, act } = useStore();
  const { convs, me } = state;
  const [items, setItems] = useState(null);

  useEffect(() => {
    let live = true;
    api('GET', '/starred')
      .then((r) => live && setItems(r.messages))
      .catch((e) => {
        act.fail(e);
        live && setItems([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const open = async (m) => {
    await act.openConv(m.conv);
    setTimeout(() => {
      const el = document.getElementById('m-' + m.id);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('flash');
      } else act.toast('Scroll up in the chat to load that older message', { icon: 'info-circle' });
    }, 200);
  };

  const term = q.trim().toLowerCase();
  const rows = (items || []).filter((m) => {
    const c = convs[m.conv];
    return c && (!term || (snippet(m) + ' ' + convTitle(c, me)).toLowerCase().includes(term));
  });

  return (
    <div className="list-body" aria-label="Starred messages">
      {items === null && (
        <div className="space-y-3 p-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel h-12" />
          ))}
        </div>
      )}
      {items && !rows.length && (
        <div className="px-4 py-10 text-center text-ink-3">
          <Icon n="star" s={34} />
          <p className="mt-2">
            {term
              ? 'No starred messages match your search.'
              : 'No starred messages yet. Right-click (or long-press) a message and choose Star.'}
          </p>
        </div>
      )}
      {rows.map((m) => {
        const c = convs[m.conv];
        const who =
          m.sender === me.id
            ? 'You'
            : c.members.find((x) => x.user.id === m.sender)?.user.name.split(' ')[0] || 'Someone';
        return (
          <button
            key={m.id}
            type="button"
            className="conv"
            onClick={() => open(m)}
            aria-label={`Starred message in ${convTitle(c, me)}`}
          >
            <Avatar
              e={{ id: c.id, name: convTitle(c, me), type: c.type }}
              size={40}
              sq={c.type === 'group' || c.type === 'channel'}
            />
            <div className="mid">
              <div className="row1">
                <span className="name">{convTitle(c, me)}</span>
                <span className="time">{listTime(m.createdAt)}</span>
              </div>
              <div className="row2">
                <span className="prev">
                  <span className="who">{who}: </span>
                  {snippet(m)}
                </span>
                <span className="text-warn">
                  <Icon n="star" s={14} />
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
