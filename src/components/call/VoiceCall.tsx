import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Phone, PhoneOff, Mic, MicOff, User, Volume2 } from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

interface VoiceCallProps {
  callId?: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  isIncoming?: boolean;
  onEnd?: () => void;
}

type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export function VoiceCall({
  callId: existingCallId,
  currentUserId,
  otherUserId,
  otherUserName,
  isIncoming = false,
  onEnd,
}: VoiceCallProps) {
  const [status, setStatus] = useState<CallStatus>(isIncoming ? "ringing" : "idle");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState(existingCallId);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  // Initialize WebRTC
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Listen for signaling
  useEffect(() => {
    if (!callId) return;

    const q = query(
      collection(db, "calls", callId, "signals"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, async (snap) => {
      for (const change of snap.docChanges()) {
        if (change.type !== "added") continue;
        const payload = change.doc.data() as any;
        const { type, data, from } = payload;
        if (!type || from === currentUserId) continue;
        if (type === "offer") await handleOffer(data);
        if (type === "answer") await handleAnswer(data);
        if (type === "ice-candidate") await handleIceCandidate(data);
        if (type === "end") endCall(false);
      }
    });

    return () => unsub();
  }, [callId, currentUserId]);

  // Call duration timer
  useEffect(() => {
    if (status === "connected") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status]);

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const createPeerConnection = async () => {
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate && callId) {
        void sendSignal("ice-candidate", event.candidate);
      }
    };

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("connected");
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        endCall();
      }
    };

    // Get local stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (error) {
      toast.error("Could not access microphone");
      throw error;
    }

    peerConnectionRef.current = pc;
    return pc;
  };

  const sendSignal = async (type: string, data: any) => {
    if (!callId) return;
    await addDoc(collection(db, "calls", callId, "signals"), {
      type,
      data,
      from: currentUserId,
      createdAt: serverTimestamp(),
    });
  };

  const startCall = async () => {
    setStatus("calling");

    // Generate call ID
    const newCallId = crypto.randomUUID();
    setCallId(newCallId);

    // Create call session doc
    await setDoc(doc(db, "calls", newCallId), {
      callerId: currentUserId,
      calleeId: otherUserId,
      status: "ringing",
      createdAt: serverTimestamp(),
    });

    // Notify other user
    await addDoc(collection(db, "notifications"), {
      userId: otherUserId,
      title: "Incoming Call",
      body: `${otherUserName} is calling you`,
      type: "call",
      data: { callId: newCallId, callerId: currentUserId, callerName: otherUserName },
      read: false,
      createdAt: serverTimestamp(),
    });

    try {
      const pc = await createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for other user to join, then send offer
      setTimeout(() => {
        void sendSignal("offer", offer);
      }, 1000);

      setStatus("calling");
    } catch (error) {
      setStatus("idle");
      toast.error("Failed to start call");
    }
  };

  const answerCall = async () => {
    setStatus("connected");
    try {
      await createPeerConnection();
      if (callId) {
        await updateDoc(doc(db, "calls", callId), { status: "connected" });
      }
    } catch (error) {
      endCall();
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      await createPeerConnection();
    }

    const pc = peerConnectionRef.current!;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await sendSignal("answer", answer);
    setStatus("connected");
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    setStatus("connected");
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const endCall = (sendEndSignal = true) => {
    if (sendEndSignal) void sendSignal("end", {});
    cleanup();
    setStatus("ended");
    if (callId) void updateDoc(doc(db, "calls", callId), { status: "ended" });
    onEnd?.();
  };

  const declineCall = () => {
    void sendSignal("end", {});
    cleanup();
    setStatus("ended");
    if (callId) void updateDoc(doc(db, "calls", callId), { status: "ended" });
    onEnd?.();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg flex items-center justify-center">
      <audio ref={audioRef} autoPlay />

      <div className="text-center space-y-8 animate-scale-in">
        {/* Avatar */}
        <div className="relative mx-auto">
          <div className={`w-32 h-32 rounded-full bg-secondary flex items-center justify-center ${
            status === "calling" || status === "ringing" ? "animate-pulse" : ""
          }`}>
            <User className="w-16 h-16 text-muted-foreground" />
          </div>
          {status === "connected" && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm">
              <Volume2 className="w-4 h-4 inline mr-1" />
              Connected
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <h2 className="text-2xl font-bold">{otherUserName}</h2>
          <p className="text-muted-foreground">
            {status === "idle" && "Voice Call"}
            {status === "calling" && "Calling..."}
            {status === "ringing" && "Incoming call..."}
            {status === "connected" && formatDuration(callDuration)}
            {status === "ended" && "Call ended"}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          {status === "idle" && (
            <Button
              size="lg"
              className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90"
              onClick={startCall}
            >
              <Phone className="w-7 h-7" />
            </Button>
          )}

          {status === "ringing" && (
            <>
              <Button
                size="lg"
                variant="destructive"
                className="w-16 h-16 rounded-full"
                onClick={declineCall}
              >
                <PhoneOff className="w-7 h-7" />
              </Button>
              <Button
                size="lg"
                className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90"
                onClick={answerCall}
              >
                <Phone className="w-7 h-7" />
              </Button>
            </>
          )}

          {(status === "calling" || status === "connected") && (
            <>
              <Button
                size="lg"
                variant={isMuted ? "destructive" : "secondary"}
                className="w-14 h-14 rounded-full"
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="w-16 h-16 rounded-full"
                onClick={() => endCall()}
              >
                <PhoneOff className="w-7 h-7" />
              </Button>
            </>
          )}

          {status === "ended" && (
            <Button variant="outline" onClick={onEnd}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
