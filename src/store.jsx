import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  api,
  setToken,
  getToken,
  uploadFile,
  setAuthFailHandler,
  setApprovalLostHandler,
} from './api.js';
import { APP_NAME } from './config.js';
import { prepareAvatar } from './avatars.js';
import { beep, desktopNotify } from './notify.js';
import { snippet } from './util.js';
import { connectSocket, disconnectSocket, emit } from './socket.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const loadSettings = () => {
  try {
    return {
      theme: 'system',
      accent: '#3b6fd8',
      fontSize: 14,
      bubble: 'rounded',
      wallpaper: 'dots',
      sideOpen: window.innerWidth > 1180,
      listW: 332,
      sideW: 340,
      enterSend: true,
      notifyDesktop: false,
      notifySound: true,
      notifyPreview: true,
      ...JSON.parse(localStorage.getItem('loom.settings')),
    };
  } catch {
    return {
      theme: 'system',
      accent: '#3b6fd8',
      fontSize: 14,
      bubble: 'rounded',
      wallpaper: 'dots',
      sideOpen: window.innerWidth > 1180,
      listW: 332,
      sideW: 340,
      enterSend: true,
      notifyDesktop: false,
      notifySound: true,
      notifyPreview: true,
    };
  }
};
const init = {
  booting: !!getToken(),
  me: null,
  convs: {},
  msgs: {},
  active: null,
  panel: 'info',
  thread: null,
  typing: {},
  toasts: [],
  settings: loadSettings(),
  screen: 'list',
  profileUser: null,
  drawer: false,
  seenReplies: {},
  config: { messageDeleteWindowMinutes: 30 }, // server limits, refreshed after sign-in
};
const narrow = () => window.innerWidth <= 1180;
export const sideIsOpen = (s) => (narrow() ? s.drawer : s.settings.sideOpen);
const withSide = (s, open) =>
  narrow() ? { ...s, drawer: open } : reducer(s, { type: 'settings', patch: { sideOpen: open } });

const upsertMsg = (list = [], msg, tmpId) => {
  let l = tmpId ? list.filter((m) => m.id !== tmpId) : list;
  const i = l.findIndex((m) => m.id === msg.id);
  if (i >= 0) {
    const old = l[i];
    l = l.slice();
    l[i] = {
      ...old,
      ...msg,
      starred: msg.starred ?? old.starred,
      replyCount: msg.replyCount ?? old.replyCount,
    };
    return l;
  }
  return [...l, msg].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};
