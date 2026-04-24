import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Connection from "@/models/Connection";

// SEND a connection request
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { receiverId } = await req.json();
    // Why only receiverId? — sender is always the logged in user
    // never trust the frontend to send senderId

    const currentUser = await User.findOne({ email: session.user.email });

    // Prevent sending request to yourself
    if (currentUser._id.toString() === receiverId) {
      return NextResponse.json({ error: "Cannot connect with yourself" }, { status: 400 });
    }

    // Check if connection already exists
    const existing = await Connection.findOne({
      $or: [
        { sender: currentUser._id, receiver: receiverId },
        { sender: receiverId, receiver: currentUser._id }
      ]
    });

    if (existing) {
      return NextResponse.json({ error: "Connection already exists" }, { status: 400 });
    }

    const connection = await Connection.create({
      sender: currentUser._id,
      receiver: receiverId,
      status: "pending"
    });

    return NextResponse.json({ connection }, { status: 201 });

  } catch (error) {
    console.error("Error sending connection request:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ACCEPT or REJECT a connection request
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { connectionId, action } = await req.json();
    // action = "accepted" or "rejected"

    const currentUser = await User.findOne({ email: session.user.email });

    // Find connection and make sure current user is the RECEIVER
    // Why? — only receiver can accept/reject, not sender
    const connection = await Connection.findOne({
      _id: connectionId,
      receiver: currentUser._id // security check
    });

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    connection.status = action; // "accepted" or "rejected"
    await connection.save();

    return NextResponse.json({ connection });

  } catch (error) {
    console.error("Error updating connection:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// REMOVE/CANCEL a connection
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { connectionId } = await req.json();

    const currentUser = await User.findOne({ email: session.user.email });

    // Only sender or receiver can delete
    const connection = await Connection.findOne({
      _id: connectionId,
      $or: [
        { sender: currentUser._id },
        { receiver: currentUser._id }
      ]
    });

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    await connection.deleteOne();

    return NextResponse.json({ message: "Connection removed" });

  } catch (error) {
    console.error("Error removing connection:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}