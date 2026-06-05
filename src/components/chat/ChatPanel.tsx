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

  // ── Scroll ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    <div className={`flex flex-col h-full bg-white overflow-hidden${flat ? "" : " rounded-2xl border border-gray-100 shadow-xl"}`}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[#e6f4ed] flex items-center justify-center overflow-hidden ring-2 ring-[#028538]/15">
              {otherUserPhoto
                ? <img src={otherUserPhoto} alt={otherUserName} className="w-full h-full object-cover" />
                : <span className="text-sm font-bold text-[#028538]">{initials}</span>
              }
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#028538] rounded-full ring-2 ring-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{otherUserName}</p>
            {otherUserRole && (
              <p className="text-[10px] text-[#028538] font-semibold uppercase tracking-widest">
                {otherUserRole}{deliveryName ? ` · ${deliveryName}` : ""}
              </p>
            )}
            {!otherUserRole && deliveryName && (
              <p className="text-[10px] text-gray-400 font-semibold">{deliveryName}</p>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {backButton ? <ArrowLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 bg-[#f8faf8]">
        {isInitialising ? (
          <div className="flex flex-col items-center justify-center h-full py-10 gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-[#028538] border-t-transparent animate-spin" />
            <p className="text-xs text-gray-400">Connecting…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="w-14 h-14 bg-[#e6f4ed] rounded-2xl flex items-center justify-center mb-3">
              <MessageCircle className="w-7 h-7 text-[#028538]" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">Start the conversation with {otherUserName}</p>
          </div>
        ) : (
          messages.map((message, idx) => {
            const isOwn      = message.senderId === currentUserId;
            const isRead     = message.readBy?.includes(otherUserId);
            const prev       = messages[idx - 1];
            const next       = messages[idx + 1];
            const showDate   = !prev || !sameDay(prev.createdAt, message.createdAt);
            // Show avatar only on the last bubble in an incoming sequence
            const showAvatar = !isOwn && (!next || next.senderId !== message.senderId);
            const isSameGroup = prev && prev.senderId === message.senderId && !showDate;

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex items-center gap-2 py-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-[10px] font-semibold text-gray-400 px-2 shrink-0">
                      {formatDateSep(message.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}

                <div className={`flex items-end gap-1.5 ${isOwn ? "justify-end" : "justify-start"} ${isSameGroup ? "mt-0.5" : "mt-2"}`}>
                  {/* Spacer / avatar for incoming */}
                  {!isOwn && (
                    <div className="w-6 h-6 flex-shrink-0 flex items-end">
                      {showAvatar ? (
                        <div className="w-6 h-6 rounded-full bg-[#e6f4ed] flex items-center justify-center overflow-hidden">
                          {otherUserPhoto
                            ? <img src={otherUserPhoto} alt="" className="w-full h-full object-cover" />
                            : <span className="text-[8px] font-bold text-[#028538]">{initials}</span>
                          }
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div
                    className={`max-w-[72%] rounded-2xl px-3.5 py-2 ${
                      isOwn
                        ? "bg-[#028538] text-white rounded-br-md shadow-sm shadow-[#028538]/20"
                        : "bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100"
                    }`}
                  >
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                      <span className={`text-[10px] ${isOwn ? "text-white/60" : "text-gray-400"}`}>
                        {formatTime(message.createdAt)}
                      </span>
                      {isOwn && (
                        isRead
                          ? <CheckCheck className="w-3 h-3 text-white/70" />
                          : <Check className="w-3 h-3 text-white/50" />
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

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherUserName}…`}
            className="flex-1 rounded-xl border-gray-200 bg-gray-50 focus-visible:ring-[#028538]/30"
            disabled={isInitialising}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending || isInitialising}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#028538] text-white hover:bg-[#026b2d] disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95 flex-shrink-0 shadow-sm shadow-[#028538]/25"
          >
            <Send className="w-4 h-4" />
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