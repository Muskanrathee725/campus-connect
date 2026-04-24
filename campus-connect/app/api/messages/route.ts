import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Message from "@/models/Message";
import Connection from "@/models/Connection";

// GET conversation between two users
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const otherUserId = searchParams.get("userId");
    // Why query param? — GET requests can't have body
    // so we pass the other user's ID in URL like
    // /api/messages?userId=abc123

    if (!otherUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const currentUser = await User.findOne({ email: session.user.email });

    // Security check — only connected users can see messages
    const connection = await Connection.findOne({
      status: "accepted",
      $or: [
        { sender: currentUser._id, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUser._id }
      ]
    });

    if (!connection) {
      return NextResponse.json({ error: "Not connected" }, { status: 403 });
    }

    // Fetch all messages between these two users
    // sorted by createdAt so oldest message is first (like WhatsApp)
    const messages = await Message.find({
      $or: [
        { sender: currentUser._id, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUser._id }
      ]
    }).sort({ createdAt: 1 });

    // Mark all received messages as read
    // Why? — for the blue tick ✓✓ system
    await Message.updateMany({
      sender: otherUserId,
      receiver: currentUser._id,
      read: false
    }, { read: true });

    return NextResponse.json({ messages });

  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// SEND a message
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { receiverId, text, iv } = await req.json();
    // text — already encrypted by frontend using AES-256
    // iv — random salt used during encryption
    // server never sees plain text message!

    const currentUser = await User.findOne({ email: session.user.email });

    // Security check — only connected users can message
    const connection = await Connection.findOne({
      status: "accepted",
      $or: [
        { sender: currentUser._id, receiver: receiverId },
        { sender: receiverId, receiver: currentUser._id }
      ]
    });

    if (!connection) {
      return NextResponse.json({ error: "Not connected" }, { status: 403 });
    }

    const message = await Message.create({
      sender: currentUser._id,
      receiver: receiverId,
      text,  // encrypted text
      iv,    // needed by receiver to decrypt
      read: false
    });

    return NextResponse.json({ message }, { status: 201 });

  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}