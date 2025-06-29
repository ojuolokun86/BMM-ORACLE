const { formatResponse } = require('./utils');
const { healAndRestartBot } = require('./sessionFixer');
const { getUserCached } = require('../database/userDatabase');
const { getUrlInfo } = require('@whiskeysockets/baileys'); // Make sure you have latest Baileys version
const fs = require('fs');
const path = require('path');


const imagePath = path.join(__dirname, '../assets/BMM.jpg'); // Adjust path as needed
let imageBuffer = null;
if (fs.existsSync(imagePath)) {
    imageBuffer = fs.readFileSync(imagePath);
}



const sendToChat = async (botInstance, chatId, options = {}) => {
    const { message, mentions = [], media, caption, mediaType, quotedMessage } = options;

    const quoted = {
  key: {
    remoteJid: '0@s.whatsapp.net',
    fromMe: false,
    id: 'BAE5F7A9BE3DFA85', // can be any random 16-char hex string
    participant: '0@s.whatsapp.net',
  },
  message: {
    conversation: 'Your WhatsApp is linked to a device using WhatsApp Web. Tap to learn more.'
  }
};


    try {
        if (!botInstance?.sendMessage) throw new TypeError('Invalid botInstance');
        if (!chatId?.endsWith('@s.whatsapp.net') && !chatId?.endsWith('@g.us')) throw new Error(`Invalid chatId: "${chatId}"`);
        if (!message && !media) throw new Error('Either "message" or "media" must be provided.');

        const hasMentions = mentions.length > 0;

        let payload;
        if (media) {
            const resolvedType = mediaType || 'image';
            if (!['image', 'video', 'audio', 'document', 'voice'].includes(resolvedType)) {
                throw new Error(`Invalid mediaType: ${resolvedType}`);
            }

            payload = {
                [resolvedType]: media,
                caption: caption || '',
                mentions,
                ...(resolvedType === 'audio' || resolvedType === 'voice' ? { ptt: resolvedType === 'voice' } : {}),
            };
        } else if (typeof message === 'string') {
            const formattedMessage = await formatResponse(botInstance, message);
            

            // This will send the preview without displaying the actual URL in the text
            payload = {
                text: formattedMessage,
                mentions,
            };
        }

        // Attach contextInfo (optional)
        if (!hasMentions) {
           payload.contextInfo = {
            forwardingScore: 999,
            isForwarded: true,

            // 👇 Newsletter forwarding style
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363403127154832@newsletter', // your real channel JID
                newsletterName: '🤖BMM-BOT🤖',
                serverMessageId: -1
            },

            // 👇 Verified-style rich preview
            externalAdReply: {
                title: '🤖 BMM WhatsApp Bot',
                body: 'Powering smart automation.',
                mediaType: 1,
                showAdAttribution: true,
                renderLargerThumbnail: true,
                thumbnailUrl: 'https://files.catbox.moe/ow2buv.jpg',
                thumbnail: imageBuffer // optional but improves consistency
            }
            }

        }

        await botInstance.sendMessage(chatId, payload, { quoted });
        console.log(`✅ Message sent to ${chatId}:`, message || 'Media sent');
    } catch (error) {
        console.error(`❌ Error sending message to ${chatId}:`, error);
        if (error?.message?.includes('No open session')) {
            const userId = chatId.replace('@s.whatsapp.net', '');
            try {
                const user = await getUserCached(userId);
                const authId = user?.auth_id;
                if (authId) await healAndRestartBot(userId, authId);
            } catch (e) {
                console.error(`❌ Failed to auto-heal session for ${chatId}:`, e.message);
            }
        }
    }
};

module.exports = sendToChat;