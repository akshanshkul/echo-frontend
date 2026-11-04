const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
let token = localStorage.getItem('loom.token') || '';
export const getToken = () => token;
export const setToken = (t) => {
  token = t || '';
  t ? localStorage.setItem('loom.token', t) : localStorage.removeItem('loom.token');
};
let onAuthFail;
export const setAuthFailHandler = (fn) => {
  onAuthFail = fn;
};
let onApprovalLost;
export const setApprovalLostHandler = (fn) => {
  onApprovalLost = fn;
};
export class ApiError extends Error {
  constructor(msg, status, code) {
    super(msg);
    this.status = status;
    this.code = code;
  }
}
export async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: 'Bearer ' + token }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/auth/')) {
    setToken('');
    onAuthFail?.();
  }
  if (res.status === 403 && data.code === 'APPROVAL_REQUIRED') onApprovalLost?.(); // an admin revoked access
  if (!res.ok) throw new ApiError(data.error || 'Request failed', res.status, data.code);
  return data;
}
/** Upload a File straight to S3 with a presigned URL; resolves to the attachment descriptor to send with a message. */
export async function uploadFile(file, { kind, onProgress, extra = {} } = {}) {
  const contentType = file.type || 'application/octet-stream';
  const { key, uploadUrl, headers } = await api('POST', '/uploads/presign', {
    filename: file.name,
    contentType,
    size: file.size,
  });
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error('Upload to storage failed (' + xhr.status + ')'));
    xhr.onerror = () => reject(new Error('Upload failed — check the bucket CORS settings'));
    xhr.send(file);
  });
  const k =
    kind ||
    (contentType.startsWith('image/')
      ? 'image'
      : contentType.startsWith('video/')
        ? 'video'
        : contentType.startsWith('audio/')
          ? 'audio'
          : 'file');
  return { key, name: file.name, size: file.size, mime: contentType, kind: k, ...extra };
}
