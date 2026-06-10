import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import express from 'express';
import cors from 'cors';
import { Boom } from '@hapi/boom';

// ==========================================
// 1. GLOBAL STATE & LOGGING (डैशबोर्ड के लिए)
// ==========================================
let dashboardLogs = [];
let latestOTP = "⏳ OTP जनरेट हो रहा है... कृपया रुकें।";
let isConnected = false;
let globalSock = null;

function addLog(msg) {
    const time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    const formattedMsg = `[${time}] ${msg}`;
    console.log(formattedMsg);
    dashboardLogs.push(formattedMsg);
    if (dashboardLogs.length > 50) dashboardLogs.shift();
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 2. WHATSAPP ENGINE (Baileys OTP Login)
// ==========================================
async function startBot() {
    addLog("⚙️ व्हाट्सएप इंजन (Baileys) चालू हो रहा है...");
    const { state, saveCreds } = await useMultiFileAuthState('./baileys_auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // QR कोड बंद कर दिया
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false
    });

    globalSock = sock;
    sock.ev.on('creds.update', saveCreds);

    // 🔴 यहाँ अपने बोट वाले सिम का 12 अंकों का नंबर (91 के साथ) डालें 🔴
    const BOT_PHONE_NUMBER = "917665561627"; 

    if (!sock.authState.creds.registered) {
        addLog("🔑 पेयरिंग कोड (OTP) जनरेट किया जा रहा है...");
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(BOT_PHONE_NUMBER);
                latestOTP = code;
                addLog(`✅ आपका लॉगिन कोड: [ ${code} ]`);
            } catch (err) {
                addLog(`❌ पेयरिंग एरर: ${err.message}`);
                latestOTP = "❌ एरर (सर्वर रीस्टार्ट करें)";
            }
        }, 5000);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            addLog(`⚠️ कनेक्शन टूटा। रीकनेक्ट: ${shouldReconnect}`);
            if (shouldReconnect) setTimeout(startBot, 5000);
        } else if (connection === 'open') {
            isConnected = true;
            latestOTP = "✅ कनेक्टेड और सुरक्षित!";
            addLog('👑 सिस्टम ऑनलाइन है! बोट तैयार है।');
        }
    });
}

// ==========================================
// 3. EXPRESS API & WEB DASHBOARD
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());

// 👉 डैशबोर्ड का डेटा भेजने के लिए
app.get('/api/data', (req, res) => {
    res.json({ isConnected, latestOTP, logs: dashboardLogs });
});

