import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Message from "@/models/Message";
import Connection from "@/models/Connection";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/messages/[userId] — fetch conversation history between me and userId
// Only works if we are accepted connections
export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: otherUserId } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    await connectDB();

    const me = await User.findOne({ email: session.user.email });
    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only allow chat between accepted connections
    const connection = await Connection.findOne({
      $or: [
        { requester: me._id, recipient: otherUserId },
        { requester: otherUserId, recipient: me._id },
      ],
      status: "accepted",
    });

    if (!connection) {
      return NextResponse.json(
        { error: "You are not connected with this user" },
        { status: 403 }
      );
    }

    // Fetch conversation — both directions, sorted oldest first
    const messages = await Message.find({
      $or: [
        { sender: me._id, recipient: otherUserId },
        { sender: otherUserId, recipient: me._id },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    // Also fetch the other user's basic profile for the chat header
    const otherUser = await User.findById(otherUserId, {
      name: 1,
      image: 1,
      branch: 1,
      year: 1,
      role: 1,
    }).lean();

    return NextResponse.json({ messages, otherUser });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
