import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "document"], required: true },
    url: { type: String, required: true },
    name: String,
    mimeType: String,
    size: Number,
  },
  { _id: false }
);

const PostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "", maxlength: 2000 },
    media: { type: [MediaSchema], default: [] },
  },
  { timestamps: true }
);

PostSchema.index({ createdAt: -1 });

delete (mongoose.models as any).Post;
export default mongoose.model("Post", PostSchema);
