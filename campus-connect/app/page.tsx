"use client";
import { signIn } from "next-auth/react";


export default function Home() {
  return (
    <div className="min-h-screen bg-campus-mesh flex items-center justify-center px-4">
      <div className="bg-white rounded-[28px] shadow-[0_8px_30px_rgba(43,33,64,0.08)] p-10 w-full max-w-md flex flex-col items-center gap-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-coral rounded-2xl flex items-center justify-center">
            <span className="text-white text-2xl font-display font-bold">CC</span>
          </div>
          <h1 className="text-2xl font-display font-semibold text-ink">Campus Connect</h1>
          <p className="text-muted text-sm text-center">
            Only for Chandigarh University students
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-hairline" />

        {/* Google Button */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
          className="w-full flex items-center justify-center gap-3 border border-hairline rounded-2xl py-3 px-4 hover:bg-cream transition-all cursor-pointer"
        >
          <img
            src="https://www.google.com/favicon.ico"
            alt="Google"
            className="w-5 h-5"
          />
          <span className="text-ink font-medium">
            Continue with Google
          </span>
        </button>

        {/* Footer */}
        <p className="text-xs text-muted text-center">
          Sign in, then verify your CU UID to unlock full access
        </p>

      </div>
    </div>
  );
}