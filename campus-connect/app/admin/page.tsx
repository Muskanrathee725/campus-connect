"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  uid?: string;
  role?: string;
  branch?: string;
  year?: string;
  isVerified?: boolean;
  onboardingComplete?: boolean;
  createdAt: string;
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.isAdmin;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) {
      setLoading(false);
      return;
    }
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
        else setError(data.error || "Failed to load users");
      })
      .catch(() => setError("Network error — please try again"))
      .finally(() => setLoading(false));
  }, [status, isAdmin]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
        Loading...
      </div>
    );
  }

  if (status !== "authenticated" || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">Access denied</p>
          <p className="text-sm text-gray-500 mt-1">This page is restricted to admins.</p>
        </div>
      </div>
    );
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.uid?.toLowerCase().includes(q)
    );
  });

  const verifiedCount = users.filter((u) => u.isVerified).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-600">Campus Connect — Admin</h1>
        <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to dashboard
        </a>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Enrolled Users</h2>
            <p className="text-gray-600 text-sm mt-1">
              {users.length} total &bull; {verifiedCount} verified &bull; {users.length - verifiedCount} pending
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-6">
            {error}
          </div>
        )}

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or CU UID..."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
        />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">CU UID</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Verified</th>
                <th className="px-4 py-3 font-medium">Onboarded</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.uid || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize whitespace-nowrap">{u.role || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.isVerified ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                          ✅ Verified
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                          ⚠️ Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {u.onboardingComplete ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
