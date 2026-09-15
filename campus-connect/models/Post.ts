import mongoose from "mongoose";

const PostSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

PostSchema.index({ createdAt: -1 });

delete (mongoose.models as any).Post;
export default mongoose.model("Post", PostSchema);
