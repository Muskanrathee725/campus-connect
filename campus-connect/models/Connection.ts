import mongoose from "mongoose";

const ConnectionSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
}, {
  timestamps: true,
});

// This prevents duplicate connection requests
// between the same two users
ConnectionSchema.index({ sender: 1, receiver: 1 }, { unique: true });

delete (mongoose.models as any).Connection;
export default mongoose.model("Connection", ConnectionSchema);