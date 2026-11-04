import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore, convTitle, otherUser, myRole, sideIsOpen } from '../store.jsx';
import { Avatar, Button, Icon, IconBtn, Modal, Viewer } from './ui.jsx';
import Message from './Message.jsx';
import Composer from './Composer.jsx';
import DeleteMessagesDialog from './DeleteMessagesDialog.jsx';
import { RequestBanner, RequestBar } from './MessageRequest.jsx';
import { dayLabel, presence, sameDay, snippet } from '../util.js';
import { subText } from '../helpers.js';

export default function ChatWindow({ openSearch }) {
  const { state, act, dispatch } = useStore();
  const { me, convs, active, msgs, typing, settings } = state;
  const conv = convs[active];
  const data = msgs[active];
  const scroller = useRef(null);
  const bottomRef = useRef(null);
  const stick = useRef(true);
  const lastLen = useRef(0);
  const [reply, setReply] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [confirm, setConfirm] = useState(null); // messages awaiting the delete dialog
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState(null);
  const [away, setAway] = useState(false);
  const [pinIdx, setPinIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setReply(null);
    setEditing(null);
    stick.current = true;
    lastLen.current = 0;
  }, [active]);
  useEffect(() => {
    setSelecting(false);
    setSelected(new Set());
  }, [active]);
  useEffect(() => {
    if (!selecting) return;
    const k = (e) => {
      if (e.key === 'Escape' && !document.querySelector('[role=dialog]')) {
        setSelecting(false);
        setSelected(new Set());
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [selecting]);
  const list = data?.list || [];
  const byId = useMemo(() => Object.fromEntries(list.map((m) => [m.id, m])), [list]);

  useLayoutEffect(() => {
    // keep pinned to bottom for new messages unless the user scrolled up
    const el = scroller.current;
    if (!el) return;
    if (
      stick.current ||
      (list.length && list[list.length - 1].sender === me.id && list.length > lastLen.current)
    )
      el.scrollTop = el.scrollHeight;
    lastLen.current = list.length;
  }, [list.length, data?.loaded, active, typing[active]]);
  const onScroll = (e) => {
    const el = e.currentTarget;
    const far = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = far < 140;
    setAway(far > 300);
  };
  const older = async () => {
    const el = scroller.current,
      h = el.scrollHeight;
    await act.older(active);
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - h;
    });
  };

  if (!conv)
    return (
      <main className="chat-pane">
        <div className="empty">
          <Icon n="message-circle" s={44} />
          <h3>Select a conversation</h3>
          <p>
            Pick a chat from the list or start a new one. Press <b>Ctrl + K</b> to search messages.
          </p>
        </div>
      </main>
    );

  const u = conv.type === 'dm' ? otherUser(conv, me) : null;
  const sub = subText(conv, me, typing);
  const role = myRole(conv, me);
  const canPost = conv.type !== 'channel' || role !== 'member';
  const pins = list.filter((m) => m.pinned && !m.deleted);
  const pin = pins[pins.length - 1 - Math.min(pinIdx, pins.length - 1)];
  const sepN = state.openUnread?.id === active ? state.openUnread.n : 0;
  const sepId = sepN
    ? [...list].reverse().filter((m) => m.sender !== me.id && m.type !== 'system')[sepN - 1]?.id
    : null;
  const tl = typing[active] ? Object.keys(typing[active]).filter((x) => x !== me.id) : [];

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length && canPost) setFiles([...e.dataTransfer.files]);
  };
  const media = list.flatMap((m) =>
    m.deleted ? [] : m.attachments.filter((a) => a.kind === 'image' || a.kind === 'video'),
  );
  const view = (a) =>
    setViewer({
      items: media,
      index: Math.max(
        0,
        media.findIndex((x) => x.key === a.key),
      ),
    });

  return (
    <main
      className="chat-pane"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={onDrop}
    >
      <header className="chat-head">
        <IconBtn
          n="arrow-left"
          s={20}
          label="Back to chats"
          className="back"
          onClick={() => dispatch({ type: 'screen', screen: 'list' })}
        />
        <button
          className="who"
          type="button"
          aria-label="Open chat details"
          onClick={() => dispatch({ type: 'panel', panel: 'info' })}
        >
          <Avatar
            e={conv.type === 'dm' ? u : { id: conv.id, name: convTitle(conv, me), type: conv.type }}
            size={36}
            pres={!!u}
            sq={conv.type === 'group' || conv.type === 'channel'}
          />
          <span className="tt">
            <h2>
              {convTitle(conv, me)}
              {conv.me?.muted && <Icon n="bell-off" s={14} />}
            </h2>
            <div
              className={`sub ${sub.typ ? 'typ' : ''} ${sub.u?.status === 'online' ? 'on' : ''}`}
            >
              {sub.typ && (
                <span className="dots" style={{ marginRight: 4 }}>
                  <i />
                  <i />
                  <i />
                </span>
              )}
              {sub.text ?? presence(sub.u)}
            </div>
          </span>
        </button>
        <div className="acts">
          <IconBtn n="search" label="Search messages" onClick={openSearch} />
          <IconBtn
            n="layout-sidebar-right"
            label="Toggle details panel"
            on={sideIsOpen(state)}
            onClick={() => dispatch({ type: 'side', open: !sideIsOpen(state) })}
          />
          <IconBtn n="dots-vertical" label="More options" onClick={() => setMenuOpen(true)} />
        </div>
      </header>
      {conv.dm?.incoming && <RequestBanner conv={conv} other={u} />}
      {pin && (
        <div
          className="pinbar"
          role="button"
          tabIndex={0}
          onClick={() => {
            document
              .getElementById('m-' + pin.id)
              ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            setPinIdx((i) => (i + 1) % pins.length);
          }}
        >
          <Icon n="pinned" s={18} />
          <div className="pl" />
          <div className="pt">
            <b>
              Pinned message
              {pins.length > 1 ? ` #${pins.length - Math.min(pinIdx, pins.length - 1)}` : ''}
            </b>
            <span>{snippet(pin)}</span>
          </div>
        </div>
      )}
      <div
        className={`msgs wp-${settings.wallpaper}`}
        ref={scroller}
        onScroll={onScroll}
        tabIndex={-1}
        aria-label="Message history"
      >
        <div className="msgs-inner" role="log" aria-live="polite">
          {!data?.loaded && (
            <div className="skeleton-list">
              {[60, 40, 75, 50, 35].map((w, i) => (
                <div
                  key={i}
                  className="skel"
                  style={{
                    height: i % 2 ? 34 : 48,
                    width: w + '%',
                    alignSelf: i % 2 ? 'flex-end' : undefined,
                  }}
                />
              ))}
            </div>
          )}
          {data?.hasMore && (
            <button className="btn ghost loadmore" onClick={older}>
              Load earlier messages
            </button>
          )}
          {data?.loaded && !list.length && (!conv.dm || conv.dm.status === 'accepted') && (
            <div className="empty">
              <h3>No messages yet</h3>Say hello to {convTitle(conv, me)}.
            </div>
          )}
          {list.map((m, i) => (
            <div key={m.id} style={{ display: 'contents' }}>
              {(i === 0 || !sameDay(list[i - 1].createdAt, m.createdAt)) && (
                <div className="dsep">
                  <span>{dayLabel(m.createdAt)}</span>
                </div>
              )}
              {m.id === sepId && (
                <div className="usep">
                  {sepN} unread message{sepN > 1 ? 's' : ''}
                </div>
              )}
              <Message
                m={m}
                prev={list[i - 1]}
                next={list[i + 1]}
                conv={conv}
                me={me}
                byId={byId}
                onView={view}
                onReply={(x) => {
                  setEditing(null);
                  setReply(x);
                }}
                onEdit={(x) => {
                  setReply(null);
                  setEditing(x);
                }}
                onDelete={(x) => setConfirm([x])}
                onSelect={(x) => {
                  setSelecting(true);
                  setSelected(new Set([x.id]));
                }}
                selectMode={selecting}
                isSelected={selected.has(m.id)}
                onToggle={(x) =>
                  setSelected((s) => {
                    const n = new Set(s);
                    n.has(x.id) ? n.delete(x.id) : n.add(x.id);
                    return n;
                  })
                }
              />
            </div>
          ))}
          {tl.length > 0 && (
            <div className="typing-row">
              <span className="tb">
                <span className="dots">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <span>{sub.typ ? sub.text : ''}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      {away && (
        <button
          className="jump"
          type="button"
          aria-label="Jump to latest messages"
          onClick={() =>
            scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
          }
        >
          <Icon n="chevron-down" s={20} />
        </button>
      )}
      {drag && (
        <div className="dropzone">
          <div style={{ textAlign: 'center' }}>
            <Icon n="cloud-upload" s={40} />
            <div>Drop files to upload</div>
          </div>
        </div>
      )}
      {conv.type === 'dm' && conv.dm && conv.dm.status !== 'accepted' ? (
        <RequestBar conv={conv} />
      ) : (
        <Composer
          conv={conv}
          reply={reply}
          editing={editing}
          canPost={canPost}
          files={files}
          clearFiles={() => setFiles(null)}
          onCancel={(m) => {
            setReply(null);
            setEditing(m && m.id ? m : null);
          }}
        />
      )}
      {viewer && <Viewer {...viewer} onClose={() => setViewer(null)} />}
      {confirm && (
        <DeleteMessagesDialog
          messages={confirm}
          conv={conv}
          onClose={() => setConfirm(null)}
          onDone={() => {
            setConfirm(null);
            setSelecting(false);
            setSelected(new Set());
          }}
        />
      )}
      {selecting && (
        <div className="selbar" role="toolbar" aria-label="Selected messages">
          <IconBtn
            n="x"
            s={20}
            label="Cancel selection"
            onClick={() => {
              setSelecting(false);
              setSelected(new Set());
            }}
          />
          <b>{selected.size} selected</b>
          <Button
            variant="dangerFill"
            disabled={!selected.size}
            onClick={() => setConfirm(list.filter((x) => selected.has(x.id)))}
          >
            <Icon n="trash" s={15} /> Delete
          </Button>
        </div>
      )}
      {menuOpen && <ChatMenu conv={conv} onClose={() => setMenuOpen(false)} />}
    </main>
  );
}
import { Menu } from './ui.jsx';
function ChatMenu({ conv, onClose }) {
  const { act, dispatch } = useStore();
  return (
    <Menu
      x={innerWidth - 240}
      y={56}
      onClose={onClose}
      items={[
        {
          label: 'Details',
          icon: 'info-circle',
          onClick: () => dispatch({ type: 'panel', panel: 'info' }),
        },
        {
          label: conv.me?.muted ? 'Unmute notifications' : 'Mute notifications',
          icon: 'bell-off',
          onClick: () => act.setFlag(conv.id, { muted: !conv.me?.muted }),
        },
        {
          label: conv.me?.pinned ? 'Unpin chat' : 'Pin chat',
          icon: 'pin',
          onClick: () => act.setFlag(conv.id, { pinned: !conv.me?.pinned }),
        },
        {
          label: conv.me?.archived ? 'Unarchive' : 'Archive chat',
          icon: 'archive',
          onClick: () => act.setFlag(conv.id, { archived: !conv.me?.archived }),
        },
      ]}
    />
  );
}
