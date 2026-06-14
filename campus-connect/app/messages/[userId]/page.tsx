"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

type Message = {
  _id: string;
  sender: string;
  recipient: string;
  content: string;
  createdAt: string;
  read: boolean;
};

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

  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history from API
  useEffect(() => {
    if (!otherUserId) return;
    fetch(`/api/messages/${otherUserId}`)
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

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect");
      socket.off("receive_message", onMessage);
    };
  }, [myId, otherUserId]);

  function sendMessage() {
    const text = input.trim();
    if (!text || !myId) return;

    const socket = getSocket();
    socket.emit("send_message", {
      senderId: myId,
      recipientId: otherUserId,
      content: text,
    });

    setInput("");
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-blue-600 text-sm hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-500 hover:text-gray-800 text-sm mr-1"
        >
          ←
        </button>

        {otherUser ? (
          <>
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm overflow-hidden">
              {otherUser.image ? (
                <img src={otherUser.image} alt="" className="w-full h-full object-cover" />
              ) : (
                otherUser.name?.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{otherUser.name}</p>
              <p className="text-xs text-gray-500">
                {[otherUser.branch, otherUser.year ? `${otherUser.year} Year` : null]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </div>
          </>
        ) : (
          <div className="h-9 w-32 bg-gray-100 rounded animate-pulse" />
        )}

        {/* Online indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`} />
          <span className="text-xs text-gray-400">{connected ? "Live" : "Connecting..."}</span>
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
                <div className="h-9 w-48 bg-gray-200 rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-sm">
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
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white text-gray-900 border border-gray-100 rounded-bl-sm shadow-sm"
                  }`}
                >
                  <p className="leading-relaxed">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isMe ? "text-blue-200" : "text-gray-400"
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 flex items-end gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send)"
          rows={1}
          className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32 overflow-y-auto"
          style={{ minHeight: "44px" }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || !connected}
          className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
