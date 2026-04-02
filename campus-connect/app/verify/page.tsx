"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Verify() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = async () => {
    if (!uid) {
      setError("Please enter your UID");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/verify/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep(2);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (err) {
      setError("Something went wrong");
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      setError("Please enter the OTP");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/verify/confirm-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, otp }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.error || "Invalid OTP");
      }
    } catch (err) {
      setError("Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md flex flex-col gap-6">

        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 1 ? "Verify Your Account" : "Enter OTP"}
          </h2>
          <p className="text-gray-600 text-sm">
            {step === 1
              ? "Enter your CUHD UID to verify you are a real student"
              : `OTP sent to ${uid}@cuchd.in — check your college email`}
          </p>
        </div>

        {step === 1 && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Your UID</label>
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value.toUpperCase())}
                placeholder="e.g. 21BCE2367"
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                OTP will be sent to {uid || "UID"}@cuchd.in
              </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleSendOTP}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? "Sending OTP..." : "Send OTP →"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6 digit OTP"
                maxLength={6}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-lg"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleVerifyOTP}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify ✓"}
            </button>

            <button
              onClick={() => { setStep(1); setError(""); }}
              className="text-sm text-gray-400 text-center"
            >
              ← Change UID
            </button>
          </>
        )}

      </div>
    </div>
  );
}