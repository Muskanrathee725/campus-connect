import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Store online users
  // Why Map? — O(1) lookup, fast to add/remove users
  const onlineUsers = new Map<string, string>();
  // userId → socketId

  io.on("connection", (socket) => {
    console.log("New connection:", socket.id);

    // When user logs in, register them as online
    socket.on("register", (userId: string) => {
      onlineUsers.set(userId, socket.id);
      // Tell everyone this user is online
      io.emit("user_online", userId);
      console.log(`User ${userId} is online`);
    });

    // When a message is sent
    socket.on("send_message", (data: {
      senderId: string;
      receiverId: string;
      text: string;      // encrypted text
      iv: string;        // for decryption
      messageId: string; // DB id from our API
    }) => {
      // Find receiver's socket
      const receiverSocket = onlineUsers.get(data.receiverId);
      
      if (receiverSocket) {
        // Receiver is online — deliver instantly
        io.to(receiverSocket).emit("receive_message", data);
      }
      // If offline — they'll get it from DB when they open chat
      // This is exactly how WhatsApp works!
    });

    // Typing indicator
    socket.on("typing", (data: { senderId: string; receiverId: string }) => {
      const receiverSocket = onlineUsers.get(data.receiverId);
      if (receiverSocket) {
        io.to(receiverSocket).emit("user_typing", data.senderId);
      }
    });

    // Stop typing
    socket.on("stop_typing", (data: { senderId: string; receiverId: string }) => {
      const receiverSocket = onlineUsers.get(data.receiverId);
      if (receiverSocket) {
        io.to(receiverSocket).emit("user_stop_typing", data.senderId);
      }
    });

    // When user disconnects
    socket.on("disconnect", () => {
      // Find which user this socket belonged to
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          // Tell everyone this user is offline
          io.emit("user_offline", userId);
          console.log(`User ${userId} went offline`);
          break;
        }
      }
    });
  });

  httpServer.listen(3000, () => {
    console.log("> Ready on http://localhost:3000");
  });
});