import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET /api/admin/users — full roster for the admin dashboard.
// Restricted to ADMIN_EMAIL; never exposes passwords (none are stored — auth is Google OAuth only).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    if (
      !process.env.ADMIN_EMAIL ||
      session.user.email !== process.env.ADMIN_EMAIL
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();

    const users = await User.find(
      {},
      {
        name: 1,
        email: 1,
        uid: 1,
        role: 1,
        branch: 1,
        year: 1,
        isVerified: 1,
        onboardingComplete: 1,
        createdAt: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
