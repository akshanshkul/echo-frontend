import { io } from 'socket.io-client';
let socket;
export function connectSocket(token, handlers) {
  socket?.close();
  socket = io(import.meta.env.VITE_API_URL || undefined, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
  Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
  return socket;
}
export const emit = (ev, payload) => socket?.emit(ev, payload);
export const disconnectSocket = () => {
  socket?.close();
  socket = null;
};
