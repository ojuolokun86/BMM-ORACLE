const { botInstances, restartQueue, intentionalRestarts } = require('../utils/globalStore');
const { updateUserMetrics } = require('../database/models/metrics');

/**
 * Restart the user's bot instance.
 * @param {string} userId - The user's phone number.
 * @param {string} remoteJid - The chat ID where the restart command was used.
 * @param {string} authId - The user's authentication ID.
 */
const restartUserBot = async (userId, remoteJid, authId,) => {
    const startTime = Date.now();

    try {
        console.log(`🔄 Restarting bot for user: ${userId}, authId: ${authId}`);

        const botInstance = botInstances[userId];

        // Add the remoteJid to the restart queue
        restartQueue[userId] = remoteJid;
        const phoneNumber = userId;
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

module.exports = { restartUserBot, restartQueue };
