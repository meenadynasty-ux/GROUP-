const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');

// सर्वर इनिशियलाइज़ेशन
const app = express();
app.use(cors());
app.use(express.json());

// एंटी-बैन सिस्टम: रोबोट को इंसानों की तरह काम कराने के लिए डिले (Delay) फंक्शन
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// व्हाट्सएप रोबोट का इंजन सेट करना
const client = new Client({
    authStrategy: new LocalAuth(), // बार-बार QR स्कैन न करना पड़े, इसके लिए
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

// टर्मिनल में QR कोड दिखाना
client.on('qr', (qr) => {
    console.log('\n================================================');
    console.log('👑 MEENA DYNASTY: WHATSAPP BOT QR CODE 👑');
    console.log('================================================');
    console.log('👇 अपने नए बोट सिम वाले व्हाट्सएप से इसे स्कैन करें:\n');
    qrcode.generate(qr, { small: true });
});

// बोट के चालू होने का कन्फर्मेशन
client.on('ready', () => {
    console.log('\n✅ सिस्टम लाइव है: आपका व्हाट्सएप रोबोट 100% तैयार है!');
});

client.on('auth_failure', msg => {
    console.error('\n❌ ऑथेंटिकेशन फेल हो गया, QR दोबारा स्कैन करें:', msg);
});

// ==========================================
// 🚀 मुख्य API: सिक्योर कनेक्शन बनाने का लॉजिक
// ==========================================
app.post('/api/create-secure-connection', async (req, res) => {
    const { userA_Phone, userB_Phone, matchId, userA_Name } = req.body;

    // वैलिडेशन: चेक करें कि सारा डेटा मिला है या नहीं
    if (!userA_Phone || !userB_Phone || !matchId) {
        return res.status(400).json({ success: false, error: 'नंबर या Match ID मिसिंग है!' });
    }

    try {
        const participantA = `91${userA_Phone.trim()}@c.us`; 
        const participantB = `91${userB_Phone.trim()}@c.us`;
        const groupName = `Secure Match #${matchId}`;

        console.log(`\n⏳ [Match ${matchId}] के लिए सिक्योर रूम प्रोसेस शुरू...`);

        // 1. ग्रुप क्रिएट करना और दोनों को जोड़ना
        const groupResponse = await client.createGroup(groupName, [participantA, participantB]);
        const groupId = groupResponse.gid._serialized;
        console.log(`✅ व्हाट्सएप ग्रुप बन गया। Group ID: ${groupId}`);

        await sleep(2000); // 2 सेकंड का डिले

        // 2. बैकअप के लिए ग्रुप का सिक्योर इन्वाइट लिंक जनरेट करना
        const inviteCode = await client.getInviteCode(groupId);
        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        
        await sleep(2000);

        // 3. ग्रुप के अंदर वेलकम मैसेज भेजना
        const welcomeMessage = `👑 *Meena Dynasty Secure Connection*\n\nआपका प्राइवेट चैट रूम तैयार है। यहाँ आपकी प्राइवेसी 100% सेफ है। आप बेझिझक अपनी बातचीत शुरू कर सकते हैं।`;
        await client.sendMessage(groupId, welcomeMessage);

        await sleep(3000);

        // 4. दोनों को पर्सनल इनबॉक्स में इन्वाइट लिंक भेजना (ताकि अगर ग्रुप न दिखे तो लिंक से जॉइन कर लें)
        const alertMessage = `👑 *Meena Dynasty Alert:*\n\nआपको ${userA_Name ? userA_Name : 'एक यूजर'} की तरफ से एक सिक्योर कनेक्शन रिक्वेस्ट मिली है।\n\nअपनी प्राइवेसी सुरक्षित रखते हुए बात शुरू करने के लिए नीचे दिए लिंक पर क्लिक करके अपना प्राइवेट रूम जॉइन करें:\n\n👉 ${inviteLink}`;

        await client.sendMessage(participantA, alertMessage);
        console.log(`📩 User A (${userA_Phone}) को इन्वाइट भेज दिया गया।`);
        
        await sleep(3000); // स्पैम से बचने के लिए डिले
        
        await client.sendMessage(participantB, alertMessage);
        console.log(`📩 User B (${userB_Phone}) को इन्वाइट भेज दिया गया।`);

        // 5. फ्रंटएंड (InfinityFree) को सक्सेस रिस्पॉन्स वापस भेजना
        return res.status(200).json({
            success: true,
            message: 'सिक्योर रूम सफलतापूर्वक बन गया है।',
            inviteLink: inviteLink
        });

    } catch (error) {
        console.error(`❌ [Match ${matchId}] प्रोसेस फेल हो गया:`, error);
        return res.status(500).json({ 
            success: false, 
            error: 'व्हाट्सएप सर्वर पर ग्रुप बनाने में तकनीकी समस्या आई।',
            details: error.message 
        });
    }
});

// सर्वर स्टार्ट करना
client.initialize();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🌐 Meena Dynasty Backend API चालू है: Port ${PORT}`);
});
