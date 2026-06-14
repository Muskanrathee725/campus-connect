import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // TODO: re-enable domain check once testing is complete
      // if (!user.email?.endsWith("@cuchd.in")) {
      //   return "//?error=OnlyCUCHDEmailsAllowed";
      // }
      try {
        await connectDB();
        const existingUser = await User.findOne({ email: user.email });
        if (!existingUser) {
          await User.create({
            name: user.name || "",
            email: user.email || "",
            image: user.image || "",
          });
        }
        return true;
      } catch (error) {
        console.error("Error saving user:", error);
        return false;
      }
    },
    async session({ session }) {
      try {
        await connectDB();
        const dbUser = await User.findOne({ email: session.user?.email });
        if (dbUser) {
          (session.user as any).id = dbUser._id.toString();
          (session.user as any).isVerified = dbUser.isVerified;
          (session.user as any).onboardingComplete = dbUser.onboardingComplete;
        }
        return session;
      } catch (error) {
        return session;
      }
    },
  },
  pages: {
    signIn: "/",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };