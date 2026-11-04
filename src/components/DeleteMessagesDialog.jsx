import { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { Button, Icon, Modal, cx } from './ui.jsx';
import { canDeleteForEveryone } from '../helpers.js';

/** "Delete for me" is always possible; "Delete for everyone" only while allowed (own messages inside the time limit) */
export default function DeleteMessagesDialog({ messages, conv, onClose, onDone }) {
  const { state, act } = useStore();
  const { me, config } = state;
  const win = config.messageDeleteWindowMinutes;
  const mins = `${win} minute${win === 1 ? '' : 's'}`;
  const n = messages.length;
  const info = useMemo(() => {
    const live = messages.filter((m) => !m.deleted);
    const ok = live.length > 0 && messages.every((m) => canDeleteForEveryone(m, conv, me, win));
    const notMine = messages.filter(
      (m) => m.sender !== me.id && !canDeleteForEveryone(m, conv, me, win),
    ).length;
    const expired = messages.filter(
      (m) => m.sender === me.id && !m.deleted && !canDeleteForEveryone(m, conv, me, win),
    ).length;
    const gone = messages.filter((m) => m.deleted).length;
    let why = '';
    if (!ok) {
      const parts = [];
      if (expired)
        parts.push(
          `${expired === n ? (n > 1 ? 'These were' : 'This was') : `${expired} of them were`} sent more than ${mins} ago`,
        );
      if (notMine)
        parts.push(
          `${notMine === n ? (n > 1 ? 'They are' : 'It is') : `${notMine} of them are`} not your message${notMine > 1 ? 's' : ''}`,
        );
      if (gone) parts.push(`${gone === n ? 'Already deleted' : `${gone} already deleted`}`);
      why = parts.join(' · ');
    }
    // time left, shown for a single own message
    const left =
      n === 1 && ok && win && messages[0].sender === me.id
        ? Math.max(
            1,
            Math.ceil(win - (Date.now() - new Date(messages[0].createdAt).getTime()) / 60000),
          )
        : null;
    return { ok, why, left };
  }, [messages, conv, me, win]);
  const [scope, setScope] = useState(info.ok ? 'everyone' : 'me');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const go = async () => {
    setBusy(true);
    setErr('');
    const r = await act.deleteMessages(
      messages.map((m) => m.id),
      scope,
    );
    setBusy(false);
    if (r.ok) onDone();
    else {
      setErr(r.error);
      if (r.code === 'DELETE_WINDOW_EXPIRED') setScope('me');
    }
  };
  const Opt = ({ id, title, sub, disabled }) => (
    <label
      className={cx(
        'flex items-start gap-3 rounded-lg border p-3',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-hover',
        scope === id && !disabled ? 'border-accent bg-accent-soft' : 'border-line',
      )}
    >
      <input
        type="radio"
        name="scope"
        className="mt-1"
        checked={scope === id}
        disabled={disabled}
        onChange={() => setScope(id)}
      />
      <span className="min-w-0">
        <b className="block font-medium">{title}</b>
        <span className="text-[12.5px] text-ink-3">{sub}</span>
      </span>
    </label>
  );
  return (
    <Modal
      title={n > 1 ? `Delete ${n} messages?` : 'Delete message?'}
      onClose={onClose}
      foot={[
        <Button key="c" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="d" variant="dangerFill" disabled={busy} onClick={go}>
          <Icon n="trash" s={15} /> {busy ? 'Deleting…' : 'Delete'}
        </Button>,
      ]}
    >
      <div className="flex flex-col gap-2">
        <Opt
          id="everyone"
          disabled={!info.ok}
          title="Delete for everyone"
          sub={
            info.ok
              ? info.left
                ? `Removes it for all members. Available for ${info.left} more minute${info.left === 1 ? '' : 's'}.`
                : 'Removes it for all members of this chat.'
              : info.why || 'Not available.'
          }
        />
        <Opt
          id="me"
          title="Delete for me"
          sub="Removes it from your view only. Others still see it. Always available."
        />
      </div>
      {win > 0 && !info.ok && (
        <p className="mt-3 text-xs text-ink-3">
          Messages can be deleted for everyone only by their sender, within {win} minutes of
          sending.
        </p>
      )}
      {err && (
        <p role="alert" className="mt-3 text-[12.5px] text-danger">
          {err}
        </p>
      )}
    </Modal>
  );
}
