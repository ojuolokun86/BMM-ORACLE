const { getEmojiForCommand } = require('./emojiReaction');
const { formatResponse } = require('./utils');
const presenceTimers = {};

/**
 * Centralized function to send messages to a chat.
 */
const sendToChat = async (botInstance, chatId, options = {}) => {
    const { message, mentions = [], media, caption, mediaType, quotedMessage } = options;

    try {
        console.log(`🔍 Debugging "chatId":`, chatId);
        console.log(`🔍 Message:`, message);
        console.log(`🔍 Media:`, media);

        if (!botInstance || typeof botInstance.sendMessage !== 'function') {
            throw new TypeError('Invalid botInstance: sendMessage is not a function.');
        }

        if (!chatId || (!chatId.endsWith('@s.whatsapp.net') && !chatId.endsWith('@g.us'))) {
            throw new Error(`Invalid chatId: "${chatId}". Must end with "@s.whatsapp.net" or "@g.us".`);
        }

        if (!message && !media) {
            throw new Error('Either "message" or "media" must be provided.');
        }

        // 📷 Media message
        if (media) {
            const resolvedType = mediaType || 'image';
            if (!['image', 'video', 'audio', 'document', 'voice'].includes(resolvedType)) {
                throw new Error(`Invalid mediaType: ${resolvedType}`);
            }

            const mediaPayload = {
                [resolvedType]: media,
                caption: caption || '',
                mentions,
                ...(resolvedType === 'audio' || resolvedType === 'voice' ? { ptt: resolvedType === 'voice' } : {}),
                ...(quotedMessage ? { quoted: quotedMessage } : {})
            };
            console.log(`🔍 Sending ${resolvedType} to ${chatId} with caption:`, caption);
            await botInstance.assertSessions([chatId]);
            console.log(`🔍 Sending msg with session assert to ${chatId} with caption:`);

            await botInstance.sendMessage(chatId, mediaPayload);
            console.log(`✅ Sent ${resolvedType} to ${chatId} with caption: ${caption}`);
        }

        // 💬 Text message
        if (message && typeof message === 'string') {
            const formattedMessage = await formatResponse(botInstance, message);

            const textPayload = {
                text: formattedMessage,
                mentions,
                ...(quotedMessage ? { quoted: quotedMessage } : {})
            };

            await botInstance.sendMessage(chatId, textPayload);
            console.log(`✅ Sent message to ${chatId}: ${formattedMessage}`);
        }

    } catch (error) {
        console.error(`❌ Error sending message to ${chatId}:`, error);
    }
};

async function setDynamicPresence(botInstance, chatId, type = 'composing', cooldown = 5000) {
    // Clear any existing timer for this chat
    if (presenceTimers[chatId]) {
        clearTimeout(presenceTimers[chatId]);
    }
    // Set the requested presence
    await botInstance.sendPresenceUpdate(type, chatId);

    // Set a timer to reset to unavailable after cooldown
    presenceTimers[chatId] = setTimeout(async () => {
        try {
            await botInstance.sendPresenceUpdate('unavailable', chatId);
            // Optionally: delete the timer reference
            delete presenceTimers[chatId];
        } catch (err) {
            console.warn(`⚠️ Failed to reset presence for ${chatId}:`, err.message);
        }
    }, cooldown);
}

/**
 * Send a reaction to a specific message.
 */
const sendReaction = async (botInstance, chatId, messageId, command) => {
    try {
        const emoji = getEmojiForCommand(command);
        console.log(`🔍 Reaction emoji for "${command}": ${emoji}`);

        await botInstance.sendMessage(chatId, {
            react: {
                text: emoji,
                key: { id: messageId, remoteJid: chatId },
            },
        });
        console.log(`✅ Reaction "${emoji}" sent to ${chatId} (msg: ${messageId})`);
    } catch (error) {
        console.error(`❌ Failed to send reaction to ${chatId}:`, error);
    }
};

module.exports = { sendToChat, sendReaction, setDynamicPresence};
