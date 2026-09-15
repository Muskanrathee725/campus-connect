"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

type MediaItem = {
  type: "image" | "document";
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
};

type Message = {
  _id: string;
  sender: string;
  recipient: string;
  content: string;
  attachment?: MediaItem;
  createdAt: string;
  delivered: boolean;
  read: boolean;
};

const MAX_ATTACHMENT_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const DOC_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx," + ALLOWED_DOC_TYPES.join(",");

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

type OtherUser = {
  _id: string;
  name: string;
  image?: string;
  branch?: string;
  year?: string;
  role?: string;
};

export default function ChatPage() {
  const { data: session } = useSession();
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const otherUserId = params.userId;

  const myId = (session?.user as any)?.id as string | undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [attachment, setAttachment] = useState<MediaItem | null>(null);
  const [attachError, setAttachError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history from API
  useEffect(() => {
    if (!otherUserId) return;

    function loadHistory() {
      fetch(`/api/messages/${otherUserId}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setMessages(data.messages || []);
            setOtherUser(data.otherUser || null);
          }
        })
        .catch(() => setError("Failed to load messages"))
        .finally(() => setLoading(false));
    }

    loadHistory();

    // Next.js can reuse an already-rendered instance of this page when you
    // navigate back into it (its client-side router cache) — the mount
    // effect above won't fire again in that case, so this page would keep
    // showing whatever was in memory when you left. Re-fetching on focus
    // guarantees fresh history every time you actually look at the chat.
    function onVisible() {
      if (document.visibilityState === "visible") loadHistory();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", loadHistory);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", loadHistory);
    };
  }, [otherUserId]);

  // Connect to Socket.io and register
  useEffect(() => {
    if (!myId) return;

    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit("register", { userId: myId });
      socket.emit("mark_read", { senderId: otherUserId, recipientId: myId });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", () => setConnected(false));

    // If socket is already connected, register immediately — connect event won't re-fire
    if (socket.connected) {
      setConnected(true);
      socket.emit("register", { userId: myId });
      socket.emit("mark_read", { senderId: otherUserId, recipientId: myId });
    } else {
      socket.connect();
    }

    // Receive incoming messages
    const onMessage = (msg: Message) => {
      const isThisConversation =
        (msg.sender === myId && msg.recipient === otherUserId) ||
        (msg.sender === otherUserId && msg.recipient === myId);

      if (isThisConversation) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        if (msg.sender === otherUserId) {
          socket.emit("mark_read", { senderId: otherUserId, recipientId: myId });
        }
      }
    };

    socket.on("receive_message", onMessage);

    // Server emits this when the other person opens the chat and reads
    // our messages — flip their ticks from delivered to read (blue).
    const onMessagesRead = ({ by }: { by: string }) => {
      if (by !== otherUserId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.sender === myId && m.recipient === otherUserId ? { ...m, read: true } : m
        )
      );
    };
    socket.on("messages_read", onMessagesRead);

    // Server rejects an invalid/oversized attachment after we've already
    // cleared it from the input — surface why instead of failing silently.
    const onMessageError = ({ error }: { error: string }) => setAttachError(error);
    socket.on("message_error", onMessageError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect");
      socket.off("receive_message", onMessage);
      socket.off("messages_read", onMessagesRead);
      socket.off("message_error", onMessageError);
    };
  }, [myId, otherUserId]);

  async function handleAttachFile(files: FileList | null, type: "image" | "document") {
    const file = files?.[0];
    if (!file) return;
    setAttachError("");

    if (type === "document" && !ALLOWED_DOC_TYPES.includes(file.type)) {
      setAttachError("Supported documents: PDF, DOC, DOCX, PPT, PPTX.");
      return;
    }
    if (type === "image" && !file.type.startsWith("image/")) {
      setAttachError("Only image files are supported.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError(`${file.name} is too large (max 1.5MB).`);
      return;
    }

    const url = await readFileAsDataUrl(file);
    setAttachment({ type, url, name: file.name, mimeType: file.type, size: file.size });
  }

  function sendMessage() {
    const text = input.trim();
    if ((!text && !attachment) || !myId) return;

    const socket = getSocket();
    socket.emit("send_message", {
      senderId: myId,
      recipientId: otherUserId,
      content: text,
      attachment: attachment || undefined,
    });

    setInput("");
    setAttachment(null);
    setAttachError("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (error) {
    return (
      <div className="min-h-screen bg-campus-mesh flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-coral text-sm hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-campus-mesh">
      {/* Header */}
      <div className="bg-white border-b border-hairline px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-muted hover:text-ink text-sm mr-1"
        >
          ←
        </button>

        {otherUser ? (
          <>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-300 to-coral flex items-center justify-center text-white font-display font-semibold text-sm overflow-hidden">
              {otherUser.image ? (
                <img src={otherUser.image} alt="" className="w-full h-full object-cover" />
              ) : (
                otherUser.name?.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p className="font-display font-semibold text-ink text-sm">{otherUser.name}</p>
              <p className="text-xs text-muted">
                {[otherUser.branch, otherUser.year ? `${otherUser.year} Year` : null]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </div>
          </>
        ) : (
          <div className="h-9 w-32 bg-hairline rounded animate-pulse" />
        )}

        {/* Online indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-mint-text" : "bg-hairline"}`} />
          <span className="text-xs text-muted">{connected ? "Live" : "Connecting..."}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {loading ? (
          <div className="flex flex-col gap-3 mt-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <div className="h-9 w-48 bg-hairline rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted text-sm">
              No messages yet. Say hi to {otherUser?.name?.split(" ")[0] ?? "them"}!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === myId;
            return (
              <div
                key={msg._id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? "bg-coral text-white rounded-br-sm"
                      : "bg-white text-ink border border-hairline rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.content && <p className="leading-relaxed">{msg.content}</p>}
                  {msg.attachment && (
                    <div className={msg.content ? "mt-2" : ""}>
                      {msg.attachment.type === "image" ? (
                        <img
                          src={msg.attachment.url}
                          alt={msg.attachment.name || "attachment"}
                          className="max-w-full max-h-64 rounded-xl object-cover"
                        />
                      ) : (
                        <a
                          href={msg.attachment.url}
                          download={msg.attachment.name}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center gap-2 p-2 rounded-xl ${
                            isMe ? "bg-coral-dark" : "bg-cream border border-hairline"
                          }`}
                        >
                          <span className="text-xl">📄</span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{msg.attachment.name}</p>
                            <p className={`text-[10px] ${isMe ? "text-white/80" : "text-muted"}`}>
                              {formatBytes(msg.attachment.size)}
                            </p>
                          </div>
                        </a>
                      )}
                    </div>
                  )}
                  <p
                    className={`text-[10px] mt-1 flex items-center gap-1 ${
                      isMe ? "text-white/80" : "text-muted"
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                    {isMe && (
                      <span className={msg.read ? "text-white" : "text-white/70"}>
                        {msg.read || msg.delivered ? "✓✓" : "✓"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-hairline px-4 py-3">
        {attachError && <p className="text-xs text-coral-dark mb-2">{attachError}</p>}

        {attachment && (
          <div className="relative inline-block mb-2">
            {attachment.type === "image" ? (
              <img
                src={attachment.url}
                alt={attachment.name}
                className="w-20 h-20 object-cover rounded-lg border border-hairline"
              />
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-hairline bg-cream">
                <span className="text-lg">📄</span>
                <div>
                  <p className="text-xs font-medium text-ink truncate max-w-[160px]">
                    {attachment.name}
                  </p>
                  <p className="text-[10px] text-muted">{formatBytes(attachment.size)}</p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-white text-xs flex items-center justify-center hover:opacity-80"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={!!attachment}
            className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-muted hover:bg-cream disabled:opacity-30"
            title="Attach photo"
          >
            🖼️
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              handleAttachFile(e.target.files, "image");
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={!!attachment}
            className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-muted hover:bg-cream disabled:opacity-30"
            title="Attach document (PDF, DOC, PPT)"
          >
            📄
          </button>
          <input
            ref={docInputRef}
            type="file"
            accept={DOC_ACCEPT}
            hidden
            onChange={(e) => {
              handleAttachFile(e.target.files, "document");
              e.target.value = "";
            }}
          />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            rows={1}
            className="flex-1 resize-none border border-hairline rounded-xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-coral max-h-32 overflow-y-auto"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && !attachment) || !connected}
            className="w-10 h-10 bg-coral rounded-xl flex items-center justify-center text-white hover:bg-coral-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
