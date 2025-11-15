import io from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export function createSocket(): SocketIOClient.Socket {
  return io(SOCKET_URL, {
    transports: ["polling"],
    upgrade: false,
  });
}
