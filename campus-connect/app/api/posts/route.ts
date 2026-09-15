import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Post from "@/models/Post";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const MAX_MEDIA_ITEMS = 3;
const MAX_ITEM_BYTES = 1.5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

function estimateBytesFromDataUrl(url: string) {
  const base64 = url.slice(url.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

// GET /api/posts — visible to any logged-in user, verified or not
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    await connectDB();

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("author", "name image role branch year isVerified")
      .lean();

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("GET /api/posts error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// POST /api/posts  body: { content, media? } — only verified CU members can post.
// media items are base64 data URLs (no external storage configured); validated
// server-side since the client's type/size checks can be bypassed.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const body = await req.json();
    const trimmed = (body.content || "").trim();
    const items = Array.isArray(body.media) ? body.media : [];

    if (!trimmed && items.length === 0) {
      return NextResponse.json({ error: "Post needs text or an attachment" }, { status: 400 });
    }
    if (trimmed.length > 2000) {
      return NextResponse.json({ error: "Post is too long (max 2000 characters)" }, { status: 400 });
    }
    if (items.length > MAX_MEDIA_ITEMS) {
      return NextResponse.json(
        { error: `You can attach up to ${MAX_MEDIA_ITEMS} files` },
        { status: 400 }
      );
    }

    let totalBytes = 0;
    const cleanMedia: any[] = [];
    for (const item of items) {
      if (!item || typeof item.url !== "string" || typeof item.mimeType !== "string") {
        return NextResponse.json({ error: "Invalid attachment" }, { status: 400 });
      }
      const allowedTypes =
        item.type === "image" ? ALLOWED_IMAGE_TYPES : item.type === "document" ? ALLOWED_DOC_TYPES : null;
      if (!allowedTypes || !allowedTypes.includes(item.mimeType)) {
        return NextResponse.json({ error: "Unsupported attachment type" }, { status: 400 });
      }
      if (!item.url.startsWith(`data:${item.mimeType};base64,`)) {
        return NextResponse.json({ error: "Invalid attachment encoding" }, { status: 400 });
      }
      const bytes = estimateBytesFromDataUrl(item.url);
      if (bytes > MAX_ITEM_BYTES) {
        return NextResponse.json({ error: "Attachment is too large (max 1.5MB each)" }, { status: 400 });
      }
      totalBytes += bytes;
      cleanMedia.push({
        type: item.type,
        url: item.url,
        name: typeof item.name === "string" ? item.name.slice(0, 200) : undefined,
        mimeType: item.mimeType,
        size: bytes,
      });
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "Attachments are too large combined (max 4MB total)" },
        { status: 400 }
      );
    }

    await connectDB();

    const me = await User.findOne({ email: session.user.email });
    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!me.isVerified) {
      return NextResponse.json(
        { error: "Verify your CU UID to post" },
        { status: 403 }
      );
    }

    const post = await Post.create({ author: me._id, content: trimmed, media: cleanMedia });
    const populated = await post.populate("author", "name image role branch year isVerified");

    return NextResponse.json({ success: true, post: populated });
  } catch (error) {
    console.error("POST /api/posts error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
