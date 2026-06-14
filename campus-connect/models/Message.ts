import mongoose from "mongoose";

// Same schema as socket-server/index.js — both read/write the same collection
const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MessageSchema.index({ sender: 1, recipient: 1 });
MessageSchema.index({ createdAt: -1 });

export default mongoose.models.Message ||
  mongoose.model("Message", MessageSchema);
