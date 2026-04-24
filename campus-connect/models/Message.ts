import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Encrypted text (AES-256) — server never sees plain text
  text: {
    type: String,
    required: true,
  },
  // IV (random salt) needed to decrypt on frontend
  iv: {
    type: String,
    required: true,
  },
  // For WhatsApp-style ticks
  read: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true, // gives us createdAt for message ordering
});

// This index makes fetching conversation between
// two users FAST — without it MongoDB scans entire collection
MessageSchema.index({ sender: 1, receiver: 1 });

delete (mongoose.models as any).Message;
export default mongoose.model("Message", MessageSchema);