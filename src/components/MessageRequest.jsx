import { useState } from 'react';
import { useStore, otherUser } from '../store.jsx';
import { Avatar, Button, Icon } from './ui.jsx';

/** shown above the chat when someone has asked permission to message you */
export function RequestBanner({ conv, other }) {
  const { state, act } = useStore();
  const [busy, setBusy] = useState(false);
  const u = other || otherUser(conv, state.me);
  const first = u?.name?.split(' ')[0] || 'This person';
  const run = async (fn) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  return (
    <div
      role="region"
      aria-label="Message request"
      className="shrink-0 border-b border-line bg-head px-4 py-3"
    >
      <div className="mx-auto flex max-w-[880px] flex-wrap items-center gap-3">
        <Avatar e={u} size={40} />
        <div className="min-w-0 flex-1 basis-60">
          <b className="block">{first} wants to send you a message</b>
          <span className="text-[12.5px] text-ink-3">
            They can't see replies from you until you accept. Nothing is sent to them if you
            decline.
          </span>
          {conv.dm.note && (
            <p className="mt-1.5 rounded-md bg-field px-2.5 py-1.5 text-[13px] text-ink-2">
              “{conv.dm.note}”
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => run(() => act.acceptRequest(conv.id))}
          >
            <Icon n="check" s={16} /> Accept
          </Button>
          <Button disabled={busy} onClick={() => run(() => act.declineRequest(conv.id))}>
            Decline
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => run(() => act.declineRequest(conv.id, true))}
          >
            Block
          </Button>
        </div>
      </div>
    </div>
  );
}

/** replaces the composer while messaging isn't allowed yet */
export function RequestBar({ conv }) {
  const { state } = useStore();
  const u = otherUser(conv, state.me);
  const first = u?.name?.split(' ')[0] || 'them';
  let text;
  if (conv.dm.incoming) text = `Accept ${first}'s request above to start chatting.`;
  else if (conv.dm.status === 'declined')
    text = `${first} hasn't accepted your message request. You can ask again later.`;
  else text = `Request sent. You can message ${first} once they accept.`;
  return (
    <div className="shrink-0 border-t border-line bg-head px-4 py-4 text-center text-[13px] text-ink-2">
      <span className="inline-flex items-center gap-2">
        <Icon n={conv.dm.status === 'declined' ? 'ban' : 'clock'} s={16} /> {text}
      </span>
    </div>
  );
}
