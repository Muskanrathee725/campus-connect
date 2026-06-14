import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Connection from "@/models/Connection";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// POST /api/connections/respond  body: { requesterId, action: "accept" | "reject" }
// requesterId = the _id of the user who SENT the request
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { requesterId, action } = await req.json();
    if (!requesterId || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "requesterId and action (accept|reject) required" }, { status: 400 });
    }

    await connectDB();

    const me = await User.findOne({ email: session.user.email });
    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the pending request sent TO me BY requesterId
    const connection = await Connection.findOne({
      requester: requesterId,
      recipient: me._id,
      status: "pending",
    });

    if (!connection) {
      return NextResponse.json({ error: "Request not found or already handled" }, { status: 404 });
    }

    connection.status = action === "accept" ? "accepted" : "rejected";
    await connection.save();

    return NextResponse.json({ success: true, status: connection.status });
  } catch (error) {
    console.error("POST /api/connections/respond error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
