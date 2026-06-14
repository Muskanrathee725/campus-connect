import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Connection from "@/models/Connection";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/users — returns all users except the logged-in user,
// each annotated with their connection status relative to the caller
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

    // All users except self, only return safe public fields
    const users = await User.find(
      { _id: { $ne: me._id } },
      { name: 1, image: 1, role: 1, year: 1, branch: 1, specialization: 1, techStack: 1, interests: 1, isVerified: 1 }
    ).lean();

    // Fetch all connections involving me (as requester or recipient)
    const connections = await Connection.find({
      $or: [{ requester: me._id }, { recipient: me._id }],
    }).lean();

    // Build a map: otherUserId → { status, iSentIt }
    const connectionMap: Record<string, { status: string; iSentIt: boolean }> = {};
    for (const c of connections) {
      const iSentIt = c.requester.toString() === me._id.toString();
      const otherId = iSentIt ? c.recipient.toString() : c.requester.toString();
      connectionMap[otherId] = { status: c.status, iSentIt };
    }

    // Annotate each user with their connection state
    const annotated = users.map((u: any) => {
      const conn = connectionMap[u._id.toString()];
      return {
        ...u,
        connectionStatus: conn?.status ?? "none",       // none | pending | accepted | rejected
        iSentRequest: conn?.iSentIt ?? false,
      };
    });

    return NextResponse.json({ users: annotated });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
