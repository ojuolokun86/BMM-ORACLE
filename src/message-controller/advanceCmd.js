const { sendToChat } = require('../utils/messageUtils');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const handleAdvanceCommand = async (sock, message, command, args, userId, remoteJid, botInstance) => {
    try {
        switch (command) {
            case 'upload': {
                // 1. If replying to an image
                const quotedImage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
                const userText = args.join(' ');

                if (quotedImage) {
                    const stream = await downloadMediaMessage({
                        message: { imageMessage: quotedImage }
                    });
                    let imageBuffer = Buffer.from([]);
                    for await (const chunk of stream) imageBuffer = Buffer.concat([imageBuffer, chunk]);
                    // Prefer image caption, else user text, else empty
                    const caption = quotedImage.caption || userText || '';
                    await sock.sendMessage('status@broadcast', {
                        image: imageBuffer,
                        caption: caption
                    });
                    await sendToChat(botInstance, remoteJid, {
                        message: '✅ Image uploaded to your status!',
                        quotedMessage: message
                    });
                    return true;
                }

                // 2. If sending an image directly
                if (message.message?.imageMessage) {
                    const stream = await downloadMediaMessage(message);
                    let imageBuffer = Buffer.from([]);
                    for await (const chunk of stream) imageBuffer = Buffer.concat([imageBuffer, chunk]);
                    // Prefer image caption, else user text, else empty
                    const caption = message.message.imageMessage.caption || userText || '';
                    await sock.sendMessage('status@broadcast', {
                        image: imageBuffer,
                        caption: caption
                    });
                    await sendToChat(botInstance, remoteJid, {
                        message: '✅ Image uploaded to your status!',
                        quotedMessage: message
                    });
                    return true;
                }

                // 3. If only text is provided (no image)
                if (userText) {
                    await sock.sendMessage('status@broadcast', {
                        text: userText
                    });
                    await sendToChat(botInstance, remoteJid, {
                        message: '✅ Text uploaded to your status!',
                        quotedMessage: message
                    });
                    return true;
                }

                // 4. If neither image nor text
                await sendToChat(botInstance, remoteJid, {
                    message: '❌ Reply to an image or provide text to upload to your status.',
                    quotedMessage: message
                });
                return true;
            }
            default:
                return false;
        }
    } catch (error) {
        console.error('❌ Error handling advance command:', error);
        await sendToChat(botInstance, remoteJid, {
            message: '❌ Failed to upload to status.',
            quotedMessage: message
        });
        return true;
    }
};

module.exports = { handleAdvanceCommand };