import { io, Socket } from "socket.io-client";

// Singleton — reuse the same socket across page navigations
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!url) throw new Error("NEXT_PUBLIC_SOCKET_URL is not set in .env.local");

    socket = io(url, {
      transports: ["websocket"],
      autoConnect: false, // we connect manually after registering userId
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
}
