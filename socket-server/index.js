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
  // Default is 1MB — too small for a base64-encoded image/PDF attachment.
  maxHttpBufferSize: 2 * 1024 * 1024,
});

// ── MongoDB ──────────────────────────────────────────────────────────────────

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Message schema — kept minimal, same shape as Next.js models/Message.ts
const AttachmentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "document"], required: true },
    url: { type: String, required: true },
    name: String,
    mimeType: String,
    size: Number,
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true },
    content: { type: String, default: "" },
    attachment: { type: AttachmentSchema, default: undefined },
    delivered: { type: Boolean, default: false },
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

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;

function estimateBytesFromDataUrl(url) {
  const base64 = url.slice(url.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

// Validates an attachment the same way app/api/posts/route.ts does — the
// client's own checks can always be bypassed, so this is the real gate.
function validateAttachment(attachment) {
  if (!attachment) return { ok: true, clean: undefined };
  if (typeof attachment.url !== "string" || typeof attachment.mimeType !== "string") {
    return { ok: false, error: "Invalid attachment" };
  }
  const allowedTypes =
    attachment.type === "image"
      ? ALLOWED_IMAGE_TYPES
      : attachment.type === "document"
      ? ALLOWED_DOC_TYPES
      : null;
  if (!allowedTypes || !allowedTypes.includes(attachment.mimeType)) {
    return { ok: false, error: "Unsupported attachment type" };
  }
  if (!attachment.url.startsWith(`data:${attachment.mimeType};base64,`)) {
    return { ok: false, error: "Invalid attachment encoding" };
  }
  if (estimateBytesFromDataUrl(attachment.url) > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: "Attachment is too large (max 1.5MB)" };
  }
  return {
    ok: true,
    clean: {
      type: attachment.type,
      url: attachment.url,
      name: typeof attachment.name === "string" ? attachment.name.slice(0, 200) : undefined,
      mimeType: attachment.mimeType,
      size: estimateBytesFromDataUrl(attachment.url),
    },
  };
}

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
  // data: { senderId, recipientId, content, attachment? }
  socket.on("send_message", async ({ senderId, recipientId, content, attachment }) => {
    const trimmed = (content || "").trim();
    if (!senderId || !recipientId || (!trimmed && !attachment)) return;

    const { ok, error, clean } = validateAttachment(attachment);
    if (!ok) {
      socket.emit("message_error", { error });
      return;
    }

    try {
      // If the recipient's socket is registered right now, the emit below
      // reaches them immediately — that's what "delivered" means here.
      const recipientSocketId = onlineUsers.get(recipientId);
      const delivered = !!recipientSocketId;

      // Persist to MongoDB
      const message = await Message.create({
        sender: new mongoose.Types.ObjectId(senderId),
        recipient: new mongoose.Types.ObjectId(recipientId),
        content: trimmed,
        attachment: clean,
        delivered,
      });

      const payload = {
        _id: message._id.toString(),
        sender: senderId,
        recipient: recipientId,
        content: message.content,
        attachment: message.attachment,
        createdAt: message.createdAt,
        delivered,
        read: false,
      };

      // Send back to the sender so they see their own message instantly
      socket.emit("receive_message", payload);

      // Deliver to recipient if they are online
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
