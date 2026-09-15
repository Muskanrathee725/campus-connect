import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Post from "@/models/Post";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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

// POST /api/posts  body: { content } — only verified CU members can post
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { content } = await req.json();
    const trimmed = (content || "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Post content is required" }, { status: 400 });
    }
    if (trimmed.length > 2000) {
      return NextResponse.json({ error: "Post is too long (max 2000 characters)" }, { status: 400 });
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

    const post = await Post.create({ author: me._id, content: trimmed });
    const populated = await post.populate("author", "name image role branch year isVerified");

    return NextResponse.json({ success: true, post: populated });
  } catch (error) {
    console.error("POST /api/posts error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
