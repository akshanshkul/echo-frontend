import { otherUser } from './store.jsx';
import { snippet } from './util.js';
export function typingLabel(conv, typingMap, me) {
  const t = typingMap?.[conv.id];
  if (!t) return '';
  const ids = Object.keys(t).filter((u) => u !== me.id);
  if (!ids.length) return '';
  const names = ids.map(
    (u) => conv.members.find((m) => m.user.id === u)?.user.name.split(' ')[0] || 'Someone',
  );
  const kind = t[ids[0]];
  const solo = conv.type === 'dm';
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? names.join(' and ')
        : names.length + ' people';
  const verb =
    kind === 'recording'
      ? 'recording audio…'
      : kind === 'uploading'
        ? 'sending a file…'
        : 'typing…';
  return solo ? verb : `${who} ${names.length > 1 ? 'are' : 'is'} ${verb}`;
}
/** sent → read, computed from every other member's lastRead */
export function statusOf(m, conv, me) {
  if (m.status) return m.status;
  const others = conv.members.filter((x) => x.user.id !== me.id);
  if (!others.length) return 'read';
  return others.every((x) => new Date(x.lastRead) >= new Date(m.createdAt))
    ? 'read'
    : others.some((x) => x.user.status === 'online')
      ? 'delivered'
      : 'sent';
}
export const subText = (c, me, typing) => {
  const t = typingLabel(c, typing, me);
  if (t) return { text: t, typ: true };
  if (c.type === 'dm') {
    const u = otherUser(c, me);
    return { u };
  }
  if (c.type === 'saved') return { text: 'Notes and files only you can see' };
  if (c.type === 'channel') return { text: c.members.length + ' subscribers · channel' };
  const on = c.members.filter((m) => m.user.status === 'online').length;
  return { text: `${c.members.length} members, ${on} online` };
};
export { snippet };

/** can I delete this message for EVERYONE? (own messages only inside the time window; admins may moderate groups) */
export function canDeleteForEveryone(m, conv, me, windowMin) {
  if (m.deleted || String(m.id).startsWith('tmp-')) return false;
  if (m.sender === me.id) {
    return !windowMin || Date.now() - new Date(m.createdAt).getTime() <= windowMin * 60000;
  }
  const role = conv.members.find((x) => x.user.id === me.id)?.role;
  return conv.type !== 'dm' && (role === 'owner' || role === 'admin');
}
