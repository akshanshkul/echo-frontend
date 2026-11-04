import { memo, useState } from 'react';
import { Avatar, Icon, Menu } from './ui.jsx';
import { langExt } from '../code.js';
import { avColor, dur, fmt, size, snippet, time } from '../util.js';
import { QUICK } from './ui.jsx';
import { statusOf } from '../helpers.js';
import { useStore } from '../store.jsx';

function StatusIcon({ st, onRetry }) {
  const map = {
    sending: ['clock', 'Sending'],
    sent: ['check', 'Sent'],
    delivered: ['checks', 'Delivered'],
    read: ['checks', 'Read'],
    failed: ['alert-circle', 'Failed — click to retry'],
  }[st];
  if (!map) return null;
  return (
    <span
      className={`status-ico st-${st}`}
      title={map[1]}
      aria-label={map[1]}
      role={st === 'failed' ? 'button' : undefined}
      tabIndex={st === 'failed' ? 0 : undefined}
      onClick={st === 'failed' ? onRetry : undefined}
    >
      <Icon n={map[0]} s={15} />
    </span>
  );
}

function Voice({ a }) {
  return (
    <div className="voice">
      <Icon n="microphone" s={18} />
      <audio controls preload="none" src={a.url} aria-label="Voice message" />
      <span className="vd">{a.duration ? dur(a.duration) : ''}</span>
    </div>
  );
}
function Poll({ m, me, onVote }) {
  const p = m.poll;
  const tot = p.options.reduce((n, o) => n + o.votes.length, 0);
  return (
    <div className="poll">
      <div className="pq">{p.question}</div>
      <div className="pm">{p.multi ? 'Multiple answers' : 'Select one'}</div>
      {p.options.map((o) => {
        const mine = o.votes.includes(me.id),
          pc = tot ? Math.round((o.votes.length / tot) * 100) : 0;
        return (
          <button
            type="button"
            key={o.id}
            className={`opt ${mine ? 'mine' : ''}`}
            role={p.multi ? 'checkbox' : 'radio'}
            aria-checked={mine}
            onClick={() => onVote(o.id)}
          >
            <span className="bar" style={{ width: pc + '%' }} />
            <span className="rad">
              <Icon n="check" s={11} />
            </span>
            <span>{o.text}</span>
            <span className="pc">{pc}%</span>
          </button>
        );
      })}
      <div className="pm" style={{ margin: '2px 0 0' }}>
        {tot} vote{tot === 1 ? '' : 's'}
      </div>
    </div>
  );
}

