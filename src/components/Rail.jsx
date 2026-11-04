import { useStore } from '../store.jsx';
import { Avatar, Icon, Logo } from './ui.jsx';
export const SECTIONS = [
  ['all', 'message-circle', 'All Chats'],
  ['personal', 'user', 'Personal Messages'],
  ['groups', 'users-group', 'Groups'],
  ['channels', 'speakerphone', 'Channels'],
  ['discover', 'compass', 'Discover'],
  ['unread', 'mail', 'Unread Messages'],
  ['requests', 'user-plus', 'Message Requests'],
  ['starred', 'star', 'Starred Messages'],
  ['archived', 'archive', 'Archived Chats'],
  ['saved', 'bookmark', 'Saved Messages'],
];
export default function Rail({ section, setSection, openSettings }) {
  const { state, act } = useStore();
  const convs = Object.values(state.convs);
  const badge = (s) => {
    const live = convs.filter((c) => !c.me?.archived);
    const n =
      s === 'all'
        ? live.filter((c) => !c.me?.muted).reduce((a, c) => a + (c.unread || 0), 0)
        : s === 'unread'
          ? live.filter((c) => c.unread && !c.dm?.incoming).length
          : s === 'requests'
            ? live.filter((c) => c.dm?.incoming).length
            : s === 'groups'
              ? live.filter((c) => c.type === 'group').reduce((a, c) => a + (c.unread || 0), 0)
              : s === 'channels'
                ? live.filter((c) => c.type === 'channel').reduce((a, c) => a + (c.unread || 0), 0)
                : 0;
    return n ? <span className="bdg">{n > 99 ? '99+' : n}</span> : null;
  };
  const go = (s) => {
    if (s === 'saved') {
      const c = convs.find((x) => x.type === 'saved');
      if (c) act.openConv(c.id);
      return;
    }
    setSection(s);
    act.openConv(null);
  };
  return (
    <nav className="rail" aria-label="Primary navigation">
      <div className="rail-logo img">
        <Logo size={36} />
      </div>
      {SECTIONS.map(([k, ic, label]) => (
        <button
          key={k}
          type="button"
          className={`rail-btn ${section === k ? 'active' : ''} ${['all', 'groups', 'channels', 'unread', 'requests'].includes(k) ? '' : 'hide-m'}`}
          data-tip={label}
          aria-label={label}
          onClick={() => go(k)}
        >
          <Icon n={ic} s={21} />
          {badge(k)}
        </button>
      ))}
      <div className="rail-gap" />
      <button
        type="button"
        className="rail-btn"
        data-tip="Settings"
        aria-label="Settings"
        onClick={openSettings}
      >
        <Icon n="settings" s={21} />
      </button>
      <button
        type="button"
        className="rail-btn hide-m"
        data-tip={state.me.name}
        aria-label="Your profile"
        onClick={openSettings}
        style={{ width: 'auto', height: 'auto', borderRadius: '50%' }}
      >
        <Avatar e={{ ...state.me, status: state.me.status }} size={34} pres />
      </button>
    </nav>
  );
}
