import { useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Profile pictures live in a private S3 bucket. The API gives every user an `avatarV` version number;
 * the image itself is fetched through short-lived signed URLs, batched into one request and cached per version.
 */
const cache = new Map(); // `${id}:${v}` -> { url, at }
const waiting = new Map(); // key -> [resolve]
let timer = null;
const TTL = 50 * 60 * 1000; // signed URLs last 1h on the server

function flush() {
  timer = null;
  const batch = [...waiting.entries()];
  waiting.clear();
  const ids = [...new Set(batch.map(([k]) => k.split(':')[0]))];
  api('POST', '/users/avatar-urls', { ids })
    .then(({ urls }) => {
      for (const [key, resolvers] of batch) {
        const [id, v] = key.split(':');
        const hit = urls[id];
        const url = hit && String(hit.v) === v ? hit.url : null;
        if (url) cache.set(key, { url, at: Date.now() });
        resolvers.forEach((r) => r(url));
      }
    })
    .catch(() => batch.forEach(([, resolvers]) => resolvers.forEach((r) => r(null))));
}
export function loadAvatarUrl(id, v) {
  const key = `${id}:${v}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.url);
  return new Promise((resolve) => {
    if (!waiting.has(key)) waiting.set(key, []);
    waiting.get(key).push(resolve);
    if (!timer) timer = setTimeout(flush, 25); // collect all avatars on screen into one request
  });
}
export const forgetAvatar = (id, v) => cache.delete(`${id}:${v}`);

/** returns the image URL (or null while loading / when the user has no picture) */
export function useAvatarUrl(id, v) {
  const key = v ? `${id}:${v}` : null;
  const [url, setUrl] = useState(() => (key && cache.get(key)?.url) || null);
  useEffect(() => {
    let live = true;
    if (!v) {
      setUrl(null);
      return;
    }
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) setUrl(hit.url);
    else {
      setUrl(null);
      loadAvatarUrl(id, v).then((u) => live && setUrl(u));
    }
    return () => {
      live = false;
    };
  }, [id, v]);
  return url;
}

/** square-crop + downscale to 512px JPEG in the browser before upload (small files, consistent shape) */
export async function prepareAvatar(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error('Choose a JPG, PNG or WebP image');
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  canvas
    .getContext('2d')
    .drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 512, 512);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Could not process that image');
  return blob;
}
