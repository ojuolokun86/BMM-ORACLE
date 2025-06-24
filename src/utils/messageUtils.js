const { getEmojiForCommand } = require('./emojiReaction');
const { formatResponse } = require('./utils');
const presenceTimers = {};

const sendToChat = require('./sendToChat');

async function setDynamicPresence(botInstance, chatId, type = 'composing', cooldown = 5000) {
    if (presenceTimers[chatId]) {
        clearTimeout(presenceTimers[chatId]);
    }
    await botInstance.sendPresenceUpdate(type, chatId);

    presenceTimers[chatId] = setTimeout(async () => {
        try {
            await botInstance.sendPresenceUpdate('unavailable', chatId);
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
        await botInstance.sendMessage(chatId, {
            react: {
                text: emoji,
                key: { id: messageId, remoteJid: chatId },
            },
        });
    } catch (error) {
        console.error(`❌ Failed to send reaction to ${chatId}:`, error);
    }
};

module.exports = { sendToChat, sendReaction, setDynamicPresence };
