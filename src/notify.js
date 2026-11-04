/** Desktop notifications + sound for incoming messages (browser Notification API / WebAudio) */
export const notifySupported = () => typeof Notification !== 'undefined';
export const notifyPermission = () => (notifySupported() ? Notification.permission : 'unsupported');

/** asks the browser once; resolves to 'granted' | 'denied' | 'default' | 'unsupported' */
export async function requestNotifyPermission() {
  if (!notifySupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

let audio;
/** short two-tone chime (no audio file needed) */
export function beep() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    [660, 880].forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.08, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.18);
      o.connect(g).connect(audio.destination);
      o.start(t + i * 0.12);
      o.stop(t + i * 0.12 + 0.2);
    });
  } catch {
    /* autoplay policy or no audio device: stay silent */
  }
}

/** shows an OS notification (needs permission). Same `tag` replaces the previous one for that chat. */
export function desktopNotify({ title, body, tag, onClick }) {
  if (notifyPermission() !== 'granted') return null;
  try {
    const n = new Notification(title, {
      body,
      tag,
      icon: `${import.meta.env.BASE_URL}logo/logo-192.png`,
      silent: true, // we play our own sound
    });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
    setTimeout(() => n.close(), 8000);
    return n;
  } catch {
    return null;
  }
}
