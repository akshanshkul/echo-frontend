import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore, convTitle } from '../store.jsx';
import { Avatar, Icon, Input, Modal } from './ui.jsx';
import { esc, listTime, plain } from '../util.js';
const mark = (text, q) => {
  if (!q) return esc(text);
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let o = '',
    i = 0,
    m;
  while ((m = re.exec(text))) {
    o += esc(text.slice(i, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
    i = m.index + m[0].length;
  }
  return o + esc(text.slice(i));
};
const Label = ({ children }) => (
  <div className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
    {children}
  </div>
);
const Item = (p) => (
  <button
    {...p}
    className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-hover focus-visible:bg-hover"
  />
);

export default function SearchModal({ onClose }) {
  const { state, act } = useStore();
  const { convs, me } = state;
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) {
      setRes([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(
      () =>
        api('GET', '/search?q=' + encodeURIComponent(q.trim()))
          .then((r) => setRes(r.results))
          .catch(act.fail)
          .finally(() => setBusy(false)),
      250,
    );
    return () => clearTimeout(t);
  }, [q]);
  const open = async (m) => {
    onClose();
    await act.openConv(m.conv);
    setTimeout(() => {
      const el = document.getElementById('m-' + m.id);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('flash');
      } else
        act.toast('That message is older than what is loaded — scroll up to load more', {
          icon: 'info-circle',
        });
    }, 150);
  };
  const chats = Object.values(convs)
    .filter(
      (c) =>
        c.type !== 'saved' &&
        q.trim() &&
        convTitle(c, me).toLowerCase().includes(q.trim().toLowerCase()),
    )
    .slice(0, 4);
  const term = q.trim();
  return (
    <Modal title="Search" cls="lg" onClose={onClose}>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3">
          <Icon n="search" s={17} />
        </span>
        <Input
          className="h-10 pl-9"
          autoFocus
          placeholder="Search messages and chats"
          aria-label="Search everything"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="mt-2">
        {chats.length > 0 && (
          <>
            <Label>Chats</Label>
            {chats.map((c) => (
              <Item
                key={c.id}
                onClick={() => {
                  onClose();
                  act.openConv(c.id);
                }}
              >
                <Avatar e={{ id: c.id, name: convTitle(c, me) }} size={34} />
                <span className="font-semibold">{convTitle(c, me)}</span>
              </Item>
            ))}
          </>
        )}
        {term.length >= 2 && <Label>Messages {busy ? '…' : `· ${res.length}`}</Label>}
        {res.map((m) => {
          const c = convs[m.conv];
          const who = c?.members.find((x) => x.user.id === m.sender)?.user;
          return (
            <Item key={m.id} onClick={() => open(m)}>
              <Avatar e={{ id: m.conv, name: c ? convTitle(c, me) : '?' }} size={34} />
              <span className="min-w-0 flex-1">
                <b className="flex font-semibold">
                  {c ? convTitle(c, me) : 'Chat'}
                  <time className="ml-auto text-[11px] font-normal text-ink-3">
                    {listTime(m.createdAt)}
                  </time>
                </b>
                <span className="block truncate text-ink-2">
                  <span className="text-ink-3">
                    {who?.id === me.id ? 'You' : who?.name.split(' ')[0]}:{' '}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: mark(plain(m.text), term) }} />
                </span>
              </span>
            </Item>
          );
        })}
        {term.length >= 2 && !busy && !res.length && !chats.length && (
          <div className="p-8 text-center text-ink-3">
            <Icon n="search" s={32} />
            <p className="mt-2">No results</p>
          </div>
        )}
        {term.length < 2 && (
          <div className="p-10 text-center text-ink-3">
            <Icon n="search" s={34} />
            <p className="mt-2">Type at least two characters.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
