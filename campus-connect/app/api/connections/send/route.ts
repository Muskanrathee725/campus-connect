import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Connection from "@/models/Connection";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// POST /api/connections/send  body: { recipientId }
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { recipientId } = await req.json();
    if (!recipientId) {
      return NextResponse.json({ error: "recipientId required" }, { status: 400 });
    }

    await connectDB();

    const me = await User.findOne({ email: session.user.email });
    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (me._id.toString() === recipientId) {
      return NextResponse.json({ error: "Cannot connect with yourself" }, { status: 400 });
    }

    // Check if a request already exists in either direction
    const existing = await Connection.findOne({
      $or: [
        { requester: me._id, recipient: recipientId },
        { requester: recipientId, recipient: me._id },
      ],
    });

    if (existing) {
      return NextResponse.json({ error: "Connection already exists" }, { status: 409 });
    }

    const connection = await Connection.create({
      requester: me._id,
      recipient: recipientId,
      status: "pending",
    });

    return NextResponse.json({ success: true, connection });
  } catch (error) {
    console.error("POST /api/connections/send error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
