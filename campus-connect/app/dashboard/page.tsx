"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type User = {
  _id: string;
  name: string;
  image?: string;
  branch?: string;
  year?: string;
  role?: string;
  techStack?: string[];
  interests?: string[];
  isVerified?: boolean;
  connectionStatus: "none" | "pending" | "accepted" | "rejected";
  iSentRequest: boolean;
};

type PendingRequest = {
  _id: string;
  requester: { _id: string; name: string; image?: string; branch?: string; year?: string; role?: string };
};

export default function Dashboard() {
  const { data: session } = useSession();
  const isVerified = (session?.user as any)?.isVerified;
  const userName = session?.user?.name || "User";
  const userImage = session?.user?.image;
  const initials = userName.charAt(0).toUpperCase();

  const [users, setUsers] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showRequests, setShowRequests] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Fetch all users + annotated connection states
  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Fetch pending requests sent to me
  async function fetchPendingRequests() {
    try {
      const res = await fetch("/api/connections/list?type=pending");
      const data = await res.json();
      if (data.connections) setPendingRequests(data.connections);
    } catch (e) {
      console.error(e);
    }
  }

  // Fetch unread message counts per sender
  async function fetchUnreadCounts() {
    try {
      const res = await fetch("/api/messages/unread");
      const data = await res.json();
      if (data.counts) setUnreadCounts(data.counts);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchUsers();
    fetchPendingRequests();
    fetchUnreadCounts();
    // Poll every 10 seconds — refreshes connection states, pending requests, unread counts
    const interval = setInterval(() => {
      fetchUsers();
      fetchPendingRequests();
      fetchUnreadCounts();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleConnect(recipientId: string) {
    // Optimistic update — show Pending immediately
    setUsers((prev) =>
      prev.map((u) =>
        u._id === recipientId
          ? { ...u, connectionStatus: "pending", iSentRequest: true }
          : u
      )
    );
    try {
      const res = await fetch("/api/connections/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      if (res.ok) {
        showToast("Connection request sent!", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to send request", "error");
        fetchUsers(); // revert optimistic update
      }
    } catch {
      showToast("Network error — please try again", "error");
      fetchUsers();
    }
  }

  async function handleRespond(requesterId: string, action: "accept" | "reject") {
    try {
      await fetch("/api/connections/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId, action }),
      });
      // Refresh both lists
      fetchUsers();
      fetchPendingRequests();
    } catch (e) {
      console.error(e);
    }
  }

  // Filter + search logic
  const filterMap: Record<string, (u: User) => boolean> = {
    All: () => true,
    CSE: (u) => u.branch === "CSE",
    ECE: (u) => u.branch === "ECE",
    ME: (u) => u.branch === "ME",
    Student: (u) => u.role === "student",
    Alumni: (u) => u.role === "alumni",
    "AI/ML": (u) => !!(u.interests?.includes("AI/ML") || u.techStack?.includes("Python")),
    "Web Dev": (u) => !!(u.interests?.includes("Web Dev")),
  };

  const filteredUsers = users.filter((u) => {
    const matchesFilter = filterMap[activeFilter]?.(u) ?? true;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.branch?.toLowerCase().includes(q) ||
      u.techStack?.some((t) => t.toLowerCase().includes(q)) ||
      u.interests?.some((i) => i.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  function ConnectButton({ user }: { user: User }) {
    if (user.connectionStatus === "accepted") {
      const unread = unreadCounts[user._id] || 0;
      return (
        <div className="flex gap-2">
          <button
            disabled
            className="flex-1 py-2 rounded-xl bg-green-100 text-green-700 text-sm font-medium"
          >
            ✓ Connected
          </button>
          <a
            href={`/messages/${user._id}`}
            className="relative flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all text-center"
          >
            💬 Message
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </a>
        </div>
      );
    }
    if (user.connectionStatus === "pending" && user.iSentRequest) {
      return (
        <button
          disabled
          className="w-full py-2 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium"
        >
          Pending...
        </button>
      );
    }
    if (user.connectionStatus === "pending" && !user.iSentRequest) {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleRespond(user._id, "accept")}
            className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Accept
          </button>
          <button
            onClick={() => handleRespond(user._id, "reject")}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            Ignore
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => handleConnect(user._id)}
        className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all"
      >
        + Connect
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === "success" ? "bg-green-500" : "bg-red-500"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Navbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-600">Campus Connect</h1>
        <div className="flex items-center gap-3">
          {/* Pending requests bell */}
          {pendingRequests.length > 0 && (
            <button
              onClick={() => setShowRequests(!showRequests)}
              className="relative text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full font-medium hover:bg-blue-100"
            >
              🔔 {pendingRequests.length} Request{pendingRequests.length > 1 ? "s" : ""}
            </button>
          )}
          {isVerified ? (
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              ✅ Verified
            </span>
          ) : (
            <a
              href="/verify"
              className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-medium hover:bg-yellow-200"
            >
              ⚠️ Click to Verify
            </a>
          )}
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
            {userImage ? (
              <img src={userImage} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
        </div>
      </div>

      {/* Pending requests dropdown */}
      {showRequests && pendingRequests.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 mb-4">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">
              Connection Requests ({pendingRequests.length})
            </h3>
            <div className="flex flex-col gap-3">
              {pendingRequests.map((req) => (
                <div key={req._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm overflow-hidden">
                      {req.requester.image ? (
                        <img src={req.requester.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        req.requester.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{req.requester.name}</p>
                      <p className="text-xs text-gray-500">
                        {req.requester.branch} • {req.requester.year} Year
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond(req.requester._id, "accept")}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespond(req.requester._id, "reject")}
                      className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Welcome, {userName.split(" ")[0]}! 👋
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Connect with CUHD students, alumni and teachers
            </p>
          </div>
          <button
            onClick={() => { fetchUsers(); fetchPendingRequests(); }}
            className="text-xs text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 mt-1"
          >
            ↻ Refresh
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, branch, skills..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {["All", "CSE", "ECE", "ME", "Student", "Alumni", "AI/ML", "Web Dev"].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 rounded-full border text-sm transition-all ${
                activeFilter === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-28 bg-gray-200 rounded" />
                    <div className="h-2 w-20 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="h-8 bg-gray-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-12">No users found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <div
                key={user._id}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm overflow-hidden">
                    {user.image ? (
                      <img src={user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-gray-900 text-sm">{user.name}</h3>
                      {user.isVerified && (
                        <span className="text-xs text-green-600">✅</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      {[user.branch, user.year ? `${user.year} Year` : null, user.role]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                </div>

                {user.techStack && user.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {user.techStack.slice(0, 4).map((tech) => (
                      <span
                        key={tech}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                {user.interests && user.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {user.interests.slice(0, 3).map((interest) => (
                      <span
                        key={interest}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}

                <ConnectButton user={user} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
