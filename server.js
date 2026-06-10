const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// एंटी-बैन डिले (व्हाट्सएप को शक न हो इसलिए)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// व्हाट्सएप रोबोट का सेटअप (Render के लिए स्पेशल सेटिंग्स के साथ)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// 1. QR कोड जनरेट करना
client.on('qr', (qr) => {
    console.log('\n=========================================');
    console.log('👑 MEENA DYNASTY: WHATSAPP BOT QR 👑');
    console.log('=========================================');
    console.log('👇 अपने नए सिम वाले व्हाट्सएप से इसे स्कैन करें:\n');
    qrcode.generate(qr, { small: true });
});

// 2. बोट लाइव होने का कन्फर्मेशन
client.on('ready', () => {
    console.log('\n✅ सिस्टम लाइव है: Meena Dynasty Bot 100% तैयार है!');
});

client.on('auth_failure', msg => {
    console.error('\n❌ ऑथेंटिकेशन फेल:', msg);
});

// 3. सर्वर को जिंदा रखने के लिए पिंग (Ping) रूट
app.get('/ping', (req, res) => {
    res.status(200).send('Bot is awake and running!');
});

// 4. मुख्य API: सिक्योर व्हाट्सएप रूम बनाना
app.post('/api/create-secure-connection', async (req, res) => {
    const { userA_Phone, userB_Phone, matchId, userA_Name } = req.body;

    if (!userA_Phone || !userB_Phone || !matchId) {
        return res.status(400).json({ success: false, error: 'नंबर या Match ID मिसिंग हैं!' });
    }

    try {
        const participantA = `91${userA_Phone.trim()}@c.us`; 
        const participantB = `91${userB_Phone.trim()}@c.us`;
        const groupName = `Secure Match #${matchId}`;

        console.log(`\n⏳ [Match ${matchId}] के लिए सिक्योर रूम बनाया जा रहा है...`);

        // स्टेप A: ग्रुप क्रिएट करना
        const groupResponse = await client.createGroup(groupName, [participantA, participantB]);
        const groupId = groupResponse.gid._serialized;
        console.log(`✅ ग्रुप बन गया। Group ID: ${groupId}`);

        await sleep(2000);

        // स्टेप B: इन्वाइट लिंक निकालना
        const inviteCode = await client.getInviteCode(groupId);
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        
        await sleep(2000);

        // स्टेप C: वेलकम मैसेज भेजना
        const welcomeMessage = `👑 *Meena Dynasty Secure Connection*\n\nआपका प्राइवेट चैट रूम तैयार है। यहाँ आपकी प्राइवेसी 100% सेफ है। आप बेझिझक अपनी बातचीत शुरू कर सकते हैं।`;
        await client.sendMessage(groupId, welcomeMessage);

        await sleep(3000);

        // स्टेप D: पर्सनल इनबॉक्स में बैकअप लिंक भेजना
        const alertMessage = `👑 *Meena Dynasty Alert:*\n\nआपको *${userA_Name ? userA_Name : 'एक यूजर'}* की तरफ से एक सिक्योर कनेक्शन रिक्वेस्ट मिली है।\n\nअपनी प्राइवेसी सुरक्षित रखते हुए बात शुरू करने के लिए नीचे दिए लिंक पर क्लिक करके अपना प्राइवेट रूम जॉइन करें:\n\n👉 ${inviteLink}`;

        await client.sendMessage(participantA, alertMessage);
        console.log(`📩 User A को लिंक भेज दिया गया।`);
        
        await sleep(3500); // स्पैम से बचने के लिए डिले
        
        await client.sendMessage(participantB, alertMessage);
        console.log(`📩 User B को लिंक भेज दिया गया।`);

        // वेबसाइट को रिस्पॉन्स भेजना
        return res.status(200).json({
            success: true,
            inviteLink: inviteLink
        });

    } catch (error) {
        console.error(`❌ [Match ${matchId}] प्रोसेस फेल हो गया:`, error);
        return res.status(500).json({ 
            success: false, 
            error: 'व्हाट्सएप सर्वर पर ग्रुप बनाने में दिक्कत आई।',
            details: error.message 
        });
    }
});

// बोट इंजन और API सर्वर स्टार्ट करना
client.initialize();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🌐 Meena Dynasty Core Engine चालू है: Port ${PORT}`);
});