/** copy / download / expand buttons inside rendered code blocks */
function onCodeClick(e) {
  const btn = e.target.closest('[data-code-act]');
  if (!btn) return;
  const box = btn.closest('.codeblock');
  const code = box.querySelector('pre').textContent;
  const act = btn.dataset.codeAct;
  if (act === 'expand') {
    box.classList.remove('collapsed');
    btn.remove();
  } else if (act === 'copy') {
    navigator.clipboard?.writeText(code);
    const label = btn.querySelector('span');
    btn.classList.add('done');
    if (label) label.textContent = 'Copied';
    setTimeout(() => {
      btn.classList.remove('done');
      if (label) label.textContent = 'Copy';
    }, 1600);
  } else if (act === 'download') {
    const lang = box.dataset.lang;
    const name = box.dataset.file || 'code.' + langExt(lang);
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function Message({
  m,
  prev,
  next,
  conv,
  me,
  byId,
  onReply,
  onEdit,
  onDelete,
  onSelect,
  selectMode,
  isSelected,
  onToggle,
  onView,
  selectedFlash,
}) {
  const { act } = useStore();
  const [menu, setMenu] = useState(null);
  if (m.type === 'system')
    return (
      <div className="sysmsg" id={'m-' + m.id}>
        {m.text}
      </div>
    );
  const out = m.sender === me.id && conv.type !== 'channel';
  const multi = conv.type === 'group' || conv.type === 'channel';
  const cont = (o) =>
    o &&
    o.type !== 'system' &&
    o.sender === m.sender &&
    Math.abs(new Date(o.createdAt) - new Date(m.createdAt)) < 5 * 6e4;
  const first = !cont(prev),
    last = !cont(next);
  const sender = conv.members.find((x) => x.user.id === m.sender);
  const u = sender?.user;
  const role = sender?.role;
  const rq = m.replyTo && byId[m.replyTo];
  const imgs = m.attachments.filter((a) => a.kind === 'image'),
    vids = m.attachments.filter((a) => a.kind === 'video');
  const files = m.attachments.filter((a) => a.kind === 'file' || a.kind === 'audio'),
    voices = m.attachments.filter((a) => a.kind === 'voice');
  const openMenu = (e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };
  const items = [
    conv.type !== 'channel' || role !== 'member'
      ? { label: 'Reply', icon: 'corner-up-left', onClick: () => onReply(m) }
      : null,
    conv.type === 'group' && !m.threadOf
      ? { label: 'Reply in thread', icon: 'message-2', onClick: () => act.openThread(m) }
      : null,
    m.text
      ? { label: 'Copy text', icon: 'copy', onClick: () => navigator.clipboard?.writeText(m.text) }
      : null,
    { sep: true },
    {
      label: m.pinned ? 'Unpin' : 'Pin',
      icon: m.pinned ? 'pinned' : 'pin',
      onClick: () => act.pin(m),
    },
    { label: m.starred ? 'Remove star' : 'Star', icon: 'star', onClick: () => act.star(m) },
    out && ['text', 'media', 'file'].includes(m.type)
      ? { label: 'Edit', icon: 'pencil', onClick: () => onEdit(m) }
      : null,
    { sep: true },
    { label: 'Select', icon: 'list-check', onClick: () => onSelect(m) },
    { label: 'Delete…', icon: 'trash', danger: true, onClick: () => onDelete(m) },
  ];
  const st = out ? m.status || statusOf(m, conv, me) : null;
  const key = (e) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) {
      const r = e.currentTarget.getBoundingClientRect();
      setMenu({ x: r.left + 40, y: r.top + 20 });
    }
  };
  return (
    <div
      id={'m-' + m.id}
      data-id={m.id}
      className={`msg ${out ? 'out' : 'in'} ${first ? 'first' : ''} ${last ? 'last' : ''} ${m.deleted ? 'deleted' : ''} ${selectedFlash ? 'flash' : ''} ${selectMode ? 'sel-mode' : ''} ${isSelected ? 'selected' : ''}`}
      tabIndex={0}
      role="article"
      aria-label={`${u?.name || ''}, ${time(m.createdAt)}: ${snippet(m)}`}
      onClickCapture={(e) => {
        if (!selectMode) return;
        e.preventDefault();
        e.stopPropagation();
        onToggle(m);
      }}
      aria-selected={selectMode ? !!isSelected : undefined}
      onContextMenu={m.deleted || selectMode ? undefined : openMenu}
      onKeyDown={key}
    >
      {multi && !out && (
        <div className="msg-av">{last && u ? <Avatar e={u} size={32} /> : null}</div>
      )}
      <div className="bubble">
        {!out && multi && first && (
          <div className="msg-name" style={{ color: avColor(m.sender) }}>
            {u?.name || 'Former member'}
            {role && role !== 'member' && <span className={`badge ${role}`}>{role}</span>}
          </div>
        )}
        {m.deleted ? (
          <div className="text">
            <Icon n="ban" s={14} /> This message was deleted
          </div>
        ) : (
          <>
            {rq && (
              <div
                className="rq"
                role="button"
                tabIndex={0}
                onClick={() =>
                  document
                    .getElementById('m-' + rq.id)
                    ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                }
              >
                <div style={{ minWidth: 0 }}>
                  <b>{conv.members.find((x) => x.user.id === rq.sender)?.user.name || 'Message'}</b>
                  <span>{snippet(rq)}</span>
                </div>
              </div>
            )}
            {imgs.length > 0 && (
              <div className={`imggrid g${Math.min(imgs.length, 4)}`}>
                {imgs.slice(0, 4).map((a, i) => (
                  <button
                    type="button"
                    key={a.key}
                    className="pic"
                    aria-label={'Open ' + a.name}
                    onClick={() => onView(a)}
                  >
                    <img className="att-img" loading="lazy" src={a.url} alt={a.name} />
                    {i === 3 && imgs.length > 4 && <span className="more">+{imgs.length - 4}</span>}
                  </button>
                ))}
              </div>
            )}
            {vids.map((a) => (
              <video key={a.key} controls preload="metadata" src={a.url} aria-label={a.name} />
            ))}
            {files.map((a) => (
              <div className="file" key={a.key}>
                <span className="fi">
                  <Icon
                    n={
                      a.mime === 'application/pdf'
                        ? 'file-type-pdf'
                        : a.kind === 'audio'
                          ? 'music'
                          : 'file-text'
                    }
                    s={22}
                  />
                </span>
                <div className="fm">
                  <b>{a.name}</b>
                  <span>{size(a.size)}</span>
                </div>
                <a
                  className="ibtn dl"
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={a.name}
                  aria-label={'Download ' + a.name}
                >
                  <Icon n="download" s={18} />
                </a>
              </div>
            ))}
            {voices.map((a) => (
              <Voice key={a.key} a={a} />
            ))}
            {m.poll && <Poll m={m} me={me} onVote={(id) => act.vote(m, id)} />}
            {m.text && (
              <div
                className="text"
                dangerouslySetInnerHTML={{ __html: fmt(m.text) }}
                onClick={onCodeClick}
              />
            )}
            <span className="meta">
              {m.starred && (
                <span className="starm">
                  <Icon n="star" s={12} />
                </span>
              )}
              {m.pinned && <Icon n="pin" s={12} />}
              {m.edited && <span>edited</span>}
              <time dateTime={m.createdAt}>{time(m.createdAt)}</time>
              {st && <StatusIcon st={st} onRetry={() => act.retry(m)} />}
            </span>
            <div className="clear" />
            {m.reactions?.length > 0 && (
              <div className="reacts">
                {m.reactions.map((r) => {
                  const mine = r.users.includes(me.id);
                  return (
                    <button
                      type="button"
                      key={r.emoji}
                      className={`react ${mine ? 'mine' : ''}`}
                      aria-pressed={mine}
                      onClick={() => act.react(m, r.emoji)}
                    >
                      <span className="e">{r.emoji}</span>
                      {r.users.length}
                    </button>
                  );
                })}
              </div>
            )}
            {m.replyCount > 0 && (
              <button type="button" className="thread-link" onClick={() => act.openThread(m)}>
                {m.replyCount} {m.replyCount === 1 ? 'reply' : 'replies'}
                <Icon n="chevron-right" s={14} />
              </button>
            )}
          </>
        )}
      </div>
      {!m.deleted && !m.id.startsWith('tmp-') && (
        <div className="msg-tools" role="toolbar" aria-label="Message actions">
          <button
            type="button"
            aria-label="React with thumbs up"
            onClick={() => act.react(m, '👍')}
          >
            👍
          </button>
          <button type="button" aria-label="React with heart" onClick={() => act.react(m, '❤️')}>
            ❤️
          </button>
          <button type="button" aria-label="Reply" title="Reply" onClick={() => onReply(m)}>
            <Icon n="corner-up-left" s={16} />
          </button>
          <button
            type="button"
            aria-label="More actions"
            title="More"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMenu({ x: r.left - 160, y: r.bottom + 4 });
            }}
          >
            <Icon n="dots" s={16} />
          </button>
        </div>
      )}
      {menu && (
        <Menu
          x={menu.x}
          y={menu.y}
          items={items}
          onClose={() => setMenu(null)}
          top={
            <div className="mb-1 flex gap-0.5 border-b border-line px-1 pb-1.5 max-sm:justify-around">
              {QUICK.map((e) => (
                <button
                  type="button"
                  key={e}
                  aria-label={'React ' + e}
                  className="grid size-8 place-items-center rounded-md text-lg transition hover:scale-125 hover:bg-hover"
                  onClick={() => {
                    setMenu(null);
                    act.react(m, e);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          }
        />
      )}
    </div>
  );
}
export default memo(Message);
