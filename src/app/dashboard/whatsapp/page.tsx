"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
// Image import removed
import { QRCodeSVG } from "qrcode.react";

type WhatsAppStatus = {
  status: "connected" | "connecting" | "qr" | "disconnected" | "error";
  qr?: string;
  user?: { name: string; id: string };
  error?: string;
};

export default function WhatsAppPage() {
  const { idToken } = useAuth();
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({ status: "disconnected" });
  const [loading, setLoading] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("all");
  const [broadcasting, setBroadcasting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      setWaStatus(data);
    } catch {
      setWaStatus({ status: "error", error: "Failed to connect to WhatsApp API" });
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/whatsapp/config", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWelcomeMessage(data.welcomeMessage || "");
      }
    } catch {
      console.error("Failed to fetch config");
    }
  };

  useEffect(() => {
    if (idToken) {
      fetchStatus();
      fetchConfig();
      const interval = setInterval(fetchStatus, 5000); // Poll status
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveWelcomeMessage = async () => {
    setSavingWelcome(true);
    try {
      const res = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ welcomeMessage }),
      });
      if (!res.ok) throw new Error("Failed to save");
      showToast("Welcome message saved successfully!", "success");
    } catch {
      showToast("Error saving welcome message", "error");
    } finally {
      setSavingWelcome(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setBroadcasting(true);
    try {
      const res = await fetch("/api/whatsapp/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ message: broadcastMessage, target: broadcastTarget }),
      });
      if (!res.ok) throw new Error("Failed to broadcast");
      const data = await res.json();
      showToast(`Broadcast queued for ${data.count} users!`, "success");
      setBroadcastMessage("");
    } catch {
      showToast("Error sending broadcast", "error");
    } finally {
      setBroadcasting(false);
    }
  };

  const triggerAction = async (action: "logout" | "restart") => {
    setLoading(true);
    try {
      await fetch("/api/whatsapp/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action }),
      });
      setTimeout(fetchStatus, 2000);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white font-medium z-50 ${toast.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between dashboard-page-header">
        <h1 className="text-3xl font-bold text-[#2d3748]">WhatsApp Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Status Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
          <h2 className="text-xl font-semibold text-[#2d3748] mb-4">Connection Status</h2>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4059ad]"></div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4">
              {waStatus.status === "connected" && (
                <>
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-lg font-medium text-green-600">Connected</h3>
                  {waStatus.user && <p className="text-[#4a5568]">{waStatus.user.name}</p>}
                  <button onClick={() => triggerAction("logout")} className="mt-4 px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
                    Logout
                  </button>
                </>
              )}

              {waStatus.status === "qr" && waStatus.qr && (
                <>
                  <p className="text-sm text-[#718096] mb-2 text-center">Scan this QR code with your WhatsApp app to link devices.</p>
                  <div className="p-4 bg-white border rounded-xl">
                    <QRCodeSVG value={waStatus.qr} size={200} />
                  </div>
                </>
              )}

              {(waStatus.status === "connecting" || waStatus.status === "disconnected") && !waStatus.qr && (
                <>
                  <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600"></div>
                  </div>
                  <h3 className="text-lg font-medium text-yellow-600">Connecting...</h3>
                  <p className="text-sm text-[#718096]">Waiting for WhatsApp to initialize.</p>
                </>
              )}

              {waStatus.status === "error" && (
                <>
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <h3 className="text-lg font-medium text-red-600">Error</h3>
                  <p className="text-sm text-red-500 text-center">{waStatus.error}</p>
                  <button onClick={() => triggerAction("restart")} className="mt-4 px-4 py-2 text-sm text-white bg-[#4059ad] rounded-lg hover:bg-[#344a8a] transition">
                    Restart Connection
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Welcome Message Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
          <h2 className="text-xl font-semibold text-[#2d3748] mb-4">Welcome Message</h2>
          <p className="text-sm text-[#718096] mb-4">
            This message will be automatically sent to users when they sign up for the first time.
          </p>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            className="w-full h-32 p-3 border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#4059ad] focus:border-transparent resize-none text-[#2d3748]"
            placeholder="Hi {name}, welcome to Genetix! We are glad to have you on board."
          />
          <p className="text-xs text-[#a0aec0] mt-2 mb-4">
            Available variables: <code className="bg-[#f8f9fa] px-1 rounded">{'{name}'}</code>
          </p>
          <div className="flex justify-end">
            <button
              onClick={saveWelcomeMessage}
              disabled={savingWelcome}
              className="px-6 py-2 bg-[#4059ad] text-white rounded-lg hover:bg-[#344a8a] transition disabled:opacity-50 font-medium"
            >
              {savingWelcome ? "Saving..." : "Save Message"}
            </button>
          </div>
        </div>
      </div>

      {/* Broadcast Message Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-[#e2e8f0] p-6">
        <h2 className="text-xl font-semibold text-[#2d3748] mb-4">Broadcast Message</h2>
        <p className="text-sm text-[#718096] mb-6">
          Send a bulk message to specific user segments.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#4a5568] mb-2">Target Audience</label>
            <select
              value={broadcastTarget}
              onChange={(e) => setBroadcastTarget(e.target.value)}
              className="w-full md:w-1/2 p-2.5 border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#4059ad] bg-white text-[#2d3748]"
            >
              <option value="all">All Users</option>
              <option value="no-images">Users with NO Images</option>
              <option value="partial">Users with Partial Images</option>
              <option value="completed">Users with Completed Images</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4a5568] mb-2">Message</label>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full h-32 p-3 border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#4059ad] focus:border-transparent resize-none text-[#2d3748]"
              placeholder="Type your broadcast message here..."
            />
          </div>
          
          <div className="flex justify-end pt-2">
            <button
              onClick={sendBroadcast}
              disabled={broadcasting || !broadcastMessage.trim() || waStatus.status !== "connected"}
              className="px-6 py-2 bg-[#4059ad] text-white rounded-lg hover:bg-[#344a8a] transition disabled:opacity-50 font-medium flex items-center gap-2"
            >
              {broadcasting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  Send Broadcast
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