// 👉 वेबसाइट का मेन डैशबोर्ड (यहाँ आपको OTP दिखेगा)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Meena Dynasty - Secure Bot Dashboard</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { background: #000; color: #0f0; font-family: monospace; padding: 20px; text-align: center; }
                .box { border: 1px solid #0f0; padding: 20px; margin-bottom: 20px; border-radius: 10px; background: #050505;}
                .log-box { text-align: left; background: #111; padding: 15px; height: 350px; overflow-y: scroll; border: 1px solid #333; border-radius: 5px; }
                .log { font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid #222; padding-bottom: 4px;}
                .otp { color: yellow; font-size: 48px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; border: 2px dashed #555; display: inline-block; padding: 10px 20px; background: #222;}
                .status { font-size: 22px; margin-bottom: 10px; font-weight: bold;}
            </style>
        </head>
        <body>
            <div class="box">
                <h2>👑 Meena Dynasty: Secure Relay Bot</h2>
                <div id="status-container">⏳ Status लोड हो रहा है...</div>
            </div>
            <div class="box">
                <h3>📊 Live System Logs:</h3>
                <div class="log-box" id="logs-container">⏳ Logs loading...</div>
            </div>
            <script>
                async function fetchData() {
                    const res = await fetch('/api/data');
                    const data = await res.json();
                    
                    let statusHtml = '<p class="status">Status: ' + (data.isConnected ? '<span style="color:lime">🟢 ONLINE</span>' : '<span style="color:red">🔴 OFFLINE</span>') + '</p>';
                    if (!data.isConnected) {
                        statusHtml += '<p>व्हाट्सएप लॉगिन कोड:</p><div class="otp">' + data.latestOTP + '</div><p style="color:#aaa">अपने WhatsApp में जाएं -> Linked Devices -> Link with Phone Number में यह कोड डालें</p>';
                    } else {
                        statusHtml += '<p style="color:lime">✅ सिस्टम सफलतापूर्वक कनेक्टेड है</p>';
                    }
                    document.getElementById('status-container').innerHTML = statusHtml;

                    document.getElementById('logs-container').innerHTML = data.logs.slice().reverse().map(l => '<div class="log">' + l + '</div>').join('');
                }
                setInterval(fetchData, 3000);
                fetchData();
            </script>
        </body>
        </html>
    `);
});

// 👉 सिक्योर चैट रूम बनाने वाली API (जिससे InfinityFree वेबसाइट बात करेगी)
app.post('/api/create-secure-connection', async (req, res) => {
    if (!globalSock || !isConnected) {
        return res.status(500).json({ success: false, error: 'बोट अभी व्हाट्सएप से कनेक्ट नहीं है।' });
    }

    const { userA_Phone, userB_Phone, matchId, userA_Name } = req.body;
    if (!userA_Phone || !userB_Phone || !matchId) {
        return res.status(400).json({ success: false, error: 'डेटा अधूरा है!' });
    }

    try {
        // Baileys में नंबर का फॉर्मेट @s.whatsapp.net होता है
        const participantA = `91${userA_Phone.trim()}@s.whatsapp.net`;
        const participantB = `91${userB_Phone.trim()}@s.whatsapp.net`;
        const groupName = `Secure Match #${matchId}`;

        addLog(`⏳ [Match ${matchId}] के लिए सिक्योर रूम बनाया जा रहा है...`);

        // 1. ग्रुप क्रिएट करना
        const group = await globalSock.groupCreate(groupName, [participantA, participantB]);
        const groupId = group.id;
        addLog(`✅ व्हाट्सएप ग्रुप बन गया। ID: ${groupId}`);

        await sleep(2000);

        // 2. इन्वाइट लिंक निकालना
        const inviteCode = await globalSock.groupInviteCode(groupId);
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        
        await sleep(2000);

        // 3. वेलकम मैसेज भेजना
        await globalSock.sendMessage(groupId, { text: `👑 *Meena Dynasty Secure Connection*\n\nआपका प्राइवेट चैट रूम तैयार है। यहाँ आपकी प्राइवेसी 100% सुरक्षित है।` });

        await sleep(2000);

        // 4. पर्सनल इनबॉक्स में अलर्ट और लिंक भेजना
        const alertMsg = `👑 *Meena Dynasty Alert:*\n\nआपको *${userA_Name ? userA_Name : 'एक यूजर'}* की तरफ से एक सिक्योर कनेक्शन रिक्वेस्ट मिली है।\n\nअपनी प्राइवेसी सुरक्षित रखते हुए बात शुरू करने के लिए नीचे दिए लिंक पर क्लिक करके अपना प्राइवेट रूम जॉइन करें:\n\n👉 ${inviteLink}`;

        await globalSock.sendMessage(participantA, { text: alertMsg });
        addLog(`📩 User A (${userA_Phone}) को लिंक भेज दिया गया।`);
        
        await sleep(3000); // स्पैम बैन से बचने के लिए डिले
        
        await globalSock.sendMessage(participantB, { text: alertMsg });
        addLog(`📩 User B (${userB_Phone}) को लिंक भेज दिया गया।`);

        // 5. वेबसाइट को रिस्पॉन्स देना
        return res.status(200).json({ success: true, inviteLink: inviteLink });

    } catch (error) {
        addLog(`❌ [Match ${matchId}] एरर: ${error.message}`);
        return res.status(500).json({ success: false, error: 'व्हाट्सएप ग्रुप बनाने में दिक्कत आई।' });
    }
});

// ==========================================
// 4. SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    addLog(`🌐 Meena Dynasty Server लाइव है: Port ${PORT}`);
    startBot();
});
