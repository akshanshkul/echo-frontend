import { useRef, useState } from 'react';
import { beep, desktopNotify, notifyPermission, requestNotifyPermission } from '../notify.js';
import { APP_NAME } from '../config.js';

import { useStore } from '../store.jsx';
import {
  Avatar,
  Button,
  Field,
  Icon,
  Input,
  Modal,
  Row,
  Segmented,
  Switch,
  Textarea,
  cx,
} from './ui.jsx';
const ACCENTS = ['#3b6fd8', '#12898f', '#6d5bd0', '#d6456b', '#d9822b', '#4f8a3c'];
const WALLS = [
  ['dots', 'Dots'],
  ['none', 'Plain'],
  ['grid', 'Grid'],
  ['diag', 'Lines'],
  ['warm', 'Warm'],
  ['cool', 'Cool'],
  ['sage', 'Sage'],
];
const H = ({ children }) => (
  <h3 className="mb-1 mt-[18px] text-xs font-semibold uppercase tracking-wider text-ink-3 first:mt-3">
    {children}
  </h3>
);

export default function SettingsModal({ onClose }) {
  const { state, act, dispatch } = useStore();
  const { me, settings: s } = state;
  const [page, setPage] = useState('account');
  const [f, setF] = useState({
    name: me.name,
    bio: me.bio || '',
    emoji: me.custom?.emoji || '💬',
    text: me.custom?.text || '',
  });
  const set = (patch) => dispatch({ type: 'settings', patch });
  const fileRef = useRef(null);
  const [perm, setPerm] = useState(notifyPermission());
  const [photoBusy, setPhotoBusy] = useState(false);
  const changePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      await act.setAvatar(file);
      act.toast('Profile photo updated');
    } catch (err) {
      act.fail(err);
    } finally {
      setPhotoBusy(false);
    }
  };
  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await act.removeAvatar();
      act.toast('Profile photo removed');
    } catch (err) {
      act.fail(err);
    } finally {
      setPhotoBusy(false);
    }
  };
  const nav = [
    ['account', 'Account', 'user'],
    ['appearance', 'Appearance', 'palette'],
    ['notifications', 'Notifications', 'bell'],
    ['chat', 'Chat', 'message-circle'],
  ];
  return (
    <Modal title="Settings" cls="lg" onClose={onClose}>
      <div className="-mx-4 -mb-3.5 grid h-full min-h-0 grid-cols-[200px_1fr] max-sm:grid-cols-1 max-sm:grid-rows-[auto_1fr]">
        <nav
          aria-label="Settings categories"
          className="overflow-y-auto border-r border-line p-2 max-sm:flex max-sm:overflow-x-auto max-sm:border-b max-sm:border-r-0 max-sm:p-1"
        >
          {nav.map(([k, l, i]) => (
            <button
              key={k}
              onClick={() => setPage(k)}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 font-medium max-sm:w-auto max-sm:whitespace-nowrap',
                page === k ? 'bg-selected text-ink' : 'text-ink-2 hover:bg-hover',
              )}
            >
              <Icon n={i} s={17} /> {l}
            </button>
          ))}
        </nav>
        <div className="overflow-y-auto px-5 pb-5">
          {page === 'account' && (
            <>
              <H>Profile</H>
              <div className="mb-3 mt-2 flex items-center gap-3.5">
                <button
                  type="button"
                  className="group relative shrink-0 rounded-full"
                  aria-label="Change profile photo"
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy}
                >
                  <Avatar e={me} size={76} pres />
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Icon n={photoBusy ? 'refresh' : 'camera'} s={22} />
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={changePhoto}
                />
                <div className="min-w-0">
                  <b className="text-[15px]">{me.name}</b>
                  <div className="text-xs text-ink-3">@{me.username}</div>
                  <div className="truncate text-xs text-ink-3">
                    {me.email} · {me.phone} <span className="text-online">✓ verified</span>
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    <Button
                      className="h-7 px-2.5 text-xs"
                      disabled={photoBusy}
                      onClick={() => fileRef.current?.click()}
                    >
                      {photoBusy ? 'Uploading…' : me.avatarV ? 'Change photo' : 'Add photo'}
                    </Button>
                    {me.avatarV && (
                      <Button
                        variant="ghost"
                        className="h-7 px-2.5 text-xs text-danger"
                        disabled={photoBusy}
                        onClick={removePhoto}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <Field label="Full name" htmlFor="sn">
                <Input
                  id="sn"
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                />
              </Field>
              <Field label="Bio" htmlFor="sb">
                <Textarea
                  id="sb"
                  maxLength={200}
                  value={f.bio}
                  onChange={(e) => setF({ ...f, bio: e.target.value })}
                />
              </Field>
              <H>Status</H>
              <div className="mb-2 flex gap-2">
                <Input
                  className="w-14 text-center"
                  maxLength={2}
                  value={f.emoji}
                  onChange={(e) => setF({ ...f, emoji: e.target.value })}
                  aria-label="Status emoji"
                />
                <Input
                  placeholder="What's your status?"
                  maxLength={60}
                  value={f.text}
                  onChange={(e) => setF({ ...f, text: e.target.value })}
                  aria-label="Status text"
                />
              </div>
              <div className="mb-3">
                <Segmented
                  label="Presence"
                  value={me.status}
                  onChange={(k) => act.updateProfile({ status: k })}
                  options={[
                    ['online', 'Online'],
                    ['away', 'Away'],
                    ['dnd', 'Do not disturb'],
                  ]}
                />
              </div>
              <H>Privacy</H>
              <Row
                title="Public profile"
                sub={
                  me.publicProfile
                    ? 'Anyone can message you directly, without a request.'
                    : 'Off: people must send a message request and you choose who to accept.'
                }
              >
                <Switch
                  label="Public profile"
                  checked={!!me.publicProfile}
                  onChange={(e) => act.updateProfile({ publicProfile: e.target.checked })}
                />
              </Row>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="primary"
                  onClick={() =>
                    act.updateProfile({
                      name: f.name,
                      bio: f.bio,
                      custom: f.text.trim() ? { emoji: f.emoji, text: f.text } : null,
                    })
                  }
                >
                  Save changes
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    onClose();
                    act.logout();
                  }}
                >
                  <Icon n="logout" s={16} /> Sign out
                </Button>
              </div>
            </>
          )}
          {page === 'appearance' && (
            <>
              <H>Theme</H>
              <Segmented
                label="Theme"
                value={s.theme}
                onChange={(k) => set({ theme: k })}
                options={[
                  ['light', 'Light', 'sun'],
                  ['dark', 'Dark', 'moon'],
                  ['system', 'System', 'device-desktop'],
                ]}
              />
              <H>Accent colour</H>
              <div className="flex gap-2.5 py-1.5">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    aria-label={'Accent ' + a}
                    onClick={() => set({ accent: a })}
                    style={{ background: a }}
                    className={cx(
                      'size-[26px] rounded-full border-2 border-elev transition hover:scale-110',
                      s.accent === a ? 'ring-2 ring-ink' : 'ring-1 ring-line-strong',
                    )}
                  />
                ))}
              </div>
              <H>Message text size</H>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-3">A</span>
                <input
                  type="range"
                  min="12"
                  max="18"
                  value={s.fontSize}
                  onChange={(e) => set({ fontSize: +e.target.value })}
                  className="flex-1 accent-[var(--accent)]"
                  aria-label="Font size"
                />
                <span className="text-lg">A</span>
                <b className="w-9">{s.fontSize}px</b>
              </div>
              <H>Message bubbles</H>
              <Segmented
                label="Bubble style"
                value={s.bubble}
                onChange={(k) => set({ bubble: k })}
                options={[
                  ['rounded', 'Rounded'],
                  ['classic', 'Classic'],
                  ['flat', 'Flat'],
                ]}
              />
              <H>Chat wallpaper</H>
              <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
                {WALLS.map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => set({ wallpaper: k })}
                    className={cx(
                      'msgs wp-' + k,
                      'grid !h-14 !flex-none items-end rounded-md border-2 !p-1.5 text-[11px] text-ink-2',
                      s.wallpaper === k ? 'border-accent' : 'border-line',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </>
          )}
          {page === 'notifications' && (
            <>
              <H>Desktop</H>
              <Row
                title="Desktop notifications"
                sub={
                  perm === 'unsupported'
                    ? 'Not supported by this browser.'
                    : perm === 'denied'
                      ? 'Blocked — allow notifications for this site in your browser settings.'
                      : 'Shown when Echo is in the background. Muted chats and Do not disturb are respected.'
                }
              >
                <Switch
                  label="Desktop notifications"
                  checked={!!s.notifyDesktop && perm === 'granted'}
                  onChange={async (e) => {
                    if (!e.target.checked) return set({ notifyDesktop: false });
                    const r = await requestNotifyPermission();
                    setPerm(r);
                    if (r === 'granted') set({ notifyDesktop: true });
                    else
                      act.toast('Notifications were not allowed by the browser', {
                        icon: 'bell-off',
                      });
                  }}
                />
              </Row>
              <H>Alerts</H>
              <Row
                title="Sound"
                sub="A short chime when a message arrives in another chat or the app is hidden."
              >
                <Switch
                  label="Notification sound"
                  checked={s.notifySound}
                  onChange={(e) => set({ notifySound: e.target.checked })}
                />
              </Row>
              <Row title="Show message preview" sub="Off: notifications only say “New message”.">
                <Switch
                  label="Show message preview"
                  checked={s.notifyPreview}
                  onChange={(e) => set({ notifyPreview: e.target.checked })}
                />
              </Row>
              <div className="mt-3">
                <Button
                  onClick={() => {
                    if (s.notifySound) beep();
                    if (perm === 'granted')
                      desktopNotify({
                        title: APP_NAME,
                        body: 'This is a test notification.',
                        tag: 'test',
                      });
                    else
                      act.toast('This is how in-app alerts look', {
                        title: APP_NAME,
                        icon: 'bell',
                      });
                  }}
                >
                  <Icon n="bell" s={16} /> Send test notification
                </Button>
              </div>
            </>
          )}
          {page === 'chat' && (
            <>
              <H>Composer</H>
              <Row title="Enter to send" sub="Off: Ctrl/Cmd + Enter sends, Enter adds a line">
                <Switch
                  label="Enter to send"
                  checked={s.enterSend}
                  onChange={(e) => set({ enterSend: e.target.checked })}
                />
              </Row>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
