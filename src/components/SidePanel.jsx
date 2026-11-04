import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore, convTitle, otherUser, myRole } from '../store.jsx';
import { Avatar, Button, Field, Icon, IconBtn, Input, Menu, Modal, Textarea } from './ui.jsx';
import PrivacyPanel from './PrivacyPanel.jsx';
import { PrivacyPicker } from './PrivacyPicker.jsx';
import { dayLabel, fmt, presence, size, snippet, time } from '../util.js';
import { Viewer } from './ui.jsx';

export default function SidePanel() {
  const { state, dispatch } = useStore();
  const { panel, thread, settings, active } = state;
  const close = () => dispatch({ type: 'side', open: false });
  if (!active) return <aside className="side-pane" />;
  return (
    <aside className="side-pane" aria-label="Details">
      {panel === 'thread' && thread ? <Thread close={close} /> : <Info close={close} />}
    </aside>
  );
}

function Thread({ close }) {
  const { state, act, dispatch } = useStore();
  const { thread, convs, me } = state;
  const conv = convs[thread.conv];
  const [text, setText] = useState('');
  const p = thread.parent;
  const send = () => {
    if (!text.trim()) return;
    act.send(thread.conv, { text, threadOf: thread.id });
    setText('');
  };
  const row = (m) => {
    const u = conv.members.find((x) => x.user.id === m.sender)?.user;
    return (
      <div className="thr" key={m.id}>
        <Avatar e={u} size={32} />
        <div className="tb">
          <div className="th">
            <b>{u?.name || 'Member'}</b>
            <time>{time(m.createdAt)}</time>
          </div>
          <div className="text" dangerouslySetInnerHTML={{ __html: fmt(m.text) }} />
        </div>
      </div>
    );
  };
  const pu = conv.members.find((x) => x.user.id === p.sender)?.user;
  return (
    <>
      <div className="side-head">
        <IconBtn
          n="arrow-left"
          s={18}
          label="Back to details"
          onClick={() => dispatch({ type: 'thread', thread: null })}
        />
        <h2>Thread</h2>
        <IconBtn n="x" s={18} label="Close panel" onClick={close} />
      </div>
      <div className="side-body">
        <div className="thread-orig">
          <div className="th">
            <Avatar e={pu} size={32} />
            <div>
              <b>{pu?.name}</b> <span>{time(p.createdAt)}</span>
            </div>
          </div>
          <div className="text" dangerouslySetInnerHTML={{ __html: fmt(p.text) || snippet(p) }} />
        </div>
        <div className="thread-div">
          {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
        </div>
        {thread.replies.map(row)}
      </div>
      <div className="thread-comp">
        <div className="cbox">
          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply in thread…"
            aria-label="Reply in thread"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="sendbtn" aria-label="Send reply" onClick={send}>
            <Icon n="send-2" s={18} />
          </button>
        </div>
      </div>
    </>
  );
}

function Info({ close }) {
  const { state, act } = useStore();
  const { convs, active, me, msgs } = state;
  const c = convs[active];
  const [tab, setTab] = useState('media');
  const [add, setAdd] = useState(false);
  const [menu, setMenu] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  useEffect(() => setTab('media'), [active]);
  const u = c.type === 'dm' ? otherUser(c, me) : null;
  const role = myRole(c, me);
  const admin = role === 'owner' || role === 'admin';
  const list = msgs[active]?.list || [];
  const media = list.flatMap((m) =>
    m.deleted ? [] : m.attachments.filter((a) => a.kind === 'image' || a.kind === 'video'),
  );
  const files = list.flatMap((m) =>
    m.deleted
      ? []
      : m.attachments.filter((a) => a.kind === 'file' || a.kind === 'audio').map((a) => ({ a, m })),
  );
  const links = list.filter((m) => !m.deleted && /https?:\/\//.test(m.text));
  const pins = list.filter((m) => m.pinned && !m.deleted);
  const tabs = [
    ['media', 'Media', media.length],
    ['files', 'Files', files.length],
    ['links', 'Links', links.length],
    ['pinned', 'Pinned', pins.length],
    ...(c.type === 'group' || c.type === 'channel'
      ? [['members', 'Members', c.members.length]]
      : []),
  ];
  const e = c.type === 'dm' ? u : { id: c.id, name: convTitle(c, me), type: c.type };
  const member = (m) => (
    <div className="mrow" key={m.user.id}>
      <Avatar e={m.user} size={34} pres />
      <span className="mt">
        <b>
          {m.user.id === me.id ? 'You' : m.user.name}{' '}
          {m.role !== 'member' && <span className={`badge ${m.role}`}>{m.role}</span>}
        </b>
        <span>{presence(m.user)}</span>
      </span>
      {admin && m.user.id !== me.id && m.role !== 'owner' && (
        <IconBtn
          n="dots"
          s={16}
          className="sm"
          label={'Manage ' + m.user.name}
          onClick={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            setMenu({ x: r.left - 180, y: r.bottom + 4, m });
          }}
        />
      )}
    </div>
  );
  return (
    <>
      <div className="side-head">
        <h2>
          {c.type === 'dm'
            ? 'Contact info'
            : c.type === 'channel'
              ? 'Channel info'
              : c.type === 'saved'
                ? 'Saved messages'
                : 'Group info'}
        </h2>
        {admin && (c.type === 'group' || c.type === 'channel') && (
          <IconBtn n="pencil" s={17} label="Edit info" onClick={() => setEdit(true)} />
        )}
        <IconBtn n="x" s={18} label="Close details panel" onClick={close} />
      </div>
      <div className="side-body">
        <div className="profile-top">
          <Avatar e={e} size={88} pres={!!u} sq={c.type === 'group' || c.type === 'channel'} />
          <h3>{convTitle(c, me)}</h3>
          {u && <div className="un">@{u.username}</div>}
          <div className={`pst ${u?.status === 'online' ? 'on' : ''}`}>
            {u
              ? presence(u)
              : c.type === 'saved'
                ? 'Notes and files only you can see'
                : `${c.members.length} members`}
          </div>
          {u?.custom && (
            <span className="cstatus">
              {u.custom.emoji} {u.custom.text}
            </span>
          )}
        </div>
        <div className="actrow">
          <button type="button" onClick={() => act.setFlag(c.id, { muted: !c.me?.muted })}>
            <Icon n={c.me?.muted ? 'bell-off' : 'bell'} s={20} />
            <span>{c.me?.muted ? 'Unmute' : 'Mute'}</span>
          </button>
          <button type="button" onClick={() => act.setFlag(c.id, { pinned: !c.me?.pinned })}>
            <Icon n="pin" s={20} />
            <span>{c.me?.pinned ? 'Unpin' : 'Pin'}</span>
          </button>
          <button type="button" onClick={() => act.setFlag(c.id, { archived: !c.me?.archived })}>
            <Icon n="archive" s={20} />
            <span>Archive</span>
          </button>
        </div>
        {(u?.bio || c.desc) && (
          <div className="sec">
            <div className="sec-h">
              <span>{u ? 'About' : 'Description'}</span>
            </div>
            <p style={{ color: 'var(--text-2)', lineHeight: 1.5, paddingBottom: 8 }}>
              {u ? u.bio : c.desc}
            </p>
          </div>
        )}
        {(c.type === 'group' || c.type === 'channel') && <PrivacyPanel conv={c} admin={admin} />}
        <div className="stabs" role="tablist">
          {tabs.map(([k, l, n]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={`tab ${tab === k ? 'active' : ''}`}
              onClick={() => setTab(k)}
            >
              {l} <span className="hint">{n}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          {tab === 'media' &&
            (media.length ? (
              <div className="mgrid">
                {media.map((a, i) => (
                  <button
                    className="pic"
                    key={a.key}
                    aria-label={'Open ' + a.name}
                    onClick={() => setViewer({ items: media, index: i })}
                  >
                    {a.kind === 'video' ? (
                      <video
                        src={a.url}
                        preload="metadata"
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <img className="att-img" loading="lazy" src={a.url} alt="" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-mini">
                <Icon n="photo" s={28} />
                <p>No shared media yet</p>
              </div>
            ))}
          {tab === 'files' &&
            (files.length ? (
              files.map(({ a, m }) => (
                <a
                  key={a.key}
                  className="mrow"
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="file">
                    <span className="fi" style={{ width: 36, height: 36 }}>
                      <Icon n="file-text" s={18} />
                    </span>
                  </span>
                  <span className="mt">
                    <b>{a.name}</b>
                    <span>
                      {size(a.size)} · {dayLabel(m.createdAt)}
                    </span>
                  </span>
                </a>
              ))
            ) : (
              <div className="empty-mini">
                <Icon n="file" s={28} />
                <p>No shared files yet</p>
              </div>
            ))}
          {tab === 'links' &&
            (links.length ? (
              links.map((m) => (
                <div className="mrow" key={m.id}>
                  <span className="mt">
                    <b>{(m.text.match(/https?:\/\/\S+/) || [''])[0]}</b>
                    <span>{dayLabel(m.createdAt)}</span>
                  </span>
                </div>
              ))
            ) : (
              <div className="empty-mini">
                <Icon n="link" s={28} />
                <p>No shared links yet</p>
              </div>
            ))}
          {tab === 'pinned' &&
            (pins.length ? (
              pins.map((m) => (
                <button
                  className="mrow"
                  key={m.id}
                  onClick={() =>
                    document
                      .getElementById('m-' + m.id)
                      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  }
                >
                  <span className="mt">
                    <b>{snippet(m)}</b>
                    <span>{dayLabel(m.createdAt)}</span>
                  </span>
                  <Icon n="pin" s={14} />
                </button>
              ))
            ) : (
              <div className="empty-mini">
                <Icon n="pin" s={28} />
                <p>No pinned messages</p>
              </div>
            ))}
          {tab === 'members' && (
            <>
              {admin && (
                <button
                  className="btn"
                  style={{ width: '100%', margin: '8px 0' }}
                  onClick={() => setAdd(true)}
                >
                  <Icon n="user-plus" s={16} /> Add members
                </button>
              )}
              {c.members.map(member)}
            </>
          )}
        </div>
        {(c.type === 'group' || c.type === 'channel') && (
          <div className="sec pb-4">
            {role === 'owner' ? (
              <Button variant="danger" className="mt-2 w-full" onClick={() => setDel(true)}>
                <Icon n="trash" s={16} /> Delete {c.type}
              </Button>
            ) : (
              <Button
                variant="danger"
                className="mt-2 w-full"
                onClick={async () => {
                  try {
                    await api('DELETE', `/conversations/${c.id}/members/${me.id}`);
                    act.toast(`You left ${c.name}`, { icon: 'logout' });
                  } catch (x) {
                    act.fail(x);
                  }
                }}
              >
                <Icon n="logout" s={16} /> Leave {c.type}
              </Button>
            )}
          </div>
        )}
      </div>
      {menu && (
        <Menu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            role === 'owner'
              ? {
                  label: menu.m.role === 'admin' ? 'Remove admin' : 'Make admin',
                  icon: 'crown',
                  onClick: async () => {
                    try {
                      await api('PATCH', `/conversations/${c.id}/members/${menu.m.user.id}`, {
                        role: menu.m.role === 'admin' ? 'member' : 'admin',
                      });
                    } catch (x) {
                      act.fail(x);
                    }
                  },
                }
              : null,
            {
              label: 'Remove from group',
              icon: 'user-minus',
              danger: true,
              onClick: async () => {
                try {
                  await api('DELETE', `/conversations/${c.id}/members/${menu.m.user.id}`);
                } catch (x) {
                  act.fail(x);
                }
              },
            },
          ]}
        />
      )}
      {add && <AddMembers conv={c} onClose={() => setAdd(false)} />}
      {edit && <EditInfo conv={c} onClose={() => setEdit(false)} />}
      {del && <DeleteChat conv={c} onClose={() => setDel(false)} />}
      {viewer && <Viewer {...viewer} onClose={() => setViewer(null)} />}
    </>
  );
}
function AddMembers({ conv, onClose }) {
  const { act } = useStore();
  const [users, setUsers] = useState([]);
  const [sel, setSel] = useState([]);
  useEffect(() => {
    api('GET', '/users')
      .then((r) => setUsers(r.users.filter((u) => !conv.members.some((m) => m.user.id === u.id))))
      .catch(act.fail);
  }, []);
  return (
    <Modal
      title="Add members"
      onClose={onClose}
      foot={[
        <Button key="c" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="a"
          variant="primary"
          onClick={async () => {
            try {
              await api('POST', `/conversations/${conv.id}/members`, { userIds: sel });
              onClose();
            } catch (e) {
              act.fail(e);
            }
          }}
        >
          Add
        </Button>,
      ]}
    >
      {users.map((u) => (
        <label
          className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover"
          key={u.id}
        >
          <input
            type="checkbox"
            checked={sel.includes(u.id)}
            onChange={() =>
              setSel((s) => (s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id]))
            }
          />
          <Avatar e={u} size={32} />
          <span className="min-w-0">
            <b className="block font-medium">{u.name}</b>
            <span className="text-xs text-ink-3">@{u.username}</span>
          </span>
        </label>
      ))}
      {!users.length && <div className="p-4 text-center text-ink-3">Everyone is already here.</div>}
    </Modal>
  );
}
function EditInfo({ conv, onClose }) {
  const { act, dispatch } = useStore();
  const [name, setName] = useState(conv.name);
  const [desc, setDesc] = useState(conv.desc);
  const [privacy, setPrivacy] = useState(conv.privacy || 'private');
  const [handle, setHandle] = useState(conv.handle || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      const body = { name, desc };
      if (privacy !== (conv.privacy || 'private')) body.privacy = privacy;
      if (privacy !== 'private' && handle !== (conv.handle || '')) body.handle = handle;
      await api('PATCH', `/conversations/${conv.id}`, body);
      const fresh = await api('GET', `/conversations/${conv.id}`); // invite code visibility may have changed
      dispatch({ type: 'conv/upsert', conv: fresh.conversation });
      onClose();
    } catch (e) {
      if (e.code === 'HANDLE_TAKEN' || e.code === 'BAD_HANDLE') setErr(e.message);
      else act.fail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Edit info"
      cls="md"
      onClose={onClose}
      foot={[
        <Button key="c" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="s" variant="primary" disabled={busy} onClick={save}>
          Save
        </Button>,
      ]}
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <PrivacyPicker
        value={privacy}
        onChange={setPrivacy}
        handle={handle}
        onHandle={setHandle}
        name={name}
        error={err}
      />
    </Modal>
  );
}

/** owner-only: type the name to confirm, then everything (members, messages) is deleted for everyone */
function DeleteChat({ conv, onClose }) {
  const { act } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = text.trim() === conv.name;
  const del = async () => {
    setBusy(true);
    try {
      await api('DELETE', `/conversations/${conv.id}`);
      act.toast(`${conv.name} was deleted`, { icon: 'trash' });
      onClose();
    } catch (e) {
      act.fail(e);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Delete ${conv.type}?`}
      onClose={onClose}
      foot={[
        <Button key="c" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="d" variant="dangerFill" disabled={!ok || busy} onClick={del}>
          {busy ? 'Deleting…' : `Delete ${conv.type} forever`}
        </Button>,
      ]}
    >
      <p className="mb-3 leading-relaxed text-ink-2">
        This permanently deletes <b className="text-ink">{conv.name}</b> for all{' '}
        {conv.members.length} {conv.members.length === 1 ? 'member' : 'members'}, including every
        message. This can't be undone.
      </p>
      <Field label={`Type “${conv.name}” to confirm`}>
        <Input value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}
