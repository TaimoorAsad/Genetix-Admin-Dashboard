import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  BufferJSON,
  initAuthCreds,
  proto,
  AuthenticationState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { getFirestore } from "@/lib/firebase-admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny: any = global;

if (!globalAny.waState) {
  globalAny.waState = {
    sock: null,
    qrCode: undefined,
    status: "disconnected",
    errorMsg: undefined,
    listenerUnsubscribe: null,
    processingUsers: new Set<string>(),
    isStarting: false,
    savedUser: undefined as { name?: string; id?: string } | undefined,
  };
}

const sanitizeKey = (id: string) => id.replace(/\//g, "__").replace(/:/g, "-");

export const getSavedWhatsAppUser = async (): Promise<{ name?: string; id?: string } | null> => {
  try {
    const db = getFirestore();
    const markerDoc = await db.collection("whatsappAuth").doc("sessionMarker").get();
    if (markerDoc.exists && markerDoc.data()?.hasSession && markerDoc.data()?.user) {
      return markerDoc.data()?.user;
    }
    const credsDoc = await db.collection("whatsappAuth").doc("creds").get();
    if (credsDoc.exists) {
      const dataStr = credsDoc.data()?.data;
      if (dataStr) {
        const parsed = JSON.parse(dataStr, BufferJSON.reviver);
        if (parsed?.me?.id) {
          return { name: parsed.me.name || "WhatsApp User", id: parsed.me.id };
        }
      }
    }
  } catch (e) {
    console.error("Error reading saved WhatsApp session user:", e);
  }
  return null;
};

export const hasSavedWhatsAppSession = async (): Promise<boolean> => {
  const user = await getSavedWhatsAppUser();
  return Boolean(user?.id);
};

export const getWhatsAppStatus = async () => {
  let user = globalAny.waState.sock?.user
    ? { name: globalAny.waState.sock.user.name, id: globalAny.waState.sock.user.id }
    : globalAny.waState.savedUser;

  if (!user) {
    const saved = await getSavedWhatsAppUser();
    if (saved) {
      user = saved;
      globalAny.waState.savedUser = saved;
    }
  }

  const hasSavedSession = Boolean(user?.id);

  return {
    status: globalAny.waState.status,
    qr: globalAny.waState.qrCode,
    user,
    hasSavedSession,
    error: globalAny.waState.errorMsg,
  };
};

const createFirestoreAuthState = async (
  collectionName: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writeData = async (data: any, id: string) => {
    try {
      const parsedData = JSON.stringify(data, BufferJSON.replacer);
      await getFirestore().collection(collectionName).doc(sanitizeKey(id)).set({ data: parsedData });
    } catch (e) {
      console.error(`Error saving auth data (${id}):`, e);
    }
  };

  const readData = async (id: string) => {
    try {
      const doc = await getFirestore().collection(collectionName).doc(sanitizeKey(id)).get();
      if (doc.exists) {
        const dataStr = doc.data()?.data;
        if (dataStr) {
          return JSON.parse(dataStr, BufferJSON.reviver);
        }
      }
    } catch (e) {
      console.error(`Error reading auth state (${id}):`, e);
    }
    return null;
  };

  const removeData = async (id: string) => {
    try {
      await getFirestore().collection(collectionName).doc(sanitizeKey(id)).delete();
    } catch (e) {
      console.error(`Error removing auth data (${id}):`, e);
    }
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: { [key: string]: any } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set: async (data: any) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(value, key));
              } else {
                tasks.push(removeData(key));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData(creds, "creds");
      if (creds.me?.id) {
        globalAny.waState.savedUser = { name: creds.me.name || "WhatsApp User", id: creds.me.id };
        try {
          await getFirestore().collection(collectionName).doc("sessionMarker").set({
            hasSession: true,
            user: { name: creds.me.name || "WhatsApp User", id: creds.me.id },
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Error updating sessionMarker in Firestore:", e);
        }
      }
    },
  };
};

export const processPendingWelcomeMessages = async () => {
  if (globalAny.waState.status !== "connected" || !globalAny.waState.sock) return;
  try {
    const db = getFirestore();
    const configDoc = await db.collection("appData").doc("whatsappConfig").get();
    const welcomeMessageTemplate = configDoc.data()?.welcomeMessage;
    if (!welcomeMessageTemplate) return;

    const snapshot = await db
      .collection("users")
      .where("welcomeMessageSent", "==", false)
      .limit(10)
      .get();

    for (const doc of snapshot.docs) {
      if (globalAny.waState.processingUsers.has(doc.id)) continue;
      globalAny.waState.processingUsers.add(doc.id);

      const data = doc.data();
      const rawPhone = data["Phone Number"] || data["phoneNumber"] || data["phone"];
      if (rawPhone) {
        const phone = String(rawPhone).replace(/[^0-9]/g, "");
        const name = data["Full Name"] || data["fullName"] || data["name"] || "there";
        const message = welcomeMessageTemplate.replace(/{name}/g, name);
        const jid = `${phone}@s.whatsapp.net`;

        try {
          const [result] = await globalAny.waState.sock.onWhatsApp(jid);
          if (result?.exists) {
            await globalAny.waState.sock.sendMessage(jid, { text: message });
          }
          await doc.ref.update({ welcomeMessageSent: true });
        } catch (error) {
          console.error(`Failed to send welcome message to ${phone}:`, error);
          globalAny.waState.processingUsers.delete(doc.id);
        }
      } else {
        await doc.ref.update({ welcomeMessageSent: true });
      }
    }
  } catch (e) {
    console.error("Error processing pending welcome messages:", e);
  }
};

const startWelcomeMessageListener = () => {
  if (globalAny.waState.listenerUnsubscribe) return;

  globalAny.waState.listenerUnsubscribe = getFirestore()
    .collection("users")
    .where("welcomeMessageSent", "==", false)
    .onSnapshot(async () => {
      await processPendingWelcomeMessages();
    });
};

export const clearWhatsAppAuth = async () => {
  try {
    const db = getFirestore();
    const collectionRef = db.collection("whatsappAuth");
    let total = 0;
    while (true) {
      const snapshot = await collectionRef.limit(400).get();
      if (snapshot.empty) break;
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      total += snapshot.size;
    }
    if (total > 0) {
      console.log(`Cleared ${total} auth documents from whatsappAuth collection.`);
    }
  } catch (e) {
    console.error("Error clearing whatsappAuth collection:", e);
  }
};

export const stopWhatsApp = async () => {
  if (globalAny.waState.sock) {
    try {
      globalAny.waState.sock.ev.removeAllListeners("connection.update");
      globalAny.waState.sock.ev.removeAllListeners("creds.update");
      globalAny.waState.sock.end(undefined);
    } catch (e) {
      console.error("Error ending WhatsApp socket:", e);
    }
    globalAny.waState.sock = null;
  }
  if (globalAny.waState.listenerUnsubscribe) {
    try {
      globalAny.waState.listenerUnsubscribe();
    } catch {}
    globalAny.waState.listenerUnsubscribe = null;
  }
  globalAny.waState.status = "disconnected";
};

export const startWhatsApp = async () => {
  if (globalAny.waState.isStarting || globalAny.waState.status === "connected") return;
  globalAny.waState.isStarting = true;

  globalAny.waState.status = "connecting";
  globalAny.waState.qrCode = undefined;
  globalAny.waState.errorMsg = undefined;

  try {
    const { state, saveCreds } = await createFirestoreAuthState("whatsappAuth");
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join(".")}, isLatest: ${isLatest}`);

    if (state.creds?.me?.id) {
      globalAny.waState.savedUser = {
        name: state.creds.me.name || "WhatsApp User",
        id: state.creds.me.id,
      };
    }

    // Clean up any lingering socket before creating a new one
    if (globalAny.waState.sock) {
      try {
        globalAny.waState.sock.ev.removeAllListeners("connection.update");
        globalAny.waState.sock.ev.removeAllListeners("creds.update");
        globalAny.waState.sock.end(undefined);
      } catch {}
      globalAny.waState.sock = null;
    }

    globalAny.waState.sock = makeWASocket({
      version,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: pino({ level: "silent" }) as any,
      printQRInTerminal: false,
      auth: state,
      browser: ["Genetix Admin", "Chrome", "1.0.0"],
    });

    globalAny.waState.sock.ev.on("creds.update", async () => {
      await saveCreds();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalAny.waState.sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("WhatsApp QR received");
        globalAny.waState.qrCode = qr;
        globalAny.waState.status = "qr";
        globalAny.waState.errorMsg = undefined;
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        console.log("WhatsApp connection closed with status code:", statusCode, "error:", lastDisconnect?.error);

        globalAny.waState.sock = null;
        if (globalAny.waState.listenerUnsubscribe) {
          try {
            globalAny.waState.listenerUnsubscribe();
          } catch {}
          globalAny.waState.listenerUnsubscribe = null;
        }

        // CRITICAL: ONLY clear auth if specifically logged out by WhatsApp server (401)
        // DO NOT delete credentials on temporary network timeouts, Vercel idle, or 500 errors!
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        if (isLoggedOut) {
          console.log("WhatsApp session was logged out by server/device. Clearing stored auth state...");
          globalAny.waState.savedUser = undefined;
          await clearWhatsAppAuth();
          globalAny.waState.status = "connecting";
          globalAny.waState.qrCode = undefined;
          globalAny.waState.errorMsg = undefined;

          setTimeout(() => {
            startWhatsApp();
          }, 1500);
          return;
        }

        if (statusCode === 440) {
          globalAny.waState.status = "error";
          globalAny.waState.errorMsg = "Connection replaced by another session. Please restart connection.";
          return;
        }

        // Keep credentials intact in Firebase so subsequent requests auto-connect seamlessly
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440;
        if (shouldReconnect) {
          globalAny.waState.status = "connecting";
          setTimeout(() => {
            startWhatsApp();
          }, 3000);
        } else {
          globalAny.waState.status = "error";
          globalAny.waState.errorMsg = "Disconnected from WhatsApp.";
        }
      } else if (connection === "open") {
        console.log("WhatsApp connection opened successfully");
        globalAny.waState.status = "connected";
        globalAny.waState.qrCode = undefined;
        globalAny.waState.errorMsg = undefined;
        if (globalAny.waState.sock?.user) {
          globalAny.waState.savedUser = {
            name: globalAny.waState.sock.user.name,
            id: globalAny.waState.sock.user.id,
          };
        }
        await saveCreds();
        startWelcomeMessageListener();
        await processPendingWelcomeMessages();
      }
    });
  } catch (error: unknown) {
    console.error("Error starting WhatsApp:", error);
    globalAny.waState.status = "error";
    globalAny.waState.errorMsg = error instanceof Error ? error.message : "Unknown error";
    globalAny.waState.sock = null;
    if (globalAny.waState.listenerUnsubscribe) {
      try {
        globalAny.waState.listenerUnsubscribe();
      } catch {}
      globalAny.waState.listenerUnsubscribe = null;
    }
  } finally {
    globalAny.waState.isStarting = false;
  }
};

/**
 * Ensures WhatsApp is connected using saved Firebase credentials before proceeding.
 * Ideal for serverless platforms like Vercel where instances freeze or idle.
 */
export const ensureWhatsAppConnected = async (timeoutMs = 6000): Promise<boolean> => {
  if (globalAny.waState.status === "connected" && globalAny.waState.sock) {
    return true;
  }

  if (globalAny.waState.status !== "connecting") {
    startWhatsApp();
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (globalAny.waState.status === "connected" && globalAny.waState.sock) {
      return true;
    }
    // If it reached QR state, credentials don't exist yet so we cannot auto-connect
    if (globalAny.waState.status === "qr" || globalAny.waState.status === "error") {
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  return globalAny.waState.status === "connected";
};

export const restartWhatsApp = async (forceResetAuth = false) => {
  const isLoggedOutError =
    globalAny.waState.errorMsg?.toLowerCase().includes("logged out") ||
    globalAny.waState.errorMsg?.toLowerCase().includes("session");

  await stopWhatsApp();

  if (forceResetAuth || isLoggedOutError) {
    console.log("Restarting WhatsApp with fresh auth state...");
    globalAny.waState.savedUser = undefined;
    await clearWhatsAppAuth();
  }

  globalAny.waState.status = "disconnected";
  globalAny.waState.errorMsg = undefined;
  globalAny.waState.qrCode = undefined;

  await startWhatsApp();
};

export const logoutWhatsApp = async () => {
  if (globalAny.waState.sock) {
    try {
      await globalAny.waState.sock.logout();
    } catch (e) {
      console.error("Error logging out WhatsApp socket:", e);
    }
    try {
      globalAny.waState.sock.end(undefined);
    } catch {}
    globalAny.waState.sock = null;
  }
  if (globalAny.waState.listenerUnsubscribe) {
    try {
      globalAny.waState.listenerUnsubscribe();
    } catch {}
    globalAny.waState.listenerUnsubscribe = null;
  }
  globalAny.waState.status = "disconnected";
  globalAny.waState.qrCode = undefined;
  globalAny.waState.errorMsg = undefined;
  globalAny.waState.savedUser = undefined;

  await clearWhatsAppAuth();
};

export const getWASocket = async () => {
  // Automatically connect with saved Firebase credentials when a signal/action is triggered
  const connected = await ensureWhatsAppConnected(12000);
  if (!connected || !globalAny.waState.sock) {
    throw new Error(
      `WhatsApp is not connected (status: ${globalAny.waState.status}). Please link your device via the WhatsApp dashboard tab.`
    );
  }

  return globalAny.waState.sock;
};
