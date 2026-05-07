import { NextRequest, NextResponse } from "next/server";
import { getAuth, getFirestore } from "@/lib/firebase-admin";

const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";
const ENV_OPENAI_BASE = process.env.OPENAI_API_BASE || "";
const ENV_OPENAI_MODEL = process.env.OPENAI_MODEL || "";
const MEMORY_MESSAGES = 5; // 5-message memory (last 5 messages total, excluding system prompt)

function getBearerToken(req: NextRequest): string | null {
  const raw = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!raw) return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function systemPromptForApp(): string {
  // Keep it short but informative (this is sent on every request).
  return [
    "You are the Genetix app assistant for a Flutter mobile app (DMIT / fingerprint analysis app).",
    "You MUST answer in 50–100 words, simple English.",
    "Formatting: 2–4 short lines, each starts with a label like 'Elite:', 'Benefits:', 'How to:', 'Next step:'. No markdown, no bullets, no numbering.",
    "Answer only about this app. If the question is outside the app, say you can only help with the app and ask what they want to do inside the app.",
    "What the app does: users sign up/log in, manage profile, upload fingerprint images (left/right hand), view reports and content, buy Elite membership, view counselling services/offers, referral system (U Share V Care), support section, and app content pages (About Us, Testimonials, FAQs, YouTube help, Points & Usage).",
    "Important data: user profile is stored in Firestore collection 'users' (doc id = Firebase Auth uid). Fingerprints are under users/{uid}/LeftHandFingerprints and RightHandFingerprints. Elite status is users/{uid}.isEliteMember.",
    "If asked about notifications: admins can broadcast messages; users can see them in Profile → Notifications, and optionally as phone notification bar push if notifications are enabled.",
    "Answer user questions about how to use the app, where to find features, what Elite means, what to upload, and troubleshooting. If you are unsure, ask a clarifying question. Do NOT invent pricing or policy details unless the user provides them.",
  ].join("\n");
}

type ChatTurn = { role: "user" | "assistant"; content: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Short message for mobile app; full error is logged server-side. */
function userFacingOpenAIError(status: number, rawMessage: string): string {
  if (status === 429) {
    return "The AI assistant hit the OpenAI rate limit for your API key. Wait a minute and try again. Fix (admin): check billing/limits on your OpenAI project and API key.";
  }
  if (rawMessage.length > 280) {
    return `OpenAI error (${status}). Check server logs or your OpenAI dashboard.`;
  }
  return `OpenAI error (${status}): ${rawMessage}`;
}

type OpenAIChatCompletionsResponse = {
  choices?: Array<{ message?: { role?: string; content?: string } }>;
  error?: { message?: string; type?: string; code?: string | number };
};

/** Lightweight default model. */
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

function normalizeOpenAIBase(url: string): string {
  const t = url.trim();
  if (!t) return DEFAULT_OPENAI_BASE;
  return t.replace(/\/$/, "");
}

function clampWordsToMax(s: string, maxWords: number): string {
  const words = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length <= maxWords) return s.trim();
  return words.slice(0, maxWords).join(" ").replace(/[,\s]+$/, "").trim() + "…";
}

function sanitizeAssistantText(s: string): string {
  let t = s;
  // Strip common markdown noise (headings, bold, code ticks).
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/\*\*(.*?)\*\*/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");

  // Strip list markers (we want labeled lines instead).
  t = t.replace(/^\s*[-*•]\s+/gm, "");
  t = t.replace(/^\s*\d+[.)]\s+/gm, "");

  // Trim and normalize whitespace but keep line breaks.
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

