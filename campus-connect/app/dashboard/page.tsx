"use client";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

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

type MediaItem = {
  type: "image" | "document";
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
};

type Post = {
  _id: string;
  content: string;
  media?: MediaItem[];
  createdAt: string;
  author: { _id: string; name: string; image?: string; role?: string; branch?: string; year?: string; isVerified?: boolean };
};

const MAX_FILES = 3;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const MAX_DOC_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const DOC_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx," + ALLOWED_DOC_TYPES.join(",");
type EmojiEntry = { emoji: string; label: string };

const EMOJI_CATEGORIES: { name: string; icon: string; items: EmojiEntry[] }[] = [
  {
    name: "Smileys",
    icon: "😀",
    items: [
      { emoji: "😀", label: "grinning face" },
      { emoji: "😁", label: "beaming face" },
      { emoji: "😂", label: "joy" },
      { emoji: "🤣", label: "rolling on floor laughing" },
      { emoji: "😊", label: "smiling face" },
      { emoji: "😍", label: "heart eyes" },
      { emoji: "😘", label: "blowing a kiss" },
      { emoji: "😎", label: "cool sunglasses" },
      { emoji: "🤩", label: "star struck" },
      { emoji: "🥳", label: "party face" },
      { emoji: "😅", label: "sweat smile" },
      { emoji: "🤔", label: "thinking" },
      { emoji: "😢", label: "crying" },
      { emoji: "😭", label: "sobbing" },
      { emoji: "😮", label: "surprised" },
      { emoji: "😴", label: "sleeping" },
      { emoji: "🙄", label: "eye roll" },
      { emoji: "😇", label: "angel" },
    ],
  },
  {
    name: "Gestures",
    icon: "👍",
    items: [
      { emoji: "👍", label: "thumbs up" },
      { emoji: "👎", label: "thumbs down" },
      { emoji: "👏", label: "clapping" },
      { emoji: "🙌", label: "raising hands" },
      { emoji: "🤝", label: "handshake" },
      { emoji: "💪", label: "flexed biceps" },
      { emoji: "🙏", label: "folded hands / thank you" },
      { emoji: "👀", label: "eyes / looking" },
      { emoji: "✌️", label: "victory" },
      { emoji: "🤞", label: "fingers crossed" },
      { emoji: "👋", label: "wave / hello" },
      { emoji: "🤟", label: "love you gesture" },
    ],
  },
  {
    name: "Nature",
    icon: "🔥",
    items: [
      { emoji: "🔥", label: "fire" },
      { emoji: "⭐", label: "star" },
      { emoji: "✨", label: "sparkles" },
      { emoji: "🌟", label: "glowing star" },
      { emoji: "🌈", label: "rainbow" },
      { emoji: "☀️", label: "sun" },
      { emoji: "🌙", label: "moon" },
      { emoji: "🌱", label: "seedling / growth" },
    ],
  },
  {
    name: "Objects",
    icon: "💡",
    items: [
      { emoji: "💡", label: "idea" },
      { emoji: "📌", label: "pin" },
      { emoji: "📚", label: "books / study" },
      { emoji: "🎯", label: "target / goal" },
      { emoji: "🏆", label: "trophy / achievement" },
      { emoji: "🎓", label: "graduation cap" },
      { emoji: "💻", label: "laptop / coding" },
      { emoji: "📈", label: "chart increasing / growth" },
      { emoji: "🔗", label: "link" },
      { emoji: "📝", label: "memo / notes" },
    ],
  },
  {
    name: "Symbols",
    icon: "❤️",
    items: [
      { emoji: "✅", label: "check mark / done" },
      { emoji: "❤️", label: "heart / love" },
      { emoji: "💯", label: "hundred" },
      { emoji: "❌", label: "cross mark" },
      { emoji: "⚡", label: "lightning / fast" },
      { emoji: "🎉", label: "party popper / celebration" },
      { emoji: "🚀", label: "rocket / launch" },
      { emoji: "📢", label: "megaphone / announcement" },
    ],
  },
];

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const TAG_COLORS = [
  { bg: "bg-mint-bg", text: "text-mint-text" },
  { bg: "bg-peach-bg", text: "text-peach-text" },
  { bg: "bg-gold-bg", text: "text-gold-text" },
  { bg: "bg-lavender-bg", text: "text-lavender-text" },
];

