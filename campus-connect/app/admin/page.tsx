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
      <div className="min-h-screen bg-campus-mesh flex items-center justify-center text-muted text-sm">
        Loading...
      </div>
    );
  }

  if (status !== "authenticated" || !isAdmin) {
    return (
      <div className="min-h-screen bg-campus-mesh flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-display font-semibold text-ink">Access denied</p>
          <p className="text-sm text-muted mt-1">This page is restricted to admins.</p>
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
    <div className="min-h-screen bg-campus-mesh">
      <div className="bg-white border-b border-hairline px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-coral flex items-center justify-center font-display font-bold text-white text-sm">CC</div>
          <h1 className="text-lg font-display font-semibold text-ink">Campus Connect — Admin</h1>
        </div>
        <a href="/dashboard" className="text-sm text-muted hover:text-ink">
          ← Back to dashboard
        </a>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-semibold text-ink">Enrolled Users</h2>
            <p className="text-muted text-sm mt-1">
              {users.length} total &bull; {verifiedCount} verified &bull; {users.length - verifiedCount} pending
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-peach-bg border border-coral/20 text-coral-dark text-sm rounded-2xl p-4 mb-6">
            {error}
          </div>
        )}

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or CU UID..."
          className="w-full bg-white border border-hairline rounded-2xl px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral mb-6"
        />

        <div className="bg-white rounded-[22px] border border-hairline shadow-[0_4px_18px_rgba(43,33,64,0.06)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-muted">
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
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u._id} className="border-b border-hairline last:border-0 hover:bg-cream">
                    <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{u.uid || "—"}</td>
                    <td className="px-4 py-3 text-muted capitalize whitespace-nowrap">{u.role || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.isVerified ? (
                        <span className="text-xs bg-mint-bg text-mint-text px-2 py-1 rounded-full font-semibold">
                          ✅ Verified
                        </span>
                      ) : (
                        <span className="text-xs bg-gold-bg text-gold-text px-2 py-1 rounded-full font-semibold">
                          ⚠️ Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {u.onboardingComplete ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
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
