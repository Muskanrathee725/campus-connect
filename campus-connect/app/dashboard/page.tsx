"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type ConnectionStatus = "none" | "pending_sent" | "pending_received" | "connected";

type User = {
  _id: string;
  name: string;
  email: string;
  image?: string;
  role: string;
  year?: string;
  branch?: string;
  specialization?: string;
  techStack: string[];
  interests: string[];
  connectionStatus: ConnectionStatus;
  connectionId?: string;
};

export default function Dashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isVerified = (session?.user as any)?.isVerified;
  const userName = session?.user?.name || "User";
  const userImage = session?.user?.image;

  // Fetch all users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users when search or filter changes
  useEffect(() => {
    let result = [...users];

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(s) ||
          u.branch?.toLowerCase().includes(s) ||
          u.role.toLowerCase().includes(s) ||
          u.techStack.some((t) => t.toLowerCase().includes(s)) ||
          u.interests.some((i) => i.toLowerCase().includes(s))
      );
    }

    // Tab filter
    if (activeFilter !== "All") {
      result = result.filter(
        (u) =>
          u.branch === activeFilter ||
          u.role.toLowerCase() === activeFilter.toLowerCase() ||
          u.techStack.includes(activeFilter) ||
          u.interests.includes(activeFilter)
      );
    }

    setFilteredUsers(result);
  }, [search, activeFilter, users]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Send connection request
  const handleConnect = async (receiverId: string) => {
    setActionLoading(receiverId);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId }),
      });
      const data = await res.json();
      if (res.ok) {
        // Update UI instantly without refetching
        setUsers((prev) =>
          prev.map((u) =>
            u._id === receiverId
              ? { ...u, connectionStatus: "pending_sent", connectionId: data.connection._id }
              : u
          )
        );
      }
    } catch (error) {
      console.error("Error connecting:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Accept or reject connection request
  const handleResponse = async (connectionId: string, action: "accepted" | "rejected", userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, action }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u._id === userId
              ? { ...u, connectionStatus: action === "accepted" ? "connected" : "none", connectionId: undefined }
              : u
          )
        );
      }
    } catch (error) {
      console.error("Error responding to connection:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel connection request or remove connection
  const handleDisconnect = async (connectionId: string, userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u._id === userId
              ? { ...u, connectionStatus: "none", connectionId: undefined }
              : u
          )
        );
      }
    } catch (error) {
      console.error("Error disconnecting:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // Render the correct button based on connection status
  const renderConnectionButton = (user: User) => {
    const isLoading = actionLoading === user._id;

    if (user.connectionStatus === "none") {
      return (
        <button
          onClick={() => handleConnect(user._id)}
          disabled={isLoading}
          className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          {isLoading ? "..." : "+ Connect"}
        </button>
      );
    }

    if (user.connectionStatus === "pending_sent") {
      return (
        <button
          onClick={() => handleDisconnect(user.connectionId!, user._id)}
          disabled={isLoading}
          className="w-full py-2 rounded-xl bg-yellow-100 text-yellow-700 text-sm font-medium hover:bg-yellow-200 transition-all disabled:opacity-50"
        >
          {isLoading ? "..." : "⏳ Pending"}
        </button>
      );
    }

    if (user.connectionStatus === "pending_received") {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleResponse(user.connectionId!, "accepted", user._id)}
            disabled={isLoading}
            className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-all disabled:opacity-50"
          >
            {isLoading ? "..." : "✓ Accept"}
          </button>
          <button
            onClick={() => handleResponse(user.connectionId!, "rejected", user._id)}
            disabled={isLoading}
            className="flex-1 py-2 rounded-xl bg-red-100 text-red-600 text-sm font-medium hover:bg-red-200 transition-all disabled:opacity-50"
          >
            {isLoading ? "..." : "✕ Reject"}
          </button>
        </div>
      );
    }

    if (user.connectionStatus === "connected") {
      return (
        <button
          onClick={() => router.push(`/chat/${user._id}`)}
          className="w-full py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-all"
        >
          💬 Message
        </button>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
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
              getInitials(userName)
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Welcome */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome, {userName.split(" ")[0]}! 👋
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Connect with CUHD students, alumni and teachers
          </p>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, branch, skills..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {["All", "CSE", "ECE", "ME", "Student", "Alumni", "Teacher", "AI/ML", "Web Dev"].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 rounded-full border text-sm transition-all ${
                activeFilter === filter
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Users Grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No users found</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <div key={user._id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm overflow-hidden">
                    {user.image ? (
                      <img src={user.image} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{user.name}</h3>
                    <p className="text-xs text-gray-500">
                      {user.branch} {user.year ? `• ${user.year} Year` : ""} • {user.role}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {user.techStack.map((tech) => (
                    <span key={tech} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {user.interests.map((interest) => (
                    <span key={interest} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {interest}
                    </span>
                  ))}
                </div>

                {renderConnectionButton(user)}

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}