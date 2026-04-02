"use client";
import { useSession } from "next-auth/react";

const dummyUsers = [
  { name: "Rahul Sharma", branch: "CSE", year: "3rd", role: "Student", techStack: ["React", "Node.js"], interests: ["Web Dev", "DSA"], initials: "RS" },
  { name: "Priya Singh", branch: "ECE", year: "2nd", role: "Student", techStack: ["Python", "ML"], interests: ["AI/ML", "Cloud"], initials: "PS" },
  { name: "Amit Kumar", branch: "CSE", year: "4th", role: "Alumni", techStack: ["Java", "SQL"], interests: ["DSA", "System Design"], initials: "AK" },
  { name: "Neha Verma", branch: "ME", year: "3rd", role: "Student", techStack: ["C++", "Python"], interests: ["IoT", "Robotics"], initials: "NV" },
  { name: "Rohan Gupta", branch: "CSE", year: "2nd", role: "Student", techStack: ["Next.js", "MongoDB"], interests: ["Web Dev", "UI/UX"], initials: "RG" },
  { name: "Simran Kaur", branch: "CSE", year: "4th", role: "Alumni", techStack: ["React", "AWS"], interests: ["Cloud", "DevOps"], initials: "SK" },
];

export default function Dashboard() {
  const { data: session } = useSession();
  const isVerified = (session?.user as any)?.isVerified;
  const userName = session?.user?.name || "User";
  const userImage = session?.user?.image;
  const initials = userName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-600">Campus Connect</h1>
        <div className="flex items-center gap-3">
          {isVerified ? (
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              ✅ Verified
            </span>
          ) : (
            <a href="/verify" className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium hover:bg-yellow-200 cursor-pointer">
              ⚠️ Click to Verify
            </a>
          )}
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
            {userImage ? (
              <img src={userImage} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Welcome, {userName.split(" ")[0]}! 👋</h2>
          <p className="text-gray-600 text-sm mt-1">Connect with CUHD students, alumni and teachers</p>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search students by name, branch, skills..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {["All", "CSE", "ECE", "ME", "Student", "Alumni", "AI/ML", "Web Dev"].map((filter) => (
            <button key={filter} className="px-4 py-1.5 rounded-full border border-gray-200 text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 transition-all">
              {filter}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dummyUsers.map((user, index) => (
            <div key={index} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                  {user.initials}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{user.name}</h3>
                  <p className="text-xs text-gray-600">{user.branch} • {user.year} Year • {user.role}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {user.techStack.map((tech) => (
                  <span key={tech} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {tech}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {user.interests.map((interest) => (
                  <span key={interest} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                    {interest}
                  </span>
                ))}
              </div>

              <button className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all">
                Connect
              </button>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}