const AVATAR_COLORS = ["bg-coral", "bg-mint-text", "bg-lavender-text", "bg-gold-text"];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Kept as a top-level component (not nested inside Dashboard) with its own
// local state, so typing in the textarea only re-renders this composer —
// not the whole dashboard — and never unmounts/remounts on every keystroke.
function PostComposer({ onPost }: { onPost: (content: string, media: MediaItem[]) => Promise<boolean> }) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCategoryIndex, setEmojiCategoryIndex] = useState(0);
  const [emojiSearch, setEmojiSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const emojiWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEmoji) return;
    function handleClickOutside(e: MouseEvent) {
      if (emojiWrapperRef.current && !emojiWrapperRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setShowEmoji(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showEmoji]);

  async function handleFiles(files: FileList | null, type: "image" | "document") {
    if (!files || files.length === 0) return;
    setError("");
    const remaining = MAX_FILES - media.length;
    if (remaining <= 0) {
      setError(`You can attach up to ${MAX_FILES} files per post.`);
      return;
    }
    const selected = Array.from(files).slice(0, remaining);
    const next: MediaItem[] = [];
    for (const file of selected) {
      const maxBytes = type === "image" ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;
      if (type === "document" && !ALLOWED_DOC_TYPES.includes(file.type)) {
        setError("Supported documents: PDF, DOC, DOCX, PPT, PPTX.");
        continue;
      }
      if (type === "image" && !file.type.startsWith("image/")) {
        setError("Only image files are supported.");
        continue;
      }
      if (file.size > maxBytes) {
        setError(`${file.name} is too large (max ${(maxBytes / (1024 * 1024)).toFixed(1)}MB).`);
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      next.push({ type, url: dataUrl, name: file.name, mimeType: file.type, size: file.size });
    }
    setMedia((prev) => [...prev, ...next]);
  }

  function removeMedia(index: number) {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + emoji);
      return;
    }
    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + emoji.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed && media.length === 0) return;
    setPosting(true);
    setError("");
    const ok = await onPost(trimmed, media);
    setPosting(false);
    if (ok) {
      setContent("");
      setMedia([]);
      setShowEmoji(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-hairline shadow-sm mb-6">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share an update, project, or achievement..."
        rows={3}
        maxLength={2000}
        className="w-full resize-none border-0 focus:outline-none text-sm text-ink placeholder:text-muted"
      />

      {media.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {media.map((item, i) => (
            <div key={i} className="relative">
              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt={item.name || "attachment"}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-40 h-20 flex flex-col justify-center px-3 rounded-lg border border-hairline bg-cream">
                  <p className="text-xs font-medium text-ink truncate">📄 {item.name}</p>
                  <p className="text-[10px] text-muted">{formatBytes(item.size)}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeMedia(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white text-xs flex items-center justify-center hover:opacity-80"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-coral-dark mt-2">{error}</p>}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline">
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={media.length >= MAX_FILES}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-cream disabled:opacity-30"
            title="Add photo"
          >
            🖼️
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files, "image");
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={media.length >= MAX_FILES}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-cream disabled:opacity-30"
            title="Add document (PDF, DOC, PPT)"
          >
            📄
          </button>
          <input
            ref={docInputRef}
            type="file"
            accept={DOC_ACCEPT}
            hidden
            onChange={(e) => {
              handleFiles(e.target.files, "document");
              e.target.value = "";
            }}
          />
          <div ref={emojiWrapperRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowEmoji((v) => !v);
                setEmojiSearch("");
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-cream"
              title="Add emoji"
            >
              😊
            </button>

            {showEmoji && (
              <div className="absolute top-full left-0 mt-2 z-20 w-72 rounded-xl border border-hairline bg-white shadow-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-hairline">
                  <span className="text-xs font-semibold text-muted">Emoji</span>
                  <button
                    type="button"
                    onClick={() => setShowEmoji(false)}
                    className="text-muted hover:text-ink text-sm leading-none"
                  >
                    ✕
                  </button>
                </div>

                <div className="px-2 pt-2">
                  <input
                    type="text"
                    value={emojiSearch}
                    onChange={(e) => setEmojiSearch(e.target.value)}
                    placeholder="Search emoji..."
                    className="w-full text-xs border border-hairline rounded-lg px-2 py-1.5 text-ink focus:outline-none focus:ring-1 focus:ring-coral"
                  />
                </div>

                {!emojiSearch && (
                  <div className="flex gap-1 px-2 pt-2">
                    {EMOJI_CATEGORIES.map((cat, i) => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setEmojiCategoryIndex(i)}
                        title={cat.name}
                        className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all ${
                          emojiCategoryIndex === i ? "bg-peach-bg ring-1 ring-coral" : "hover:bg-cream"
                        }`}
                      >
                        {cat.icon}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-8 gap-1 p-2 max-h-40 overflow-y-auto">
                  {(() => {
                    const q = emojiSearch.trim().toLowerCase();
                    const visible = q
                      ? EMOJI_CATEGORIES.flatMap((cat) => cat.items).filter((item) =>
                          item.label.toLowerCase().includes(q)
                        )
                      : EMOJI_CATEGORIES[emojiCategoryIndex].items;

                    if (visible.length === 0) {
                      return (
                        <p className="col-span-8 text-center text-xs text-muted py-4">
                          No emoji found
                        </p>
                      );
                    }

                    return visible.map(({ emoji, label }) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        title={label}
                        className="rounded p-1 text-lg hover:bg-cream"
                      >
                        {emoji}
                      </button>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={posting || (!content.trim() && media.length === 0)}
          className="px-4 py-1.5 rounded-xl bg-coral text-white text-sm font-semibold hover:bg-coral-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {posting ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}

function PostsFeedList({ posts, loading }: { posts: Post[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-hairline animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return <p className="text-muted text-sm text-center py-12">No posts yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <div key={post._id} className="bg-white rounded-2xl p-5 border border-hairline shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-coral flex items-center justify-center text-white font-display font-semibold text-sm overflow-hidden">
              {post.author?.image ? (
                <img src={post.author.image} alt="" className="w-full h-full object-cover" />
              ) : (
                post.author?.name?.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-display font-semibold text-ink text-sm">{post.author?.name}</h3>
                {post.author?.isVerified && <span className="text-xs text-mint-text">✅</span>}
              </div>
              <p className="text-xs text-muted">
                {[post.author?.branch, post.author?.role].filter(Boolean).join(" • ")}
              </p>
            </div>
          </div>

          {post.content && (
            <p className="text-sm text-ink whitespace-pre-wrap mb-3">{post.content}</p>
          )}

          {post.media && post.media.length > 0 && (
            <div
              className={`grid gap-1 ${
                post.media.filter((m) => m.type === "image").length > 1 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {post.media.map((item, i) =>
                item.type === "image" ? (
                  <img
                    key={i}
                    src={item.url}
                    alt={item.name || "attachment"}
                    className="w-full max-h-96 object-cover rounded-xl border border-hairline"
                  />
                ) : (
                  <a
                    key={i}
                    href={item.url}
                    download={item.name}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-hairline bg-cream hover:bg-peach-bg"
                  >
                    <span className="text-2xl">📄</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                      <p className="text-xs text-muted">{formatBytes(item.size)}</p>
                    </div>
                  </a>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ConnectButton({
  user,
  unreadCounts,
  onConnect,
  onRespond,
}: {
  user: User;
  unreadCounts: Record<string, number>;
  onConnect: (recipientId: string) => void;
  onRespond: (requesterId: string, action: "accept" | "reject") => void;
}) {
  if (user.connectionStatus === "accepted") {
    const unread = unreadCounts[user._id] || 0;
    return (
      <div className="flex gap-2">
        <button
          disabled
          className="flex-1 py-2 rounded-2xl bg-mint-bg text-mint-text text-sm font-semibold"
        >
          ✓ Connected
        </button>
        <a
          href={`/messages/${user._id}`}
          className="relative flex-1 py-2 rounded-2xl bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-all text-center"
        >
          💬 Message
          {unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-coral-dark text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
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
        className="w-full py-2 rounded-2xl bg-cream text-muted text-sm font-semibold"
      >
        Pending...
      </button>
    );
  }
  if (user.connectionStatus === "pending" && !user.iSentRequest) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => onRespond(user._id, "accept")}
          className="flex-1 py-2 rounded-2xl bg-coral text-white text-sm font-semibold hover:bg-coral-dark"
        >
          Accept
        </button>
        <button
          onClick={() => onRespond(user._id, "reject")}
          className="flex-1 py-2 rounded-2xl border border-hairline text-muted text-sm font-semibold hover:bg-cream"
        >
          Ignore
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => onConnect(user._id)}
      className="w-full py-2 rounded-2xl bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-all"
    >
      + Connect
    </button>
  );
}

export default function Dashboard() {
  const { data: session } = useSession();
  const isVerified = (session?.user as any)?.isVerified;
  const isAdmin = (session?.user as any)?.isAdmin;
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
  const [activeTab, setActiveTab] = useState<"network" | "posts">("network");
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingRequests() {
    try {
      const res = await fetch("/api/connections/list?type=pending", { cache: "no-store" });
      const data = await res.json();
      if (data.connections) setPendingRequests(data.connections);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchUnreadCounts() {
    try {
      const res = await fetch("/api/messages/unread", { cache: "no-store" });
      const data = await res.json();
      if (data.counts) setUnreadCounts(data.counts);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchPosts() {
    try {
      const res = await fetch("/api/posts", { cache: "no-store" });
      const data = await res.json();
      if (data.posts) setPosts(data.posts);
    } catch (e) {
      console.error(e);
    } finally {
      setPostsLoading(false);
    }
  }

  async function handleCreatePost(content: string, media: MediaItem[]): Promise<boolean> {
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, media }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchPosts();
        return true;
      }
      showToast(data.error || "Failed to post", "error");
      return false;
    } catch {
      showToast("Network error — please try again", "error");
      return false;
    }
  }

  useEffect(() => {
    if (isVerified) {
      fetchUsers();
      fetchPendingRequests();
      fetchUnreadCounts();
    } else {
      setLoading(false);
    }
    fetchPosts();
    const interval = setInterval(() => {
      if (isVerified) {
        fetchUsers();
        fetchPendingRequests();
        fetchUnreadCounts();
      }
      fetchPosts();
    }, 10000);
    return () => clearInterval(interval);
  }, [isVerified]);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleConnect(recipientId: string) {
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
        fetchUsers();
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
      fetchUsers();
      fetchPendingRequests();
    } catch (e) {
      console.error(e);
    }
  }

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

  return (
    <div className="min-h-screen bg-campus-mesh">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === "success" ? "bg-mint-text" : "bg-coral-dark"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="bg-white border-b border-hairline px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-coral flex items-center justify-center font-display font-bold text-white text-sm">CC</div>
          <h1 className="text-lg font-display font-semibold text-ink">Campus Connect</h1>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <a
              href="/admin"
              className="text-xs bg-lavender-bg text-lavender-text px-3 py-1.5 rounded-full font-semibold hover:opacity-80"
            >
              🛠️ Admin
            </a>
          )}
          {pendingRequests.length > 0 && (
            <button
              onClick={() => setShowRequests(!showRequests)}
              className="relative text-sm bg-lavender-bg text-lavender-text px-3 py-1.5 rounded-full font-semibold hover:opacity-80"
            >
              🔔 {pendingRequests.length} Request{pendingRequests.length > 1 ? "s" : ""}
            </button>
          )}
          {isVerified ? (
            <span className="text-xs bg-mint-bg text-mint-text px-3 py-1 rounded-full font-semibold">
              ✅ Verified
            </span>
          ) : (
            <a
              href="/verify"
              className="text-xs bg-gold-bg text-gold-text px-3 py-1 rounded-full font-semibold hover:opacity-80"
            >
              ⚠️ Click to Verify
            </a>
          )}
          <div className={`w-9 h-9 rounded-full ${avatarColor(userName)} flex items-center justify-center text-white text-sm font-display font-semibold overflow-hidden`}>
            {userImage ? (
              <img src={userImage} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
        </div>
      </div>

      {showRequests && pendingRequests.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="bg-white rounded-2xl border border-hairline shadow-sm p-4 mb-4">
            <h3 className="font-display font-semibold text-ink mb-3 text-sm">
              Connection Requests ({pendingRequests.length})
            </h3>
            <div className="flex flex-col gap-3">
              {pendingRequests.map((req) => (
                <div key={req._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${avatarColor(req.requester._id)} flex items-center justify-center text-white font-display font-semibold text-sm overflow-hidden`}>
                      {req.requester.image ? (
                        <img src={req.requester.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        req.requester.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{req.requester.name}</p>
                      <p className="text-xs text-muted">
                        {req.requester.branch} • {req.requester.year} Year
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond(req.requester._id, "accept")}
                      className="px-3 py-1.5 bg-coral text-white text-xs rounded-lg font-semibold hover:bg-coral-dark"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespond(req.requester._id, "reject")}
                      className="px-3 py-1.5 border border-hairline text-muted text-xs rounded-lg font-semibold hover:bg-cream"
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
            <h2 className="text-2xl font-display font-semibold text-ink">
              Welcome, {userName.split(" ")[0]}! 👋
            </h2>
            <p className="text-muted text-sm mt-1">
              Connect with CU students, alumni and teachers
            </p>
          </div>
          <button
            onClick={() => { if (isVerified) { fetchUsers(); fetchPendingRequests(); } fetchPosts(); }}
            className="text-xs text-muted border border-hairline px-3 py-1.5 rounded-lg hover:bg-white mt-1"
          >
            ↻ Refresh
          </button>
        </div>

        {!isVerified && (
          <div className="bg-gold-bg border border-gold-text/20 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-gold-text">
              You're viewing a limited preview. <strong>Verify your CU UID</strong> to unlock the
              full student network — search, connect, and chat with CU students and alumni.
            </p>
            <a
              href="/verify"
              className="shrink-0 px-4 py-2 rounded-2xl bg-coral text-white text-sm font-semibold hover:bg-coral-dark text-center"
            >
              Verify Now
            </a>
          </div>
        )}

        {isVerified && (
          <div className="flex gap-2 mb-6">
            {(["network", "posts"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full border text-sm font-semibold capitalize transition-all ${
                  activeTab === tab
                    ? "bg-ink text-white border-ink"
                    : "bg-white border-hairline text-muted hover:border-coral hover:text-coral"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {!isVerified ? (
          <div className="max-w-2xl mx-auto">
            <PostsFeedList posts={posts} loading={postsLoading} />
          </div>
        ) : activeTab === "posts" ? (
          <div className="max-w-2xl mx-auto">
            <PostComposer onPost={handleCreatePost} />
            <PostsFeedList posts={posts} loading={postsLoading} />
          </div>
        ) : (
          <>
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, branch, skills..."
            className="w-full bg-white border border-hairline rounded-2xl px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {["All", "CSE", "ECE", "ME", "Student", "Alumni", "AI/ML", "Web Dev"].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-all ${
                activeFilter === f
                  ? "bg-ink text-white border-ink"
                  : "bg-white border-hairline text-muted hover:border-coral hover:text-coral"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-hairline animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-hairline" />
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-28 bg-hairline rounded" />
                    <div className="h-2 w-20 bg-cream rounded" />
                  </div>
                </div>
                <div className="h-8 bg-cream rounded-2xl" />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="text-muted text-sm text-center py-12">No users found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => (
              <div
                key={user._id}
                className="bg-white rounded-2xl p-5 border border-hairline shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full ${avatarColor(user._id)} flex items-center justify-center text-white font-display font-semibold text-sm overflow-hidden`}>
                    {user.image ? (
                      <img src={user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-display font-semibold text-ink text-sm">{user.name}</h3>
                      {user.isVerified && (
                        <span className="text-xs text-mint-text">✅</span>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      {[user.branch, user.year ? `${user.year} Year` : null, user.role]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                </div>

                {user.techStack && user.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {user.techStack.slice(0, 4).map((tech, i) => (
                      <span
                        key={tech}
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TAG_COLORS[i % TAG_COLORS.length].bg} ${TAG_COLORS[i % TAG_COLORS.length].text}`}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                {user.interests && user.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {user.interests.slice(0, 3).map((interest, i) => (
                      <span
                        key={interest}
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TAG_COLORS[(i + 2) % TAG_COLORS.length].bg} ${TAG_COLORS[(i + 2) % TAG_COLORS.length].text}`}
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                )}

                <ConnectButton
                  user={user}
                  unreadCounts={unreadCounts}
                  onConnect={handleConnect}
                  onRespond={handleRespond}
                />
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
