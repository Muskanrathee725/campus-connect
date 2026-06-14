import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Connection from "@/models/Connection";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/connections/list?type=pending|accepted
// pending → requests I received and haven't acted on
// accepted → my confirmed connections
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "accepted";

    await connectDB();

    const me = await User.findOne({ email: session.user.email });
    if (!me) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let query: any = {};

    if (type === "pending") {
      // Requests sent TO me that are still pending
      query = { recipient: me._id, status: "pending" };
    } else {
      // Accepted connections — I could be requester or recipient
      query = {
        $or: [{ requester: me._id }, { recipient: me._id }],
        status: "accepted",
      };
    }

    const connections = await Connection.find(query)
      .populate("requester", "name image branch year role")
      .populate("recipient", "name image branch year role")
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ connections });
  } catch (error) {
    console.error("GET /api/connections/list error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
