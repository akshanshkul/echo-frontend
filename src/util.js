import { icon } from './icons.js';
export { esc } from './util-esc.js';
import { esc } from './util-esc.js';
import { renderCodeBlock } from './code.js';
export const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
export const avColor = (id) => `var(--av-${hash(String(id)) % 8})`;
export const initials = (n) =>
  String(n || '?')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
export const time = (d) =>
  new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dkey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};
export const sameDay = (a, b) => dkey(a) === dkey(b);
export function dayLabel(d) {
  const x = new Date(d),
    n = new Date();
  const diff = Math.round(
    (new Date(n.getFullYear(), n.getMonth(), n.getDate()) -
      new Date(x.getFullYear(), x.getMonth(), x.getDate())) /
      864e5,
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return x.toLocaleDateString([], { weekday: 'long' });
  return x.toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: x.getFullYear() === n.getFullYear() ? undefined : 'numeric',
  });
}
export function listTime(d) {
  const x = new Date(d),
    n = new Date();
  const diff = Math.round(
    (new Date(n.getFullYear(), n.getMonth(), n.getDate()) -
      new Date(x.getFullYear(), x.getMonth(), x.getDate())) /
      864e5,
  );
  if (diff <= 0) return time(d);
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return x.toLocaleDateString([], { weekday: 'short' });
  return x.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export const size = (b) =>
  b < 1024
    ? b + ' B'
    : b < 1048576
      ? (b / 1024).toFixed(0) + ' KB'
      : (b / 1048576).toFixed(1) + ' MB';
export const dur = (s) => {
  s = Math.round(s || 0);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
export function presence(u) {
  if (!u) return '';
  if (u.status === 'online') return 'online';
  if (u.status === 'away') return 'away';
  if (u.status === 'dnd') return 'do not disturb';
  const d = Date.now() - new Date(u.lastSeen).getTime();
  if (d < 36e5) return `last seen ${Math.max(1, Math.round(d / 6e4))} min ago`;
  return sameDay(u.lastSeen, Date.now())
    ? 'last seen today at ' + time(u.lastSeen)
    : 'last seen ' + dayLabel(u.lastSeen).toLowerCase();
}
export const plain = (s) =>
  String(s || '')
    .replace(/```[\w+#.-]*[ \t]*[^\n`]*\n?([\s\S]*?)```/g, '$1')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/* ---- rich text: input is HTML-escaped first, so the output is safe for dangerouslySetInnerHTML ---- */
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(c);
    return '\u0001' + (codes.length - 1) + '\u0001';
  });
  s = s
    .replace(
      /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_\n]+)__/g, '<u>$1</u>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,!?)])/g, '$1<i>$2</i>')
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(
      /(^|[\s(])@([\p{L}][\p{L}\d_.]*)/gu,
      (m, p, n) => `${p}<span class="mention">@${n}</span>`,
    );
  return s.replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${codes[i]}</code>`);
}
export function fmt(raw) {
  const blocks = [];
  const hold = (html) => {
    blocks.push(html);
    return '\u0002' + (blocks.length - 1) + '\u0002';
  };
  // ```lang filename \n code ```   (language and file name are optional)
  let t = String(raw || '')
    .replace(/```([\w+#.-]*)[ \t]*([^\n`]*)\n([\s\S]*?)```/g, (_, l, file, c) =>
      hold(renderCodeBlock(l, file.trim(), c.replace(/\n$/, ''))),
    )
    .replace(/```([\s\S]*?)```/g, (_, c) =>
      hold(renderCodeBlock('', '', c.replace(/^\n|\n$/g, ''))),
    );
  const lines = esc(t).split('\n');
  let out = '',
    list = null,
    q = false;
  const close = () => {
    if (list) {
      out += `</${list}>`;
      list = null;
    }
    if (q) {
      out += '</blockquote>';
      q = false;
    }
  };
  lines.forEach((ln, i) => {
    let m;
    if ((m = ln.match(/^\s*[-•*] (.*)/))) {
      if (list !== 'ul') {
        close();
        out += '<ul>';
        list = 'ul';
      }
      out += '<li>' + inline(m[1]) + '</li>';
    } else if ((m = ln.match(/^\s*\d+[.)] (.*)/))) {
      if (list !== 'ol') {
        close();
        out += '<ol>';
        list = 'ol';
      }
      out += '<li>' + inline(m[1]) + '</li>';
    } else if ((m = ln.match(/^&gt; ?(.*)/))) {
      if (!q) {
        close();
        out += '<blockquote>';
        q = true;
      } else out += '\n';
      out += inline(m[1]);
    } else {
      close();
      out +=
        inline(ln) +
        (i < lines.length - 1 && !/\u0002\d+\u0002$/.test(ln) && !/^\u0002/.test(lines[i + 1] || '')
          ? '\n'
          : '');
    }
  });
  close();
  return out.replace(/\u0002(\d+)\u0002/g, (_, i) => blocks[i]).replace(/\n$/, '');
}
export const snippet = (m) => {
  if (!m) return '';
  if (m.deleted) return 'Deleted message';
  if (m.type === 'media')
    return (
      (m.attachments[0]?.kind === 'video'
        ? 'Video'
        : m.attachments.length > 1
          ? m.attachments.length + ' photos'
          : 'Photo') + (m.text ? ' · ' + plain(m.text) : '')
    );
  if (m.type === 'voice') return 'Voice message';
  if (m.type === 'file') return m.attachments[0]?.name || 'File';
  if (m.type === 'poll') return 'Poll · ' + m.poll?.question;
  return plain(m.text) || 'Message';
};
