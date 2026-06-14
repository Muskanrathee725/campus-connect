"use client";
import { signIn } from "next-auth/react";


export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md flex flex-col items-center gap-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">CC</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Campus Connect</h1>
          <p className="text-gray-500 text-sm text-center">
            Only for Chandigarh University students
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gray-100" />

        {/* Google Button */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 hover:bg-gray-50 transition-all cursor-pointer"
        >
          <img
            src="https://www.google.com/favicon.ico"
            alt="Google"
            className="w-5 h-5"
          />
          <span className="text-gray-700 font-medium">
            Continue with Google
          </span>
        </button>

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center">
          Only @cuchd.in accounts are allowed
        </p>

      </div>
    </div>
  );
}