async function openaiGenerate(systemPrompt: string, history: ChatTurn[]) {
  const db = getFirestore();
  const secretsDoc = await db.collection("appData").doc("Secrets").get();
  const data = secretsDoc.exists
    ? (secretsDoc.data() as {
        openaiApiKey?: unknown;
        openaiModel?: unknown;
        openaiApiBase?: unknown;
      })
    : {};

  const envKey = process.env.OPENAI_API_KEY?.trim();
  const keyFromDb = typeof data.openaiApiKey === "string" ? data.openaiApiKey.trim() : "";
  const apiKey = envKey || keyFromDb;

  const envBase = (ENV_OPENAI_BASE || "").trim();
  const baseFromDb = typeof data.openaiApiBase === "string" ? data.openaiApiBase.trim() : "";
  const baseUrl = normalizeOpenAIBase(envBase || baseFromDb || DEFAULT_OPENAI_BASE);

  const envModel = (ENV_OPENAI_MODEL || "").trim();
  const modelFromDb = typeof data.openaiModel === "string" ? data.openaiModel.trim() : "";
  const model = envModel || modelFromDb || DEFAULT_OPENAI_MODEL;

  if (!apiKey) {
    throw new Error(
      "OpenAI API key is not configured (set OPENAI_API_KEY on the server or appData/Secrets.openaiApiKey in Firestore)"
    );
  }

  const url = `${baseUrl}/chat/completions`;
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const body = JSON.stringify({
    model: model.trim() || DEFAULT_OPENAI_MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 170,
  });

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    const raw = (await res.json().catch(() => ({}))) as OpenAIChatCompletionsResponse;

    if (!res.ok) {
      const msg = raw.error?.message || (typeof raw === "object" ? JSON.stringify(raw) : "Request failed");
      console.error(`OpenAI API error attempt ${attempt}/${maxAttempts}`, res.status, msg);

      if (res.status === 429 && attempt < maxAttempts) {
        await sleep(2000 * attempt);
        continue;
      }

      throw new Error(userFacingOpenAIError(res.status, msg));
    }

    const text = raw.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      throw new Error("OpenAI returned empty response");
    }
    const trimmed = text.trim();
    const cleaned = sanitizeAssistantText(trimmed);
    // Hard-enforce upper bound so the mobile app always gets a short answer.
    // (We strongly prompt 50–100 words, but still clamp to 100 if it exceeds.)
    const clamped = clampWordsToMax(cleaned, 100);
    return clamped;
  }
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let decoded: { uid: string } | null = null;
  try {
    decoded = (await getAuth().verifyIdToken(token)) as { uid: string };
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const userMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (!userMessage) return NextResponse.json({ error: "message is required" }, { status: 400 });
  if (userMessage.length > 1500) return NextResponse.json({ error: "message too long" }, { status: 400 });

  const db = getFirestore();
  const uid = decoded.uid;
  const messagesRef = db.collection("users").doc(uid).collection("AiChatMessages");
  const now = new Date();

  try {
    // Load chatbot configuration (system prompt + memory) from appData/Settings, with safe fallbacks.
    let systemPrompt = systemPromptForApp();
    let memoryCount = MEMORY_MESSAGES;
    try {
      const settingsSnap = await db.collection("appData").doc("Settings").get();
      if (settingsSnap.exists) {
        const settings = settingsSnap.data() as {
          chatbotSystemPrompt?: unknown;
          chatbotMemoryMessages?: unknown;
        };
        const customPrompt = settings.chatbotSystemPrompt;
        if (typeof customPrompt === "string" && customPrompt.trim()) {
          systemPrompt = customPrompt.trim();
        }
        const customMemory = settings.chatbotMemoryMessages;
        if (typeof customMemory === "number" && Number.isFinite(customMemory)) {
          memoryCount = Math.max(1, Math.min(20, Math.round(customMemory)));
        } else if (typeof customMemory === "string" && customMemory.trim()) {
          const parsed = Number(customMemory.trim());
          if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
            memoryCount = Math.max(1, Math.min(20, Math.round(parsed)));
          }
        }
      }
    } catch {
      // Ignore config errors and keep defaults.
    }

    // Save user message first (so it appears immediately in the app stream).
    await messagesRef.add({
      role: "user",
      content: userMessage,
      createdAt: now,
    });

    // Load last N messages (excluding system).
    const historySnap = await messagesRef.orderBy("createdAt", "desc").limit(memoryCount).get();
    type ChatMessageDoc = { role?: string; content?: unknown };
    const history: ChatTurn[] = historySnap.docs
      .map((d) => d.data() as ChatMessageDoc)
      .reverse()
      .map((m) => {
        const role: "user" | "assistant" = m.role === "assistant" ? "assistant" : "user";
        const content = String(m.content ?? "").trim();
        return { role, content };
      })
      .filter((m) => m.content.length > 0);

    const assistantText = await openaiGenerate(systemPrompt, history);

    await messagesRef.add({
      role: "assistant",
      content: assistantText,
      createdAt: new Date(),
    });

    return NextResponse.json({ reply: assistantText });
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Chat failed" }, { status: 500 });
  }
}
