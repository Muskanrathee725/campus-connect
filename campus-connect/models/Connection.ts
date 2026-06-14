import mongoose from "mongoose";

// Tracks connection requests between users.
// status flows: pending → accepted | rejected
const ConnectionSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests between the same pair
ConnectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export default mongoose.models.Connection ||
  mongoose.model("Connection", ConnectionSchema);
