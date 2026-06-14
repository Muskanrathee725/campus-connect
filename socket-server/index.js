require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // In production set this to your Vercel URL e.g. "https://campus-connect-nu-lovat.vercel.app"
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

// ── MongoDB ──────────────────────────────────────────────────────────────────

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Message schema — kept minimal, same shape as Next.js models/Message.ts
const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for fast conversation queries
MessageSchema.index({ sender: 1, recipient: 1 });
MessageSchema.index({ createdAt: -1 });

const Message =
  mongoose.models.Message || mongoose.model("Message", MessageSchema);

// ── Socket.io ────────────────────────────────────────────────────────────────

// userId → socketId map so we can target specific users
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Client must emit this right after connecting to register themselves
  // data: { userId: string }
  socket.on("register", ({ userId }) => {
    if (!userId) return;
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    console.log(`User ${userId} registered (socket ${socket.id})`);

    // Tell the client their online status is active
    socket.emit("registered", { userId });
  });

  // Client sends a message
  // data: { senderId, recipientId, content }
  socket.on("send_message", async ({ senderId, recipientId, content }) => {
    if (!senderId || !recipientId || !content?.trim()) return;

    try {
      // Persist to MongoDB
      const message = await Message.create({
        sender: new mongoose.Types.ObjectId(senderId),
        recipient: new mongoose.Types.ObjectId(recipientId),
        content: content.trim(),
      });

      const payload = {
        _id: message._id.toString(),
        sender: senderId,
        recipient: recipientId,
        content: message.content,
        createdAt: message.createdAt,
        read: false,
      };

      // Send back to the sender so they see their own message instantly
      socket.emit("receive_message", payload);

      // Deliver to recipient if they are online
      const recipientSocketId = onlineUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("receive_message", payload);
      }
    } catch (err) {
      console.error("send_message error:", err);
      socket.emit("message_error", { error: "Failed to send message" });
    }
  });

  // Mark messages as read
  // data: { senderId, recipientId }  (I am recipientId, marking sender's msgs as read)
  socket.on("mark_read", async ({ senderId, recipientId }) => {
    try {
      await Message.updateMany(
        { sender: senderId, recipient: recipientId, read: false },
        { read: true }
      );
      // Notify sender that their messages were read
      const senderSocketId = onlineUsers.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messages_read", { by: recipientId });
      }
    } catch (err) {
      console.error("mark_read error:", err);
    }
  });

  socket.on("disconnect", () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    }
  });
});

// ── Health check ─────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.send("Campus Connect Socket Server is running"));

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Socket server running on port ${PORT}`));
