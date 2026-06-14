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

    const body = await req.json();

    // Whitelist only safe onboarding fields — never spread full body into DB
    const { name, role, year, branch, specialization, techStack, interests, linkedin, github, twitter, company, image } = body;

    await connectDB();

    await User.findOneAndUpdate(
      { email: session.user.email },
      {
        name,
        role,
        year,
        branch,
        specialization,
        techStack,
        interests,
        linkedin,
        github,
        twitter,
        company,
        image,
        onboardingComplete: true,
      },
      { new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}