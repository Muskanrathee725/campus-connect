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
    const uidRegex = /^\d{2}[A-Z]{1,6}\d{4,7}$/;
    if (!uidRegex.test(uid.trim().toUpperCase())) {
      setError("Invalid UID. Format: 23BAI70172 or 21BCE2367 (year + program + roll number)");
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
    <div className="min-h-screen bg-campus-mesh flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] shadow-[0_8px_30px_rgba(43,33,64,0.08)] p-8 w-full max-w-md flex flex-col gap-6">

        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-display font-semibold text-ink">
            {step === 1 ? "Verify Your Account" : "Enter OTP"}
          </h2>
          <p className="text-muted text-sm">
            {step === 1
              ? "Enter your CUHD UID to verify you are a real student"
              : `OTP sent to ${uid}@cuchd.in — check your college email`}
          </p>
        </div>

        {step === 1 && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">Your UID</label>
              <input
                type="text"
                value={uid}
                onChange={(e) => setUid(e.target.value.toUpperCase())}
                placeholder="e.g. 21BCE2367"
                className="border border-hairline rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral"
              />
              <p className="text-xs text-muted">
                OTP will be sent to {uid || "UID"}@cuchd.in
              </p>
              <p className="text-xs text-coral">
                Format: 23BAI70172 &nbsp;|&nbsp; 21BCE2367 &nbsp;|&nbsp; 22CSE10001
              </p>
            </div>

            {error && <p className="text-coral-dark text-sm">{error}</p>}

            <button
              onClick={handleSendOTP}
              disabled={loading}
              className="w-full bg-coral text-white py-3 rounded-2xl font-semibold hover:bg-coral-dark transition-all disabled:opacity-50"
            >
              {loading ? "Sending OTP..." : "Send OTP →"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6 digit OTP"
                maxLength={6}
                className="border border-hairline rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral tracking-widest text-center text-lg"
              />
            </div>

            {error && <p className="text-coral-dark text-sm">{error}</p>}

            <button
              onClick={handleVerifyOTP}
              disabled={loading}
              className="w-full bg-coral text-white py-3 rounded-2xl font-semibold hover:bg-coral-dark transition-all disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify ✓"}
            </button>

            <button
              onClick={() => { setStep(1); setError(""); }}
              className="text-sm text-muted text-center"
            >
              ← Change UID
            </button>
          </>
        )}

      </div>
    </div>
  );
}
