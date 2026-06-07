import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, X, ArrowLeft, Check, CheckCheck, MessageCircle } from "lucide-react";
import { arrayUnion, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import {
  getOrCreateChat,
  listenMessages,
  sendMessage as firebaseSendMessage,
} from "@/services/firebase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  chatId?: string;
  requestId: string;
  currentUserId: string;
  /** Label for the current user e.g. "driver" or "customer" */
  currentUserRole?: string;
  /** Display name of the sender (shown in recipient's notification) */
  senderName?: string;
  otherUserId: string;
  otherUserName: string;
  /** Cloudinary / photoURL of the other party */
  otherUserPhoto?: string | null;
  /** Label shown under the name e.g. "Driver" or "Customer" */
  otherUserRole?: string;
  /** Short delivery name shown as subtitle in the header */
  deliveryName?: string;
  onClose?: () => void;
  /** Called whenever the unread count changes (for badge in parent) */
  onUnreadCountChange?: (count: number) => void;
  /** Removes rounded corners, border, and shadow — for embedding in a full-page layout */
  flat?: boolean;
  /** Shows an ArrowLeft back icon instead of X for the close button */
  backButton?: boolean;
  /** True when the on-screen keyboard is open — suppresses safe-area-inset-bottom to close the gap */
  keyboardOpen?: boolean;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt?: any;
  readBy: string[];
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function toDate(ts: any): Date | null {
  if (!ts) return null;
  return ts?.toDate ? ts.toDate() : new Date(ts);
}

function formatTime(ts: any): string {
  const d = toDate(ts);
  if (!d) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSep(ts: any): string {
  const d = toDate(ts);
  if (!d) return "";
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function sameDay(a: any, b: any): boolean {
  const da = toDate(a); const db2 = toDate(b);
  if (!da || !db2) return false;
  return da.toDateString() === db2.toDateString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPanel({
  chatId: existingChatId,
  requestId,
  currentUserId,
  currentUserRole: _currentUserRole,
  senderName,
  otherUserId,
  otherUserName,
  otherUserPhoto,
  otherUserRole,
  deliveryName,
  onClose,
  onUnreadCountChange,
  flat = false,
  backButton = false,
  keyboardOpen = false,
}: ChatPanelProps) {
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [newMessage,    setNewMessage]    = useState("");
  const [chatId,        setChatId]        = useState(existingChatId);
  const [isSending,     setIsSending]     = useState(false);
  const [isInitialising,setIsInitialising]= useState(!existingChatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (existingChatId) { setChatId(existingChatId); setIsInitialising(false); return; }
    (async () => {
      try {
        const id = await getOrCreateChat(requestId, [currentUserId, otherUserId]);
        setChatId(id);
      } catch (e) {
        console.error("Chat init:", e);
        toast.error("Could not open chat");
      } finally {
        setIsInitialising(false);
      }
    })();
  }, [existingChatId, requestId, currentUserId, otherUserId]);

  // ── Listen ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    const unsub = listenMessages(chatId, (msgs) => {
      const converted: Message[] = msgs.map((m) => ({
        id: m.id, content: m.content,
        senderId: m.senderId, createdAt: m.createdAt,
        readBy: m.readBy ?? [],
      }));
      setMessages(converted);
      // count unread and notify parent
      const unreadCount = converted.filter(
        (m) => m.senderId !== currentUserId && !m.readBy.includes(currentUserId)
      ).length;
      onUnreadCountChange?.(unreadCount);
      // mark unread as read (fire-and-forget)
      converted
        .filter((m) => m.senderId !== currentUserId && !m.readBy.includes(currentUserId))
        .forEach((m) => {
          updateDoc(doc(db, "messages", m.id), { readBy: arrayUnion(currentUserId) }).catch(() => {});
        });
    });
    return () => unsub();
  }, [chatId, currentUserId]);

  // ── Scroll on new messages ────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Keep scroll at bottom when keyboard opens / closes ────────────────────
  // The messages container shrinks when the overlay height changes; without
  // this the last message can drift behind the new bottom edge.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () =>
      requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView());
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // ── Focus on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isInitialising) setTimeout(() => inputRef.current?.focus(), 80);
  }, [isInitialising]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !chatId || isSending) return;
    setIsSending(true);
    setNewMessage("");
    try {
      await firebaseSendMessage(chatId, currentUserId, text);
      const preview = text.length > 60 ? text.slice(0, 57) + "..." : text;
      void setDoc(doc(db, "notifications", `chat_${requestId}_${otherUserId}`), {
        userId: otherUserId,
        title: senderName ? `New message from ${senderName}` : "New message",
        message: preview,
        type: "chat",
        read: false,
        requestId,
        createdAt: serverTimestamp(),
      });
    } catch {
      toast.error("Failed to send message");
      setNewMessage(text);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const initials = otherUserName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col overflow-hidden${flat ? " flex-1 min-h-0 h-full bg-[#f2f6f3]" : " h-full bg-[#f2f6f3] rounded-2xl border border-gray-100 shadow-xl"}`}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back / close */}
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0 -ml-1"
            >
              {backButton ? <ArrowLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>
          )}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#005C25] to-[#028538] flex items-center justify-center overflow-hidden ring-2 ring-[#028538]/20 ring-offset-1">
              {otherUserPhoto
                ? <img src={otherUserPhoto} alt={otherUserName} className="w-full h-full object-cover" />
                : <span className="text-sm font-bold text-white">{initials}</span>
              }
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-[1.5px] ring-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight truncate">{otherUserName}</p>
            {(otherUserRole || deliveryName) && (
              <p className="text-[10px] text-[#028538] font-semibold uppercase tracking-widest truncate">
                {otherUserRole}{deliveryName ? ` · ${deliveryName}` : ""}
              </p>
            )}
            {!otherUserRole && !deliveryName && (
              <p className="text-[10px] text-emerald-500 font-semibold">Online</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5" style={{ WebkitOverflowScrolling: "touch" }}>
        {isInitialising ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#028538] border-t-transparent animate-spin" />
            <p className="text-xs text-gray-400 font-medium">Connecting…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="relative mb-5">
              <div className="w-20 h-20 rounded-full bg-[#028538]/8 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[#028538]/15 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-[#028538]" />
                </div>
              </div>
            </div>
            <p className="text-base font-bold text-gray-800">No messages yet</p>
            <p className="text-sm text-gray-400 mt-1.5 leading-relaxed max-w-[200px]">
              Say hello to {otherUserName}
            </p>
          </div>
        ) : (
          messages.map((message, idx) => {
            const isOwn       = message.senderId === currentUserId;
            const isRead      = message.readBy?.includes(otherUserId);
            const prev        = messages[idx - 1];
            const next        = messages[idx + 1];
            const showDate    = !prev || !sameDay(prev.createdAt, message.createdAt);
            const showAvatar  = !isOwn && (!next || next.senderId !== message.senderId);
            const isSameGroup = prev && prev.senderId === message.senderId && !showDate;

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex items-center gap-3 py-4">
                    <div className="flex-1 h-px bg-gray-200/70" />
                    <span className="text-[10px] font-bold text-gray-400 tracking-wider px-1 shrink-0">
                      {formatDateSep(message.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-gray-200/70" />
                  </div>
                )}

                <div className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"} ${isSameGroup ? "mt-0.5" : "mt-3"}`}>
                  {/* Incoming avatar */}
                  {!isOwn && (
                    <div className="w-7 h-7 flex-shrink-0 flex items-end mb-0.5">
                      {showAvatar ? (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#005C25] to-[#028538] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {otherUserPhoto
                            ? <img src={otherUserPhoto} alt="" className="w-full h-full object-cover" />
                            : <span className="text-[9px] font-bold text-white">{initials}</span>
                          }
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div
                    className={`max-w-[74%] px-3.5 py-2.5 ${
                      isOwn
                        ? "bg-[#028538] text-white rounded-2xl rounded-br-sm shadow-md shadow-[#028538]/20"
                        : "bg-white text-gray-800 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100/80"
                    }`}
                  >
                    <p className="text-[13.5px] leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
                    <div className={`flex items-center gap-1 mt-1.5 ${isOwn ? "justify-end" : "justify-start"}`}>
                      <span className={`text-[10px] font-medium ${isOwn ? "text-white/55" : "text-gray-400"}`}>
                        {formatTime(message.createdAt)}
                      </span>
                      {isOwn && (
                        isRead
                          ? <CheckCheck className="w-3 h-3 text-white/70" />
                          : <Check className="w-3 h-3 text-white/45" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      <div
        className="px-3 py-3 bg-white border-t border-gray-100 flex-shrink-0"
        style={{
          paddingBottom: keyboardOpen
            ? "0.75rem"
            : "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-1 focus-within:border-[#028538]/40 focus-within:bg-white transition-colors">
          <input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherUserName}…`}
            disabled={isInitialising}
            className="flex-1 bg-transparent text-base text-gray-800 placeholder:text-gray-400 outline-none py-2 min-w-0"
            style={{ touchAction: "manipulation" }}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending || isInitialising}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[#028538] text-white hover:bg-[#026b2d] disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-90 flex-shrink-0 shadow-sm shadow-[#028538]/30"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Unread count hook — import in parents to show badge on chat button ─────────

export function useChatUnreadCount(
  requestId: string | undefined,
  currentUserId: string,
  otherUserId: string
): number {
  const [chatId,  setChatId]  = useState<string | undefined>();
  const [count,   setCount]   = useState(0);

  // Resolve chat id from requestId
  useEffect(() => {
    if (!requestId || !currentUserId || !otherUserId) return;
    getOrCreateChat(requestId, [currentUserId, otherUserId])
      .then(setChatId)
      .catch(() => {});
  }, [requestId, currentUserId, otherUserId]);

  useEffect(() => {
    if (!chatId) return;
    const unsub = listenMessages(chatId, (msgs) => {
      setCount(
        msgs.filter(
          (m) => m.senderId !== currentUserId && !(m.readBy ?? []).includes(currentUserId)
        ).length
      );
    });
    return () => unsub();
  }, [chatId, currentUserId]);

  return count;
}