import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { Avatar, Button, Field, Icon, Input, Modal, Segmented, Textarea, cx } from './ui.jsx';
import { PrivacyPicker } from './PrivacyPicker.jsx';
import { presence } from '../util.js';

const Person = ({ children, ...p }) => (
  <label
    {...p}
    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-hover"
  >
    {children}
  </label>
);

export default function NewChatModal({ onClose, initialType = 'dm' }) {
  const { act, state } = useStore();
  const [reqUser, setReqUser] = useState(null); // private profile: ask for permission first
  const [note, setNote] = useState('');
  const [type, setType] = useState(initialType);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [sel, setSel] = useState([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [privacy, setPrivacy] = useState(initialType === 'channel' ? 'public' : 'private');
  const [handle, setHandle] = useState('');
  const [handleErr, setHandleErr] = useState('');
  const [busy, setBusy] = useState(false);
  const group = type !== 'dm';
  const label = type === 'channel' ? 'channel' : 'group';

  useEffect(() => {
    const t = setTimeout(
      () =>
        api('GET', '/users?q=' + encodeURIComponent(q))
          .then((r) => setUsers(r.users))
          .catch(act.fail),
      200,
    );
    return () => clearTimeout(t);
  }, [q]);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const pickType = (t) => {
    setType(t);
    if (t !== 'dm') setPrivacy(t === 'channel' ? 'public' : 'private'); // sensible default per kind
  };

  const create = async () => {
    setHandleErr('');
    if (!name.trim()) return act.toast(`Give your ${label} a name`, { icon: 'alert-circle' });
    if (type === 'group' && privacy === 'private' && !sel.length)
      return act.toast('Add at least one person to a private group', { icon: 'alert-circle' });
    setBusy(true);
    try {
      const c = await act.createConv(
        { type, name, desc, memberIds: sel, privacy, handle },
        { throwErrors: true },
      );
      if (c) onClose();
    } catch (e) {
      if (e.code === 'HANDLE_TAKEN' || e.code === 'BAD_HANDLE') setHandleErr(e.message);
      else act.fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (reqUser) {
    const send = async () => {
      setBusy(true);
      const c = await act.createConv({ type: 'dm', userId: reqUser.id, note });
      setBusy(false);
      if (c) {
        act.toast(`Message request sent to ${reqUser.name.split(' ')[0]}`, { icon: 'send' });
        onClose();
      }
    };
    return (
      <Modal
        title="Send message request"
        onClose={onClose}
        foot={[
          <Button key="b" onClick={() => setReqUser(null)}>
            Back
          </Button>,
          <Button key="s" variant="primary" disabled={busy} onClick={send}>
            Send request
          </Button>,
        ]}
      >
        <div className="mb-4 flex items-center gap-3">
          <Avatar e={reqUser} size={48} />
          <div className="min-w-0">
            <b className="block text-[15px]">{reqUser.name}</b>
            <span className="text-xs text-ink-3">@{reqUser.username}</span>
          </div>
        </div>
        <p className="mb-3 text-ink-2">
          {reqUser.name.split(' ')[0]}'s profile is private. They need to accept your request before
          either of you can send messages.
        </p>
        <Field label="Add a short note (optional)" hint={`${note.length}/200`}>
          <Textarea
            autoFocus
            maxLength={200}
            placeholder={`Hi ${reqUser.name.split(' ')[0]}, …`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </Modal>
    );
  }

  return (
    <Modal
      title={type === 'dm' ? 'New message' : `New ${label}`}
      onClose={onClose}
      cls="md"
      foot={
        group
          ? [
              <Button key="c" onClick={onClose}>
                Cancel
              </Button>,
              <Button key="k" variant="primary" disabled={busy} onClick={create}>
                {busy ? 'Creating…' : `Create ${label}`}
              </Button>,
            ]
          : null
      }
    >
      <div className="mb-3">
        <Segmented
          label="Chat type"
          value={type}
          onChange={pickType}
          options={[
            ['dm', 'Message', 'message-circle'],
            ['group', 'Group', 'users-group'],
            ['channel', 'Channel', 'speakerphone'],
          ]}
        />
      </div>

      {group && (
        <>
          <p className="mb-3 text-xs leading-snug text-ink-3">
            {type === 'channel'
              ? 'Channels broadcast to many people — only admins post, everyone else reads and reacts.'
              : 'Groups are for conversations where every member can post.'}
          </p>
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoFocus
              placeholder={type === 'channel' ? 'e.g. Product updates' : 'e.g. Weekend trip'}
            />
          </Field>
          <Field label="Description (optional)">
            <Textarea
              className="min-h-[56px]"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={300}
              placeholder="What is this about?"
            />
          </Field>
          <PrivacyPicker
            value={privacy}
            onChange={setPrivacy}
            handle={handle}
            onHandle={setHandle}
            name={name}
            error={handleErr}
          />
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-ink-2">
              Add people{' '}
              <span className="font-normal text-ink-3">
                {type === 'group' && privacy === 'private' ? '(at least one)' : '(optional)'}
              </span>
            </span>
            {sel.length > 0 && <span className="text-xs text-accent">{sel.length} selected</span>}
          </div>
        </>
      )}

      <div className="relative mb-2">
        <span className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3">
          <Icon n="search" s={16} />
        </span>
        <Input
          className="pl-8"
          placeholder="Search people by name or @username"
          aria-label="Search people"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className={cx('overflow-auto', group ? 'max-h-48' : 'max-h-80')}>
        {users.map((u) =>
          type === 'dm' ? (
            <Person
              key={u.id}
              onClick={async (e) => {
                e.preventDefault();
                const existing = Object.values(state.convs).find(
                  (c) => c.type === 'dm' && c.members.some((m) => m.user.id === u.id),
                );
                if (existing) {
                  act.openConv(existing.id);
                  return onClose();
                }
                if (!u.publicProfile) return setReqUser(u); // needs a message request
                const c = await act.createConv({ type: 'dm', userId: u.id });
                if (c) onClose();
              }}
            >
              <Avatar e={u} size={36} pres />
              <span className="min-w-0">
                <b className="block font-medium">
                  {u.name}
                  {u.publicProfile && (
                    <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-px align-middle text-[10.5px] font-semibold text-accent">
                      Public
                    </span>
                  )}
                </b>
                <span className="text-xs text-ink-3">{presence(u)}</span>
              </span>
            </Person>
          ) : (
            <Person key={u.id}>
              <input type="checkbox" checked={sel.includes(u.id)} onChange={() => toggle(u.id)} />
              <Avatar e={u} size={32} />
              <span className="min-w-0">
                <b className="block font-medium">{u.name}</b>
                <span className="text-xs text-ink-3">@{u.username}</span>
              </span>
            </Person>
          ),
        )}
        {!users.length && (
          <div className="p-4 text-center text-ink-3">
            No people found. Invite someone to register first.
          </div>
        )}
      </div>
    </Modal>
  );
}
