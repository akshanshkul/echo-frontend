import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { icon } from '../icons.js';
import { avColor, initials } from '../util.js';
import { useStore } from '../store.jsx';
import { useAvatarUrl, forgetAvatar } from '../avatars.js';

/** Brand logo from public/logo (sized variants: 32/64/96/192/512 px) */
export const Logo = ({ size = 34, className = '' }) => {
  const f = size <= 40 ? 'logo-96.png' : size <= 100 ? 'logo-192.png' : 'logo-512.png';
  return (
    <img
      className={`logo-img ${className}`}
      src={`${import.meta.env.BASE_URL}logo/${f}`}
      width={size}
      height={size}
      alt={import.meta.env.VITE_APP_NAME || 'Echo'}
      decoding="async"
    />
  );
};
export const Icon = ({ n, s = 18 }) => (
  <span
    className="ico"
    style={{ display: 'inline-flex' }}
    dangerouslySetInnerHTML={{ __html: icon(n, s) }}
  />
);

export function IconBtn({ n, s = 19, label, on, onClick, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`ibtn ${on ? 'on' : ''} ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      {...rest}
    >
      <Icon n={n} s={s} />
    </button>
  );
}

export function Avatar({ e, size = 40, pres, sq }) {
  const name = e?.name || '?';
  const url = useAvatarUrl(e?.id, e?.avatarV);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <span
      className={`av ${sq ? 'sq' : ''}`}
      style={{ '--sz': size + 'px', '--h': avColor(e?.id || name) }}
      role="img"
      aria-label={name}
    >
      {url && !broken ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => {
            forgetAvatar(e.id, e.avatarV);
            setBroken(true);
          }}
        />
      ) : e?.type === 'saved' ? (
        <Icon n="bookmark" s={size * 0.5} />
      ) : (
        initials(name)
      )}
      {pres && e?.status && <i className={`pres ${e.status}`} />}
    </span>
  );
}

export const cx = (...a) => a.filter(Boolean).join(' ');

/* ---------- Tailwind form primitives ---------- */
const BTN = {
  default: 'border-line-strong bg-elev hover:bg-hover',
  primary: 'border-accent bg-accent text-white hover:brightness-90',
  danger: 'border-danger/40 text-danger hover:bg-hover',
  dangerFill: 'border-danger bg-danger text-white hover:brightness-90',
  ghost: 'border-transparent hover:bg-hover',
};
export function Button({ variant = 'default', className, ...p }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-3.5 text-[13px] font-medium transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        BTN[variant],
        className,
      )}
      {...p}
    />
  );
}
export function Input({ className, ...p }) {
  return (
    <input
      className={cx(
        'h-9 w-full rounded-md border border-transparent bg-field px-2.5 text-[13px] outline-none transition placeholder:text-ink-3 focus:border-accent focus:bg-elev',
        className,
      )}
      {...p}
    />
  );
}
export function Textarea({ className, ...p }) {
  return (
    <textarea
      className={cx(
        'min-h-[72px] w-full resize-y rounded-md border border-transparent bg-field px-2.5 py-2 text-[13px] outline-none transition placeholder:text-ink-3 focus:border-accent focus:bg-elev',
        className,
      )}
      {...p}
    />
  );
}
export function Select({ className, ...p }) {
  return (
    <select
      className={cx(
        'h-9 rounded-md border border-transparent bg-field px-2 text-[13px] outline-none focus:border-accent',
        className,
      )}
      {...p}
    />
  );
}
export function Field({ label, htmlFor, hint, children, className }) {
  return (
    <div className={cx('mb-3 flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-2">
          {label}
        </label>
      )}
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}
export function Switch({ checked, onChange, label }) {
  return (
    <label className="relative inline-block h-5 w-[34px] shrink-0 cursor-pointer">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        onChange={onChange}
        className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
      />
      <span className="absolute inset-0 rounded-full bg-line-strong transition peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
      <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-3.5" />
    </label>
  );
}
export function Segmented({ value, options, onChange, label }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-md bg-field p-0.5"
    >
      {options.map(([k, l, icon]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1 text-[13px] font-medium transition',
            value === k ? 'bg-elev text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
          )}
        >
          {icon && <Icon n={icon} s={16} />}
          {l}
        </button>
      ))}
    </div>
  );
}
export const Row = ({ title, sub, children }) => (
  <div className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
    <span className="min-w-0 flex-1">
      <b className="block font-medium">{title}</b>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </span>
    {children}
  </div>
);

/* ---------- overlays ---------- */
const WIDTH = {
  '': 'max-w-[460px]',
  md: 'max-w-[580px]',
  lg: 'max-w-[860px] h-[min(640px,calc(100dvh-2rem))] max-sm:h-[92dvh]',
};
export function Modal({ title, onClose, children, foot, cls = '' }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid animate-[fade_.16s] place-items-center bg-[var(--scrim)] p-4 max-sm:items-end max-sm:p-0"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'flex max-h-[calc(100dvh-2rem)] w-full animate-[modalIn_.22s_var(--ease)] flex-col rounded-xl border border-line bg-elev shadow-modal max-sm:max-h-[92dvh] max-sm:max-w-none max-sm:rounded-b-none max-sm:animate-[sheetIn_.26s_var(--ease)]',
          WIDTH[cls] ?? WIDTH[''],
        )}
      >
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2.5 pt-3.5">
          <h2 className="flex-1 text-[15px] font-semibold">{title}</h2>
          <IconBtn n="x" s={18} label="Close" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3.5 pt-1">{children}</div>
        {foot && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-line px-4 py-2.5">
            {foot}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Context menu. items: [{label, icon, onClick, danger, check} | {sep:true}] — becomes a bottom sheet on phones */
export function Menu({ x, y, items, top, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, innerHeight - r.height - 8)),
    });
  }, [x, y]);
  useEffect(() => {
    const out = (e) => !ref.current?.contains(e.target) && onClose();
    const key = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', out, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', out, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={ref}
      style={pos}
      role="menu"
      className="fixed z-[80] max-h-[calc(100vh-1rem)] min-w-[210px] max-w-[280px] animate-[menuIn_.14s_var(--ease)] overflow-y-auto rounded-lg border border-line bg-elev p-1 shadow-pop max-sm:!inset-x-0 max-sm:!bottom-0 max-sm:!top-auto max-sm:max-h-[70dvh] max-sm:w-full max-sm:max-w-none max-sm:animate-[sheetIn_.22s_var(--ease)] max-sm:rounded-b-none max-sm:p-2"
    >
      {top}
      {items.filter(Boolean).map((it, i) =>
        it.sep ? (
          <hr key={i} className="my-1 border-line" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              it.onClick?.();
            }}
            className={cx(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] hover:bg-hover focus-visible:bg-hover max-sm:py-3 max-sm:text-sm',
              it.danger ? 'text-danger' : 'text-ink',
            )}
          >
            {it.icon && (
              <span className={it.danger ? '' : 'text-ink-2'}>
                <Icon n={it.icon} s={16} />
              </span>
            )}
            <span className="flex-1">{it.label}</span>
            {it.check && <span className="size-[7px] rounded-full bg-accent" />}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

export function Toasts() {
  const { state } = useStore();
  return createPortal(
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[120] flex flex-col items-end gap-2 max-sm:inset-x-3 max-sm:bottom-[68px] max-sm:items-stretch"
      aria-live="polite"
    >
      {state.toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex max-w-[340px] animate-[toastIn_.25s_var(--ease)] items-center gap-2.5 rounded-lg border border-[#2c3347] bg-[#1c2130] px-3 py-2.5 text-[13px] text-[#f0f3fa] shadow-pop max-sm:max-w-none"
        >
          <Icon n={t.icon || 'circle-check'} s={18} />
          <div className="flex min-w-0 flex-col">
            {t.title ? (
              <>
                <b className="font-semibold">{t.title}</b>
                <span className="max-w-[230px] truncate text-xs text-[#aab3c7]">{t.text}</span>
              </>
            ) : (
              <span>{t.text}</span>
            )}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function Viewer({ items, index, onClose }) {
  const [i, setI] = useState(index);
  const [zoom, setZoom] = useState(false);
  const go = (d) => {
    setI((i + d + items.length) % items.length);
    setZoom(false);
  };
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && items.length > 1) go(1);
      else if (e.key === 'ArrowLeft' && items.length > 1) go(-1);
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });
  const it = items[i];
  return createPortal(
    <div className="viewer" role="dialog" aria-label="Media viewer">
      <div className="vbar">
        <IconBtn n="x" s={20} label="Close viewer" onClick={onClose} />
        <div style={{ flex: 1 }}>
          <b>{it.name}</b>
          <div style={{ fontSize: 12, color: '#9aa4b8' }}>
            {items.length > 1 ? `${i + 1} of ${items.length}` : ''}
          </div>
        </div>
        <IconBtn n="arrows-maximize" s={20} label="Zoom" onClick={() => setZoom(!zoom)} />
        <a
          className="ibtn"
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open original"
        >
          <Icon n="download" s={20} />
        </a>
      </div>
      <div className="vstage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {items.length > 1 && (
          <>
            <button className="nav prev" aria-label="Previous" onClick={() => go(-1)}>
              <Icon n="chevron-left" s={22} />
            </button>
            <button className="nav next" aria-label="Next" onClick={() => go(1)}>
              <Icon n="chevron-right" s={22} />
            </button>
          </>
        )}
        {it.kind === 'video' ? (
          <video src={it.url} controls autoPlay style={{ maxWidth: '92%', maxHeight: '100%' }} />
        ) : (
          <img
            className={zoom ? 'zoom' : ''}
            src={it.url}
            alt={it.name}
            onClick={() => setZoom(!zoom)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

const EMOJI = {
  Smileys:
    '😀 😄 😂 🙂 😉 😍 😘 🤔 😎 😢 😭 😡 😴 🤯 🥳 😅 🙃 😇 🤗 😬 🙄 😱 🥺 😮 😌 🤩 😏 🫠'.split(
      ' ',
    ),
  Gestures: '👍 👎 👏 🙌 🙏 💪 👋 🤝 ✌️ 👌 🤞 🫡 👀 🤙 👊'.split(' '),
  Symbols: '❤️ 🧡 💛 💚 💙 💜 🖤 💔 ✨ 🔥 🎉 💯 ✅ ❌ ⚡ ⭐ ❓ ❗ 💬 🔔'.split(' '),
  Things: '☕ 🍕 🍺 🎂 🎁 💡 💻 📱 🚀 🌴 🌈 🐶 🐱 🎧 📷 🎨 📈 🏆 🧠 🎵'.split(' '),
};
export function EmojiPicker({ onPick, className = '', style }) {
  return (
    <div className={`picker ${className}`} style={style} role="dialog" aria-label="Emoji picker">
      <div className="pb" style={{ paddingTop: 8 }}>
        {Object.entries(EMOJI).map(([k, list]) => (
          <div key={k}>
            <h4>{k}</h4>
            <div className="egrid">
              {list.map((e) => (
                <button type="button" key={e} onClick={() => onPick(e)} aria-label={e}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
