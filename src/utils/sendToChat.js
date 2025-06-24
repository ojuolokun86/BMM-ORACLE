const { formatResponse } = require('./utils');

/**
 * Centralized function to send messages to a chat.
 * If mentions are present, sends as a normal message (so mentions work).
 * If no mentions, sends as a forwarded/newsletter message.
 * Supports text, media, mentions, and replying to a message.
 */
const sendToChat = async (botInstance, chatId, options = {}) => {
    const { message, mentions = [], media, caption, mediaType, quotedMessage } = options;

    // Prepare the quoted object (only key and message, as required by Baileys)
    let quoted = undefined;
    if (quotedMessage && quotedMessage.key) {
        quoted = {
            key: quotedMessage.key,
            ...(quotedMessage.message ? { message: quotedMessage.message } : {})
        };
    }

    try {
        if (!botInstance || typeof botInstance.sendMessage !== 'function') {
            throw new TypeError('Invalid botInstance: sendMessage is not a function.');
        }

        if (!chatId || (!chatId.endsWith('@s.whatsapp.net') && !chatId.endsWith('@g.us'))) {
            throw new Error(`Invalid chatId: "${chatId}". Must end with "@s.whatsapp.net" or "@g.us".`);
        }

        if (!message && !media) {
            throw new Error('Either "message" or "media" must be provided.');
        }

        // Check if mentions are present
        const hasMentions = mentions && mentions.length > 0;

        // Prepare the outgoing message payload
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
            if (!hasMentions) {
                payload.contextInfo = {
                    forwardingScore:999, 
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363403127154832@newsletter',
                        newsletterName: '🤖BMM-BOT🤖',
                        serverMessageId: -1
                    }
                };
            }
        } else if (message && typeof message === 'string') {
            const formattedMessage = await formatResponse(botInstance, message);
            payload = {
                text: formattedMessage,
                mentions,
            };
            if (!hasMentions) {
                payload.contextInfo = {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363403127154832@newsletter',
                        newsletterName: '🤖BMM-BOT🤖',
                        serverMessageId: -1
                    }
                };
            }
        } else {
            throw new Error('Either "message" or "media" must be provided.');
        }

        await botInstance.sendMessage(chatId, payload, quoted ? { quoted } : {});

    } catch (error) {
        console.error(`❌ Error sending message to ${chatId}:`, error);
    }
};

module.exports =  sendToChat;