function reducer(s, a) {
  switch (a.type) {
    case 'boot':
      return { ...s, booting: false };
    case 'me':
      return { ...s, me: a.me, booting: false };
    case 'logout':
      return { ...init, booting: false, settings: s.settings };
    case 'convs':
      return { ...s, convs: Object.fromEntries(a.list.map((c) => [c.id, c])) };
    case 'conv/upsert': {
      const old = s.convs[a.conv.id];
      const merged = { ...old, ...a.conv };
      // "open/create chat" answers for an existing chat carry no activity info: never wipe our unread count / preview with it
      if (old && a.conv.lastMessage === null) {
        merged.lastMessage = old.lastMessage;
        merged.lastMessageAt = old.lastMessageAt;
        merged.unread = old.unread;
      }
      return { ...s, convs: { ...s.convs, [a.conv.id]: merged } };
    }
    case 'conv/patch':
      return s.convs[a.id]
        ? { ...s, convs: { ...s.convs, [a.id]: { ...s.convs[a.id], ...a.patch } } }
        : s;
    case 'conv/remove': {
      const { [a.id]: _, ...rest } = s.convs;
      return { ...s, convs: rest, active: s.active === a.id ? null : s.active };
    }
    case 'side':
      return withSide(s, a.open);
    case 'conv/newmsg': {
      // computed inside the reducer so two messages arriving back-to-back both count
      const c = s.convs[a.id];
      if (!c) return s;
      return {
        ...s,
        convs: {
          ...s.convs,
          [a.id]: {
            ...c,
            lastMessage: a.msg,
            lastMessageAt: a.msg.createdAt,
            unread: a.count ? (c.unread || 0) + 1 : c.unread,
          },
        },
      };
    }
    case 'active':
      return {
        ...s,
        // remember how many unread messages this chat had when it was opened (drives the "N unread" separator)
        openUnread: a.id ? { id: a.id, n: s.convs[a.id]?.unread || 0 } : null,
        drawer: false,
        active: a.id,
        screen: a.id ? 'chat' : 'list',
        thread: null,
        panel: s.panel === 'thread' ? 'info' : s.panel,
      };
    case 'screen':
      return { ...s, screen: a.screen };
    case 'msgs/set':
      return {
        ...s,
        msgs: { ...s.msgs, [a.id]: { list: a.list, hasMore: a.hasMore, loaded: true } },
      };
    case 'msgs/older': {
      const c = s.msgs[a.id];
      return {
        ...s,
        msgs: { ...s.msgs, [a.id]: { ...c, list: [...a.list, ...c.list], hasMore: a.hasMore } },
      };
    }
    case 'msg/upsert': {
      const m = a.msg;
      const c = s.msgs[m.conv] || { list: [], hasMore: false, loaded: false };
      if (m.threadOf) {
        // thread replies live in the thread panel; bump the parent's counter
        const th =
          s.thread && s.thread.id === m.threadOf
            ? { ...s.thread, replies: upsertMsg(s.thread.replies, m, a.tmpId) }
            : s.thread;
        // count each real reply once: ignore optimistic temp copies and ids we already counted
        // (the live event and the HTTP response can both deliver the same reply)
        const isNew = !m.id.startsWith('tmp-') && !(s.seenReplies || {})[m.id];
        const list = c.list.map((p) =>
          p.id === m.threadOf && isNew ? { ...p, replyCount: (p.replyCount || 0) + 1 } : p,
        );
        return {
          ...s,
          thread: th,
          seenReplies: isNew ? { ...s.seenReplies, [m.id]: true } : s.seenReplies,
          msgs: { ...s.msgs, [m.conv]: { ...c, list } },
        };
      }
      return { ...s, msgs: { ...s.msgs, [m.conv]: { ...c, list: upsertMsg(c.list, m, a.tmpId) } } };
    }
    case 'config':
      return { ...s, config: { ...s.config, ...a.config } };
    case 'msgs/hide': {
      // "delete for me": remove these messages from every loaded list (and the open thread)
      const ids = new Set(a.ids);
      const msgs = Object.fromEntries(
        Object.entries(s.msgs).map(([k, c]) => [
          k,
          { ...c, list: c.list.filter((m) => !ids.has(m.id)) },
        ]),
      );
      const thread = s.thread
        ? { ...s.thread, replies: s.thread.replies.filter((m) => !ids.has(m.id)) }
        : s.thread;
      return { ...s, msgs, thread };
    }
    case 'msg/drop': {
      const c = s.msgs[a.conv];
      return c
        ? {
            ...s,
            msgs: { ...s.msgs, [a.conv]: { ...c, list: c.list.filter((m) => m.id !== a.id) } },
          }
        : s;
    }
    case 'msg/patch': {
      const c = s.msgs[a.conv];
      return c
        ? {
            ...s,
            msgs: {
              ...s.msgs,
              [a.conv]: {
                ...c,
                list: c.list.map((m) => (m.id === a.id ? { ...m, ...a.patch } : m)),
              },
            },
          }
        : s;
    }
    case 'thread':
      return withSide(
        { ...s, thread: a.thread, panel: a.thread ? 'thread' : 'info' },
        a.thread ? true : sideIsOpen(s),
      );
    case 'thread/replies':
      return { ...s, thread: { ...s.thread, replies: a.replies } };
    case 'panel':
      return withSide({ ...s, panel: a.panel, profileUser: a.user ?? s.profileUser }, true);
    case 'typing': {
      const t = { ...(s.typing[a.conv] || {}) };
      a.kind ? (t[a.user] = a.kind) : delete t[a.user];
      return { ...s, typing: { ...s.typing, [a.conv]: t } };
    }
    case 'presence': {
      if (s.me && s.me.id === a.user.id) s = { ...s, me: { ...s.me, ...a.user } };
      const convs = Object.fromEntries(
        Object.entries(s.convs).map(([id, c]) => [
          id,
          {
            ...c,
            members: c.members.map((m) => (m.user.id === a.user.id ? { ...m, user: a.user } : m)),
          },
        ]),
      );
      return { ...s, convs };
    }
    case 'read': {
      const c = s.convs[a.conv];
      if (!c) return s;
      const members = c.members.map((m) => (m.user.id === a.user ? { ...m, lastRead: a.at } : m));
      return { ...s, convs: { ...s.convs, [a.conv]: { ...c, members } } };
    }
    case 'toast':
      return {
        ...s,
        toasts: [...s.toasts.slice(-3), { id: a.id, text: a.text, title: a.title, icon: a.icon }],
      };
    case 'toast/rm':
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
    case 'settings': {
      const settings = { ...s.settings, ...a.patch };
      try {
        localStorage.setItem('loom.settings', JSON.stringify(settings));
      } catch {}
      return { ...s, settings };
    }
    default:
      return s;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init);
  const ref = useRef(state);
  ref.current = state;

  const act = useMemo(() => {
    const toast = (text, o = {}) => {
      const id = Math.random().toString(36).slice(2);
      dispatch({ type: 'toast', id, text, ...o });
      setTimeout(() => dispatch({ type: 'toast/rm', id }), 4000);
    };
    const fail = (e) => toast(e.message || 'Something went wrong', { icon: 'alert-circle' });
    const markRead = async (id) => {
      const c = ref.current.convs[id];
      if (!c) return;
      if (c.unread) dispatch({ type: 'conv/patch', id, patch: { unread: 0 } });
      try {
        await api('POST', `/conversations/${id}/read`);
      } catch {}
    };
    const A = {
      toast,
      fail,
      markRead,
      async authed(res) {
        setToken(res.token);
        dispatch({ type: 'me', me: res.user });
      },
      async login(body) {
        A.authed(await api('POST', '/auth/login', body));
      },
      register: (body) => api('POST', '/auth/register', body), // -> { needsVerification, email }; no session until the email link is opened
      resend: (email) => api('POST', '/auth/resend-verification', { email }),
      forgotPassword: (email) => api('POST', '/auth/forgot-password', { email }),
      resetPassword: (token, password) => api('POST', '/auth/reset-password', { token, password }),
      async verifyEmail(token) {
        A.authed(await api('POST', '/auth/verify-email', { token }));
      },
      refreshMe: () =>
        api('GET', '/auth/me')
          .then((r) => dispatch({ type: 'me', me: r.user }))
          .catch(() => {}),
      async savePhone(phone) {
        const r = await api('PUT', '/users/me/phone', { phone });
        dispatch({ type: 'me', me: r.user });
      },
      logout() {
        disconnectSocket();
        setToken('');
        dispatch({ type: 'logout' });
      },
      async openConv(id) {
        dispatch({ type: 'active', id });
        if (!id) return;
        if (!ref.current.msgs[id]?.loaded) {
          try {
            const r = await api('GET', `/conversations/${id}/messages?limit=50`);
            dispatch({ type: 'msgs/set', id, list: r.messages, hasMore: r.hasMore });
          } catch (e) {
            fail(e);
          }
        }
        markRead(id);
      },
      async older(id) {
        const c = ref.current.msgs[id];
        if (!c?.list.length) return;
        const r = await api('GET', `/conversations/${id}/messages?limit=50&before=${c.list[0].id}`);
        dispatch({ type: 'msgs/older', id, list: r.messages, hasMore: r.hasMore });
      },
      async send(conv, body, tempExtras = {}) {
        const me = ref.current.me;
        const tmpId = 'tmp-' + Math.random().toString(36).slice(2);
        const tmp = {
          id: tmpId,
          conv,
          sender: me.id,
          type: 'text',
          text: body.text || '',
          attachments: [],
          reactions: [],
          createdAt: new Date().toISOString(),
          status: 'sending',
          replyTo: body.replyTo || null,
          threadOf: body.threadOf || null,
          ...tempExtras,
          _body: body,
        };
        dispatch({ type: 'msg/upsert', msg: tmp });
        try {
          const r = await api('POST', `/conversations/${conv}/messages`, body);
          dispatch({ type: 'msg/upsert', msg: r.message, tmpId });
          dispatch({
            type: 'conv/patch',
            id: conv,
            patch: { lastMessage: r.message, lastMessageAt: r.message.createdAt },
          });
        } catch (e) {
          dispatch({ type: 'msg/patch', conv, id: tmpId, patch: { status: 'failed' } });
          fail(e);
        }
      },
      async retry(m) {
        dispatch({ type: 'msg/drop', conv: m.conv, id: m.id });
        A.send(m.conv, m._body);
      },
      async edit(m, text) {
        try {
          const r = await api('PATCH', `/messages/${m.id}`, { text });
          dispatch({ type: 'msg/upsert', msg: r.message });
        } catch (e) {
          fail(e);
        }
      },
      async remove(m) {
        try {
          await api('DELETE', `/messages/${m.id}`);
          dispatch({
            type: 'msg/patch',
            conv: m.conv,
            id: m.id,
            patch: { deleted: true, text: '', attachments: [], reactions: [], pinned: false },
          });
        } catch (e) {
          fail(e);
        }
      },
      /** scope: "me" (hide for myself, always allowed) | "everyone" (time-limited, see MESSAGE_DELETE_WINDOW_MINUTES) */
      async deleteMessages(ids, scope) {
        try {
          const r = await api('POST', '/messages/delete', { ids, scope });
          if (scope === 'me') dispatch({ type: 'msgs/hide', ids: r.ids });
          else
            for (const id of r.ids) {
              const conv = Object.keys(ref.current.msgs).find((k) =>
                ref.current.msgs[k].list.some((m) => m.id === id),
              );
              if (conv)
                dispatch({
                  type: 'msg/patch',
                  conv,
                  id,
                  patch: { deleted: true, text: '', attachments: [], reactions: [], pinned: false },
                });
            }
          toast(scope === 'me' ? 'Deleted for you' : 'Deleted for everyone', { icon: 'trash' });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message, code: e.code };
        }
      },
      async react(m, emoji) {
        try {
          const r = await api('POST', `/messages/${m.id}/reactions`, { emoji });
          dispatch({ type: 'msg/upsert', msg: r.message });
        } catch (e) {
          fail(e);
        }
      },
      async pin(m) {
        try {
          const r = await api('POST', `/messages/${m.id}/pin`);
          dispatch({ type: 'msg/upsert', msg: r.message });
          toast(r.message.pinned ? 'Message pinned' : 'Message unpinned', { icon: 'pin' });
        } catch (e) {
          fail(e);
        }
      },
      async star(m) {
        try {
          const r = await api('POST', `/messages/${m.id}/star`);
          dispatch({ type: 'msg/upsert', msg: r.message });
          toast(r.message.starred ? 'Message starred' : 'Star removed', { icon: 'star' });
        } catch (e) {
          fail(e);
        }
      },
      async vote(m, option) {
        try {
          const r = await api('POST', `/messages/${m.id}/vote`, { option });
          dispatch({ type: 'msg/upsert', msg: r.message });
        } catch (e) {
          fail(e);
        }
      },
      async openThread(m) {
        dispatch({ type: 'thread', thread: { id: m.id, conv: m.conv, parent: m, replies: [] } });
        try {
          const r = await api('GET', `/conversations/${m.conv}/messages?threadOf=${m.id}`);
          dispatch({ type: 'thread/replies', replies: r.messages });
        } catch (e) {
          fail(e);
        }
      },
      async createConv(body, { throwErrors = false } = {}) {
        try {
          const r = await api('POST', '/conversations', body);
          dispatch({ type: 'conv/upsert', conv: r.conversation });
          A.openConv(r.conversation.id);
          return r.conversation;
        } catch (e) {
          if (throwErrors) throw e;
          fail(e);
        }
      },
      async acceptRequest(id) {
        try {
          const r = await api('POST', `/conversations/${id}/accept`);
          dispatch({ type: 'conv/upsert', conv: r.conversation });
          const m = await api('GET', `/conversations/${id}/messages?limit=50`);
          dispatch({ type: 'msgs/set', id, list: m.messages, hasMore: m.hasMore });
        } catch (e) {
          fail(e);
        }
      },
      async declineRequest(id, block = false) {
        try {
          await api('POST', `/conversations/${id}/decline`, { block });
          dispatch({ type: 'conv/remove', id });
          toast(block ? 'Request declined and user blocked' : 'Request declined', { icon: 'x' });
        } catch (e) {
          fail(e);
        }
      },
      async setFlag(id, patch) {
        try {
          const r = await api('PATCH', `/conversations/${id}/me`, patch);
          dispatch({
            type: 'conv/patch',
            id,
            patch: { me: { ...ref.current.convs[id].me, ...r.me } },
          });
        } catch (e) {
          fail(e);
        }
      },
      async updateProfile(patch) {
        try {
          const r = await api('PATCH', '/users/me', patch);
          dispatch({ type: 'me', me: r.user });
          toast('Profile updated');
        } catch (e) {
          fail(e);
        }
      },
      async setAvatar(file) {
        const blob = await prepareAvatar(file);
        const { uploadUrl, headers } = await api('POST', '/users/me/avatar/presign', {
          contentType: 'image/jpeg',
          size: blob.size,
        });
        const put = await fetch(uploadUrl, { method: 'PUT', headers, body: blob });
        if (!put.ok)
          throw new Error(
            'Upload to storage failed (' + put.status + '). Check the bucket permissions and CORS.',
          );
        const r = await api('PUT', '/users/me/avatar', { contentType: 'image/jpeg' });
        dispatch({ type: 'me', me: r.user });
      },
      async removeAvatar() {
        const r = await api('DELETE', '/users/me/avatar');
        dispatch({ type: 'me', me: r.user });
      },
      upload: uploadFile,
      typing: (conv, kind) => emit(kind ? 'typing' : 'typing:stop', { conv, kind }),
    };
    return A;
  }, []);

  // expired / revoked session -> back to the sign-in screen
  const refreshMe = () =>
    api('GET', '/auth/me')
      .then((r) => dispatch({ type: 'me', me: r.user }))
      .catch(() => {}); // a 401 is handled globally (back to sign-in)
  useEffect(() => {
    setApprovalLostHandler(refreshMe);
    setAuthFailHandler(() => {
      disconnectSocket();
      dispatch({ type: 'logout' });
      act.toast('Your session expired. Please sign in again.', { icon: 'alert-circle' });
    });
  }, [act]);
  // session bootstrap
  useEffect(() => {
    if (!getToken()) return;
    api('GET', '/auth/me')
      .then((r) => dispatch({ type: 'me', me: r.user }))
      .catch(() => {
        setToken('');
        dispatch({ type: 'boot' });
      });
  }, []);

  // data + realtime once signed in
  useEffect(() => {
    if (!state.me?.onboarded) return;
    api('GET', '/config')
      .then((c) => dispatch({ type: 'config', config: c }))
      .catch(() => {});
    api('GET', '/conversations')
      .then((r) => dispatch({ type: 'convs', list: r.conversations }))
      .catch(act.fail);
    const timers = {};
    const sock = connectSocket(getToken(), {
      'message:new': (m) => {
        const s = ref.current;
        const mine = m.sender === s.me.id;
        const c = s.convs[m.conv];
        dispatch({ type: 'msg/upsert', msg: m });
        if (m.threadOf) return;
        if (!c) {
          api('GET', '/conversations').then((r) =>
            dispatch({ type: 'convs', list: r.conversations }),
          );
          return;
        }
        // "viewing" = the tab is visible AND the window has focus (otherwise alert like any background chat)
        const viewing = s.active === m.conv && !document.hidden && document.hasFocus();
        dispatch({ type: 'conv/newmsg', id: m.conv, msg: m, count: !mine && !viewing });
        if (!mine && viewing) act.markRead(m.conv);
        if (!mine && !viewing && !c.me?.muted) {
          const who = c.members.find((x) => x.user.id === m.sender)?.user.name || 'Someone';
          const title = c.type === 'dm' ? who : `${c.name} · ${who.split(' ')[0]}`;
          const cfg = s.settings;
          const preview = cfg.notifyPreview ? snippet(m) : 'New message';
          if (s.me.status !== 'dnd') {
            act.toast(preview, { title, icon: 'message-circle' });
            if (cfg.notifySound) beep();
            // OS notification only when the user is not looking at the app
            if (cfg.notifyDesktop && (document.hidden || !document.hasFocus()))
              desktopNotify({
                title,
                body: preview,
                tag: m.conv,
                onClick: () => act.openConv(m.conv),
              });
          }
        }
      },
      'message:update': (m) => dispatch({ type: 'msg/upsert', msg: { ...m, starred: undefined } }),
      typing: ({ conv, user, kind }) => {
        dispatch({ type: 'typing', conv, user, kind });
        clearTimeout(timers[conv + user]);
        if (kind)
          timers[conv + user] = setTimeout(
            () => dispatch({ type: 'typing', conv, user, kind: null }),
            4500,
          );
      },
      connect_error: (e) => {
        // either the session is gone, or an admin revoked approval: ask the API which one
        if (e.message === 'unauthorized') refreshMe();
      },
      'messages:hidden': ({ ids }) => dispatch({ type: 'msgs/hide', ids }), // deleted-for-me on another device
      'access:changed': () => refreshMe(), // an admin changed this account's approval
      presence: ({ user }) => dispatch({ type: 'presence', user }),
      read: (r) => dispatch({ type: 'read', conv: r.conv, user: r.user, at: r.at }),
      'conversation:new': (c) => dispatch({ type: 'conv/upsert', conv: c }),
      'conversation:update': (p) => {
        dispatch({ type: 'conv/patch', id: p.id, patch: p });
        if (p.privacy !== undefined)
          // privacy changed: our own view (invite link visibility) may differ now
          api('GET', `/conversations/${p.id}`)
            .then((r) => dispatch({ type: 'conv/patch', id: p.id, patch: r.conversation }))
            .catch(() => {});
      },
      'conversation:removed': ({ id, deleted, name, by }) => {
        dispatch({ type: 'conv/remove', id });
        if (deleted && by !== ref.current.me?.id)
          act.toast(`${name || 'A chat'} was deleted by its owner`, { icon: 'trash' });
      },
      'join-request': ({ conv, name, user, count }) => {
        dispatch({ type: 'conv/patch', id: conv, patch: { pendingRequests: count } });
        act.toast(`${user.name} wants to join ${name}`, { icon: 'user-check' });
      },
      'join-decision': ({ name, approved }) =>
        act.toast(
          approved
            ? `You were approved to join ${name}`
            : `Your request to join ${name} was declined`,
          {
            icon: approved ? 'circle-check' : 'x',
          },
        ),
    });
    return () => sock.close();
  }, [state.me?.id, state.me?.onboarded, act]);

  // coming back to the tab/window: the open chat counts as read now
  useEffect(() => {
    const back = () => {
      const s = ref.current;
      if (s.active && s.convs[s.active]?.unread && !document.hidden && document.hasFocus())
        act.markRead(s.active);
    };
    window.addEventListener('focus', back);
    document.addEventListener('visibilitychange', back);
    return () => {
      window.removeEventListener('focus', back);
      document.removeEventListener('visibilitychange', back);
    };
  }, [act]);

  // apply appearance settings
  const { theme, accent, fontSize, bubble } = state.settings;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const r = document.documentElement;
      r.dataset.theme = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      r.style.setProperty('--accent', accent);
      r.style.setProperty('--fs-msg', fontSize + 'px');
      r.dataset.bubble = bubble;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, accent, fontSize, bubble]);

  const unread = Object.values(state.convs).reduce(
    (n, c) => n + (c.me?.muted || c.me?.archived ? 0 : c.unread || 0),
    0,
  );
  useEffect(() => {
    document.title = (unread ? `(${unread}) ` : '') + APP_NAME;
  }, [unread]);

  return <Ctx.Provider value={{ state, dispatch, act }}>{children}</Ctx.Provider>;
}

/* helpers shared by components */
export const otherUser = (c, me) =>
  c.type === 'dm'
    ? c.members.find((m) => m.user.id !== me.id)?.user
    : c.type === 'saved'
      ? me
      : null;
export const convTitle = (c, me) =>
  c.type === 'dm'
    ? otherUser(c, me)?.name || 'Unknown'
    : c.type === 'saved'
      ? 'Saved Messages'
      : c.name;
export const myRole = (c, me) => c.members.find((m) => m.user.id === me.id)?.role;
