import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Connection from "@/models/Connection";

export async function GET() {
  try {
    // Get current logged in user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Get current user from DB
    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get ALL users except yourself
    const users = await User.find({ 
      _id: { $ne: currentUser._id },
      onboardingComplete: true  // only show users who finished onboarding
    }).select("name email image role year branch specialization techStack interests");
    // Why .select()? — we only send fields needed for the card
    // never send sensitive fields like otp, otpExpiry to frontend

    // Get ALL connections involving current user
    const connections = await Connection.find({
      $or: [
        { sender: currentUser._id },
        { receiver: currentUser._id }
      ]
    });
    // Why fetch all at once? — faster than checking each user one by one

    // Map connection status onto each user
    const usersWithStatus = users.map((user) => {
      const connection = connections.find(
        (c) =>
          (c.sender.toString() === currentUser._id.toString() && 
           c.receiver.toString() === user._id.toString()) ||
          (c.receiver.toString() === currentUser._id.toString() && 
           c.sender.toString() === user._id.toString())
      );

      let connectionStatus = "none";      // no request sent
      let connectionId = null;

      if (connection) {
        connectionId = connection._id;
        if (connection.status === "accepted") {
          connectionStatus = "connected";
        } else if (connection.status === "pending") {
          // Did I send it or did they?
          if (connection.sender.toString() === currentUser._id.toString()) {
            connectionStatus = "pending_sent";     // I sent, waiting
          } else {
            connectionStatus = "pending_received"; // they sent, I need to respond
          }
        }
      }

      return {
        ...user.toObject(),
        connectionStatus,
        connectionId,
      };
    });

    return NextResponse.json({ 
      users: usersWithStatus,
      currentUserId: currentUser._id 
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}