import { useMemo, useState } from 'react';
import { useStore, convTitle, otherUser } from '../store.jsx';
import { Avatar, Icon, IconBtn, Menu } from './ui.jsx';
import { listTime, snippet } from '../util.js';
import { typingLabel } from '../helpers.js';
import { SECTIONS } from './Rail.jsx';
import NewChatModal from './NewChatModal.jsx';
import Discover from './Discover.jsx';
import StarredList from './StarredList.jsx';

const TITLES = Object.fromEntries(
  SECTIONS.map(([k, , t]) => [
    k,
    k === 'all' ? 'Chats' : t.replace(' Messages', '').replace(' Chats', ''),
  ]),
);
export default function ConversationList({ section, openSearch }) {
  const { state, act } = useStore();
  const { me, convs, active, typing } = state;
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [modal, setModal] = useState(null);
  const [menu, setMenu] = useState(null);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let l = Object.values(convs).filter((c) => {
      const arch = c.me?.archived;
      if (section === 'requests') return !!c.dm?.incoming && !arch;
      if (c.dm?.incoming) return false; // requests live in their own tab until accepted
      if (section === 'archived') return arch;
      if (arch) return false;
      if (section === 'personal') return c.type === 'dm' || c.type === 'saved';
      if (section === 'groups') return c.type === 'group';
      if (section === 'channels') return c.type === 'channel';
      if (section === 'unread') return c.unread > 0;
      if (section === 'all') {
        if (filter === 'unread') return c.unread > 0;
        if (filter === 'groups') return c.type === 'group' || c.type === 'channel';
        if (filter === 'personal') return c.type === 'dm' || c.type === 'saved';
      }
      return true;
    });
    if (ql)
      l = l.filter(
        (c) =>
          convTitle(c, me).toLowerCase().includes(ql) ||
          snippet(c.lastMessage).toLowerCase().includes(ql),
      );
    const ts = (c) => new Date(c.lastMessageAt).getTime();
    return l.sort(
      (a, b) =>
        !!b.me?.pinned - !!a.me?.pinned ||
        (sort === 'az'
          ? convTitle(a, me).localeCompare(convTitle(b, me))
          : sort === 'unread'
            ? (b.unread > 0) - (a.unread > 0) || ts(b) - ts(a)
            : ts(b) - ts(a)),
    );
  }, [convs, section, filter, q, sort, me]);

  const starredCount = null;
  const unreadAll = Object.values(convs).filter((c) => !c.me?.archived && c.unread).length;
  const rowMenu = (e, c) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, c });
  };
  const sortMenu = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ x: r.left - 120, y: r.bottom + 4, sort: true });
  };

  return (
    <aside className="list-pane" aria-label="Conversations">
      <div className="pane-head">
        <h1>{TITLES[section]}</h1>
        <IconBtn n="search" label="Search messages (Ctrl+K)" onClick={openSearch} />
        <IconBtn n="sort-descending" label="Sort conversations" onClick={sortMenu} />
        <IconBtn n="message-plus" label="New chat" onClick={() => setModal(true)} />
      </div>
      <div className="list-search search">
        <Icon n="search" s={16} />
        <input
          className="input"
          type="search"
          placeholder="Search chats"
          aria-label="Search conversations"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>
      {section === 'all' && (
        <div className="tabs" role="tablist">
          {[
            ['all', 'All'],
            ['unread', 'Unread', unreadAll],
            ['groups', 'Groups'],
            ['personal', 'Personal'],
          ].map(([k, l, n]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              className={`tab ${filter === k ? 'active' : ''}`}
              onClick={() => setFilter(k)}
            >
              {l}
              {n ? <span className="n">{n}</span> : null}
            </button>
          ))}
        </div>
      )}
      {section === 'discover' ? (
        <Discover q={q} />
      ) : section === 'starred' ? (
        <StarredList q={q} />
      ) : (
        <div className="list-body" role="listbox" aria-label="Conversation list">
          {!rows.length && (
            <div className="empty-mini" style={{ padding: '40px 16px' }}>
              <Icon n={q ? 'search' : 'message-circle'} s={32} />
              <p style={{ marginTop: 8 }}>
                {q
                  ? `No chats match “${q}”`
                  : section === 'requests'
                    ? 'No message requests. When someone you haven’t chatted with wants to message you, it shows up here.'
                    : 'Nothing here yet. Start a new chat with the button above.'}
              </p>
            </div>
          )}
          {rows.map((c, i) => {
            const u = c.type === 'dm' ? otherUser(c, me) : null;
            const ty = typingLabel(c, typing, me);
            const lm = c.lastMessage;
            const mine = lm?.sender === me.id;
            const showPinHead = c.me?.pinned && !rows[i - 1]?.me?.pinned && !q;
            const showAllHead = !c.me?.pinned && rows[i - 1]?.me?.pinned && !q;
            const who =
              lm && (c.type === 'group' || c.type === 'channel')
                ? (mine
                    ? 'You'
                    : c.members.find((m) => m.user.id === lm.sender)?.user.name.split(' ')[0]) +
                  ': '
                : '';
            return (
              <div key={c.id}>
                {showPinHead && (
                  <div className="sect-label">
                    <Icon n="pin" s={12} /> Pinned
                  </div>
                )}
                {showAllHead && <div className="sect-label">All chats</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={active === c.id}
                  className={`conv ${active === c.id ? 'active' : ''} ${c.unread ? 'unr' : ''}`}
                  onClick={() => act.openConv(c.id)}
                  onContextMenu={(e) => rowMenu(e, c)}
                >
                  <Avatar
                    e={c.type === 'dm' ? u : { id: c.id, name: convTitle(c, me), type: c.type }}
                    size={44}
                    pres={!!u}
                    sq={c.type === 'group' || c.type === 'channel'}
                  />
                  <div className="mid">
                    <div className="row1">
                      <span className="name">
                        {convTitle(c, me)}
                        {c.me?.muted && <Icon n="bell-off" s={13} />}
                      </span>
                      <span className="time">{lm ? listTime(lm.createdAt) : ''}</span>
                    </div>
                    <div className="row2">
                      <span className="prev">
                        {ty ? (
                          <span className="typ">
                            <span className="dots">
                              <i />
                              <i />
                              <i />
                            </span>{' '}
                            {ty}
                          </span>
                        ) : c.dm?.incoming ? (
                          <>
                            <b className="who">Wants to message you</b>
                            {c.dm.note ? ` · ${c.dm.note}` : ''}
                          </>
                        ) : c.dm?.status === 'pending' ? (
                          <span className="hint">Request sent · waiting for reply</span>
                        ) : c.dm?.status === 'declined' ? (
                          <span className="hint">Request not accepted</span>
                        ) : lm ? (
                          <>
                            {who && <span className="who">{who}</span>}
                            {snippet(lm)}
                          </>
                        ) : (
                          <span className="hint">No messages yet</span>
                        )}
                      </span>
                      <span className="tail">
                        {c.me?.pinned && <Icon n="pin" s={14} />}
                        {c.unread > 0 && (
                          <span className={`count ${c.me?.muted ? 'muted' : ''}`}>{c.unread}</span>
                        )}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
      {modal && <NewChatModal onClose={() => setModal(null)} />}
      {menu && (
        <Menu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={
            menu.sort
              ? [
                  ['recent', 'Most recent'],
                  ['unread', 'Unread first'],
                  ['az', 'Name A–Z'],
                ].map(([k, l]) => ({
                  label: l,
                  icon: 'sort-descending',
                  check: sort === k,
                  onClick: () => setSort(k),
                }))
              : [
                  {
                    label: menu.c.me?.pinned ? 'Unpin' : 'Pin to top',
                    icon: 'pin',
                    onClick: () => act.setFlag(menu.c.id, { pinned: !menu.c.me?.pinned }),
                  },
                  {
                    label: menu.c.me?.muted ? 'Unmute' : 'Mute notifications',
                    icon: 'bell-off',
                    onClick: () => act.setFlag(menu.c.id, { muted: !menu.c.me?.muted }),
                  },
                  {
                    label: menu.c.me?.archived ? 'Unarchive' : 'Archive',
                    icon: 'archive',
                    onClick: () => act.setFlag(menu.c.id, { archived: !menu.c.me?.archived }),
                  },
                ]
          }
        />
      )}
    </aside>
  );
}
