const { botInstances, restartQueue, intentionalRestarts } = require('../utils/globalStore');
const { updateUserMetrics } = require('../database/models/metrics');

const sendToChat = require('../utils/sendToChat');


const sendRestartMessage = async (sock, phoneNumber, reason = 'generic') => {
   let msg;
    switch (reason) {
        case 'new_user':
            msg = `🎉 *Welcome!*\n\nYour bot is now registered and ready to use. Enjoy all features!`;
            break;
        case 'owner_restart':
            msg = `🔄 *Bot Restarted by Owner*\n\nYour session has been refreshed manually by the owner.`;
            break;
        case 'session_error':
            msg = `⚠️ *Session Error*\n\nYour session was restarted due to a system issue. Everything is stable now.`;
            break;
        default:
            msg = `🔁 *Bot Restarted*\n\nYour bot session has been restarted and is running normally.`;
    }
    let targetJid = phoneNumber;
    if (!targetJid.endsWith('@s.whatsapp.net')) {
        targetJid = `${targetJid.replace(/\D/g, '')}@s.whatsapp.net`;
    }
    try {
        await sendToChat(sock, targetJid, { message: msg });
        console.log(`📩 Sent restart message to user: ${phoneNumber}`);
    } catch (err) {
        console.error(`❌ Failed to send restart message to user: ${phoneNumber}`, err);
    }
};

/**
 * Restart the user's bot instance.
 * @param {string} userId - The user's phone number.
 * @param {string} remoteJid - The chat ID where the restart command was used.
 * @param {string} authId - The user's authentication ID.
 * @param {string} reason - Reason for restart (new_user, owner_restart, session_error, etc.)
 */
const restartUserBot = async (userId, remoteJid, authId, reason = 'generic') => {
    const phoneNumber = userId;
    const startTime = Date.now();

    try {
        console.log(`🔄 Restarting bot for user: ${userId}, authId: ${authId}`);

        const botInstance = botInstances[userId];

        // Add the remoteJid to the restart queue
        restartQueue[userId] = { remoteJid, reason };
        console.log(`📋 Added ${phoneNumber} to restart queue with remoteJid: ${remoteJid}`);
        // Mark this user for intentional restart to prevent reconnection during shutdown
        intentionalRestarts.add(phoneNumber);

        // Close the user's WebSocket connection and wait for it to close
        if (botInstance && botInstance.sock && botInstance.sock.ws) {
            console.log(`❌ Closing connection for user: ${phoneNumber}`);
            botInstance.disconnectReason = 'intentional';

            await new Promise((resolve) => {
                botInstance.sock.ws.on('close', resolve);
                botInstance.sock.ws.close();
            });

            delete botInstances[userId];
        } else {
            if (botInstance && !botInstance.sock) {
                console.warn(`⚠️ Bot instance for user ${userId} exists but has no .sock property. Deleting stale instance.`);
            } else if (botInstance && botInstance.sock && !botInstance.sock.ws) {
                console.warn(`⚠️ Bot instance for user ${userId} has .sock but no .ws property. Deleting stale instance.`);
            } else {
                console.warn(`⚠️ No active WebSocket to close for user: ${userId}`);
            }
            if (botInstance) delete botInstances[userId];
        }

        // Wait a short moment to ensure cleanup (optional, but helps)
        await new Promise(res => setTimeout(res, 500));
        console.log(`✅ Connection closed for user: ${userId}`);

        // Start a new session
        const { startNewSession } = require('../users/userSession');
        console.log(`🔄 Starting a new session for user: ${phoneNumber}, authId: ${authId}`);
        await startNewSession(phoneNumber, null, authId, undefined);

        const endTime = Date.now();
        const timeTaken = endTime - startTime;

        console.log(`✅ Bot restarted successfully for user: ${phoneNumber} in ${timeTaken}ms.`);
        return true;

    } catch (error) {
        console.error(`❌ Failed to restart bot for user: ${phoneNumber}`, error);
        return false;
    }
};

module.exports = { restartUserBot, restartQueue, sendRestartMessage };
