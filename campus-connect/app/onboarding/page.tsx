"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Onboarding() {
  const { data: session } = useSession();
  const router = useRouter();

  const [photo, setPhoto] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");
  const [year, setYear] = useState("");
  const [branch, setBranch] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [techStack, setTechStack] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [twitter, setTwitter] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto fill name from Google
  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
    // If already onboarded, go to dashboard
    if (session?.user && (session.user as any).onboardingComplete) {
      router.push("/dashboard");
    }
  }, [session]);

  const toggleItem = (item: string, list: string[], setList: Function) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role: role.toLowerCase(),
          year,
          branch,
          specialization,
          techStack,
          interests,
          linkedin,
          github,
          twitter,
          company,
          image: photo || session?.user?.image,
        }),
      });

      if (res.ok) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error saving onboarding data:", error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">

        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Step 1 - Basic Info */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-2xl font-bold text-gray-800">Basic Info</h2>
            <p className="text-gray-500 text-sm -mt-3">Tell us who you are</p>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold overflow-hidden">
                {photo ? (
                  <img src={photo} className="w-full h-full object-cover" />
                ) : session?.user?.image ? (
                  <img src={session.user.image} className="w-full h-full object-cover" />
                ) : (
                  name.charAt(0).toUpperCase() || "?"
                )}
              </div>
              <label className="text-sm text-blue-600 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 cursor-pointer">
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setPhoto(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">I am a</label>
              <div className="flex gap-3">
                {["Student", "Alumni", "Teacher"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      role === r
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-200 text-gray-600 hover:border-blue-300"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Year</label>
              <div className="flex gap-3">
                {["1st", "2nd", "3rd", "4th"].map((y) => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      year === y
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-200 text-gray-600 hover:border-blue-300"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-all mt-2"
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 2 - Academic Info */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-2xl font-bold text-gray-800">Academic Info</h2>
            <p className="text-gray-500 text-sm -mt-3">Your branch and skills</p>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Branch</label>
              <div className="flex flex-wrap gap-2">
                {["CSE", "ECE", "ME", "CE", "EE", "IT"].map((b) => (
                  <button
                    key={b}
                    onClick={() => { setBranch(b); setSpecialization(""); }}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                      branch === b
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-200 text-gray-600 hover:border-blue-300"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {branch === "CSE" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Specialization</label>
                <div className="flex flex-wrap gap-2">
                  {["AI/ML", "Big Data", "Cloud Computing", "Cybersecurity", "IoT", "General"].map((spec) => (
                    <button
                      key={spec}
                      onClick={() => setSpecialization(spec)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        specialization === spec
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-gray-200 text-gray-600 hover:border-indigo-300"
                      }`}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Tech Stack</label>
              <div className="flex flex-wrap gap-2">
                {["React", "Next.js", "Python", "Java", "C++", "Node.js", "MongoDB", "SQL"].map((tech) => (
                  <button
                    key={tech}
                    onClick={() => toggleItem(tech, techStack, setTechStack)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                      techStack.includes(tech)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-200 text-gray-600 hover:border-blue-300"
                    }`}
                  >
                    {tech}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Interests</label>
              <div className="flex flex-wrap gap-2">
                {["Web Dev", "AI/ML", "DSA", "Cybersecurity", "Cloud", "App Dev", "UI/UX"].map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleItem(interest, interests, setInterests)}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                      interests.includes(interest)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-200 text-gray-600 hover:border-blue-300"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-all mt-2"
            >
              Next →
            </button>
            <button onClick={() => setStep(1)} className="text-sm text-gray-400 text-center">
              ← Back
            </button>
          </div>
        )}

        {/* Step 3 - Social Info */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-2xl font-bold text-gray-800">Social Info</h2>
            <p className="text-gray-500 text-sm -mt-3">Help others find you</p>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">LinkedIn URL</label>
              <input
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="Your LinkedIn link"
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm  text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">GitHub URL</label>
              <input
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="Your GitHub link"
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm  text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Twitter URL</label>
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="Your Twitter link"
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {role === "Alumni" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Current Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Where do you work?"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-all mt-2 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Finish 🎉"}
            </button>
            <button onClick={() => setStep(2)} className="text-sm text-gray-400 text-center">
              ← Back
            </button>
          </div>
        )}

      </div>
    </div>
  );
}