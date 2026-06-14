import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Connection from "@/models/Connection";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { receiverId } = await req.json();

    const currentUser = await User.findOne({ email: session.user.email }).lean() as any;
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (currentUser._id.toString() === receiverId) {
      return NextResponse.json({ error: "Cannot connect with yourself" }, { status: 400 });
    }

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

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { connectionId, action } = await req.json();

    const currentUser = await User.findOne({ email: session.user.email }).lean() as any;
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const connection = await Connection.findOne({
      _id: connectionId,
      receiver: currentUser._id
    });

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    connection.status = action;
    await connection.save();

    return NextResponse.json({ connection });

  } catch (error) {
    console.error("Error updating connection:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { connectionId } = await req.json();

    const currentUser = await User.findOne({ email: session.user.email }).lean() as any;
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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