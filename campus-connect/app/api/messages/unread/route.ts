import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Message from "@/models/Message";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/messages/unread
// Returns a map of { senderId: unreadCount } for all unread messages received by me
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    await connectDB();

    const me = await User.findOne({ email: session.user.email });
    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Group unread messages sent TO me, count per sender
    const unread = await Message.aggregate([
      { $match: { recipient: me._id, read: false } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
    ]);

    // Convert to { senderId: count } map
    const counts: Record<string, number> = {};
    for (const item of unread) {
      counts[item._id.toString()] = item.count;
    }

    return NextResponse.json({ counts });
  } catch (error) {
    console.error("GET /api/messages/unread error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
