import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, BufferJSON, initAuthCreds, proto, AuthenticationState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalAny: any = global;

if (!globalAny.waState) {
  globalAny.waState = {
    sock: null,
    qrCode: undefined,
    status: "disconnected",
    errorMsg: undefined,
    listenerUnsubscribe: null,
    processingUsers: new Set<string>()
  };
}

export const getWhatsAppStatus = () => {
  return {
    status: globalAny.waState.status,
    qr: globalAny.waState.qrCode,
    user: globalAny.waState.sock?.user ? { name: globalAny.waState.sock.user.name, id: globalAny.waState.sock.user.id } : undefined,
    error: globalAny.waState.errorMsg,
  };
};

import { getFirestore } from "@/lib/firebase-admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createFirestoreAuthState = async (collectionName: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writeData = async (data: any, id: string) => {
    const parsedData = JSON.stringify(data, BufferJSON.replacer);
    await getFirestore().collection(collectionName).doc(id).set({ data: parsedData });
  };

  const readData = async (id: string) => {
    try {
      const doc = await getFirestore().collection(collectionName).doc(id).get();
      if (doc.exists) {
        const dataStr = doc.data()?.data;
        if (dataStr) {
          return JSON.parse(dataStr, BufferJSON.reviver);
        }
      }
    } catch (e) {
      console.error("Error reading auth state:", e);
    }
    return null;
  };

  const removeData = async (id: string) => {
    try {
      await getFirestore().collection(collectionName).doc(id).delete();
    } catch {}
  };

  const creds = await readData('creds') || initAuthCreds();

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
              if (type === 'app-state-sync-key' && value) {
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
        }
      }
    },
    saveCreds: () => writeData(creds, 'creds')
  };
};

const startWelcomeMessageListener = () => {
  if (globalAny.waState.listenerUnsubscribe) return;

  globalAny.waState.listenerUnsubscribe = getFirestore().collection("users")
    .where("welcomeMessageSent", "==", false)
    .onSnapshot(async (snapshot) => {
      if (globalAny.waState.status !== "connected" || !globalAny.waState.sock) return;

      const configDoc = await getFirestore().collection("appData").doc("whatsappConfig").get();
      const welcomeMessageTemplate = configDoc.data()?.welcomeMessage;

      if (!welcomeMessageTemplate) return;

      for (const doc of snapshot.docs) {
        if (globalAny.waState.processingUsers.has(doc.id)) continue;
        globalAny.waState.processingUsers.add(doc.id);

        const data = doc.data();
        if (data["Phone Number"]) {
          const phone = data["Phone Number"].replace(/[^0-9]/g, "");
          const name = data["Full Name"] || "there";
          const message = welcomeMessageTemplate.replace(/{name}/g, name);
          const jid = `${phone}@s.whatsapp.net`;

          try {
            const [result] = await globalAny.waState.sock.onWhatsApp(jid);
            if (result?.exists) {
              await globalAny.waState.sock.sendMessage(jid, { text: message });
            }
            // Mark as sent regardless to avoid infinite loops if it fails
            await doc.ref.update({ welcomeMessageSent: true });
            await new Promise(r => setTimeout(r, 1000)); // Rate limit
          } catch (error) {
            console.error(`Failed to send welcome message to ${phone}`, error);
            globalAny.waState.processingUsers.delete(doc.id); // allow retry if it failed
          }
        } else {
          // No phone number, skip
          await doc.ref.update({ welcomeMessageSent: true });
        }
      }
    });
};

export const startWhatsApp = async () => {
  if (globalAny.waState.status === "connecting" || globalAny.waState.status === "connected") return;
  
  globalAny.waState.status = "connecting";
  globalAny.waState.qrCode = undefined;
  globalAny.waState.errorMsg = undefined;

  try {
    const { state, saveCreds } = await createFirestoreAuthState("whatsappAuth");
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    globalAny.waState.sock = makeWASocket({
      version,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: pino({ level: 'silent' }) as any,
      printQRInTerminal: false,
      auth: state,
      browser: ['Genetix Admin', 'Chrome', '1.0.0'],
    });

    globalAny.waState.sock.ev.on('creds.update', saveCreds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalAny.waState.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        globalAny.waState.qrCode = qr;
        globalAny.waState.status = "qr";
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        // Do not reconnect if logged out, or if the connection was replaced (conflict 440)
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 440;
        console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
        
        globalAny.waState.status = "disconnected";
        globalAny.waState.sock = null;
        if (globalAny.waState.listenerUnsubscribe) {
          globalAny.waState.listenerUnsubscribe();
          globalAny.waState.listenerUnsubscribe = null;
        }
        
        if (shouldReconnect) {
          setTimeout(startWhatsApp, 3000); // attempt to reconnect
        } else {
          if (statusCode === DisconnectReason.loggedOut) {
            globalAny.waState.errorMsg = "Logged out. Please restart the connection and scan the QR code again.";
          } else if (statusCode === 440) {
            globalAny.waState.errorMsg = "Connection replaced by another session. Please restart connection.";
          } else {
            globalAny.waState.errorMsg = "Disconnected.";
          }
          globalAny.waState.status = "error";
        }
      } else if (connection === 'open') {
        console.log('opened connection');
        globalAny.waState.status = "connected";
        globalAny.waState.qrCode = undefined;
        globalAny.waState.errorMsg = undefined;
        startWelcomeMessageListener();
      }
    });

  } catch (error: unknown) {
    console.error("Error starting WhatsApp:", error);
    globalAny.waState.status = "error";
    globalAny.waState.errorMsg = error?.message || "Unknown error";
    globalAny.waState.sock = null;
    if (globalAny.waState.listenerUnsubscribe) {
      globalAny.waState.listenerUnsubscribe();
      globalAny.waState.listenerUnsubscribe = null;
    }
  }
};

export const logoutWhatsApp = async () => {
  if (globalAny.waState.sock) {
    await globalAny.waState.sock.logout();
    globalAny.waState.sock = null;
  }
  globalAny.waState.status = "disconnected";
  globalAny.waState.qrCode = undefined;
  globalAny.waState.errorMsg = undefined;
  
  // Clear the auth state from Firestore
  try {
    const db = getFirestore();
    const docs = await db.collection("whatsappAuth").get();
    const batch = db.batch();
    docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (e) {
    console.error("Error clearing whatsappAuth collection:", e);
  }
};

export const getWASocket = async () => {
  if (!globalAny.waState.sock && globalAny.waState.status !== "connecting") {
    await startWhatsApp();
  }
  
  // Wait until connected or error
  let retries = 0;
  while (globalAny.waState.status === "connecting" && retries < 20) {
    await new Promise(r => setTimeout(r, 500));
    retries++;
  }
  
  if (globalAny.waState.status !== "connected" || !globalAny.waState.sock) {
    throw new Error(`WhatsApp is not connected. Current status: ${globalAny.waState.status}`);
  }
  
  return globalAny.waState.sock;
};
if (!globalAny.waInitialized) {
  globalAny.waInitialized = true;
  // We can choose to start it immediately or lazily
  // startWhatsApp();
}
