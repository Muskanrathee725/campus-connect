import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { uid, otp } = await req.json();

    await connectDB();

    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("DB OTP:", user.otp, "Entered OTP:", otp);

    if (String(user.otp) !== String(otp)) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    if (new Date() > user.otpExpiry) {
      return NextResponse.json({ error: "OTP expired, please request a new one" }, { status: 400 });
    }

    await User.findOneAndUpdate(
      { email: session.user.email },
      {
        isVerified: true,
        uid: uid,
        otp: null,
        otpExpiry: null,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Confirm OTP error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}