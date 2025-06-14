const { normalizeUserId } = require('./normalizeUserId');
const { getGroupModeCached } = require('../bot/groupModeManager');
const { getGroupAdmins } = require('./groupData'); // Import the group data functions

/**
 * Check if the sender is the bot owner using both `lid` and `id`.
 * @param {string} sender - The sender's ID.
 * @param {object} sock - The WhatsApp socket instance (to fetch `lid` and `id`).
 * @returns {boolean} - Whether the sender is the bot owner.
 */
const isBotOwner = (sender, sock) => {
    const normalizedSender = normalizeUserId(sender);
    const botLid = normalizeUserId(sock.user?.lid?.split(':')[0]); // Fetch and normalize bot's LID
    const botId = normalizeUserId(sock.user?.id?.split(':')[0]); // Fetch and normalize bot's ID

    console.log(`🔍 Checking bot owner:
        - Sender: ${normalizedSender}
        - Bot LID: ${botLid}
        - Bot ID: ${botId}
    `);

    return normalizedSender === botLid || normalizedSender === botId;
};

/**
 * Check if the bot is an admin in the group.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} remoteJid - The group ID.
 * @returns {Promise<boolean>} - Whether the bot is an admin in the group.
 */
const isBotAdmin = async (sock, remoteJid) => {
    try {
        const botLid = normalizeUserId(sock.user?.lid?.split(':')[0]); // Fetch and normalize bot's LID
        const admins = await getGroupAdmins(sock, remoteJid); // Fetch group admins using groupData.js
        // Check if the normalized bot LID is in the list of admins
        return admins.includes(`${botLid}@lid`);
    } catch (error) {
        console.error(`❌ Failed to check bot admin status in group ${remoteJid}:`, error);
        return false;
    }
};
/**
 * Check if the sender is a group admin.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} remoteJid - The group ID.
 * @param {string} sender - The sender's ID.
 * @returns {Promise<boolean>} - Whether the sender is a group admin.
 */
const isGroupAdmin = async (sock, remoteJid, sender) => {
    try {
        const normalizedSender = normalizeUserId(sender); // Normalize the sender's ID
        const admins = await getGroupAdmins(sock, remoteJid); // Fetch group admins using groupData.js
        // Check if the normalized sender is in the list of admins
        const isAdmin = admins.includes(`${normalizedSender}@lid`) || admins.includes(`${normalizedSender}@s.whatsapp.net`);
        console.log(`🔍 Is Sender Admin: ${isAdmin}`);
        return isAdmin;
    } catch (error) {
        console.error(`❌ Failed to check group admin status for sender ${sender} in group ${remoteJid}:`, error);
        return false;
    }
};
/**
 * Check if the sender is allowed to execute commands based on group mode.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} remoteJid - The group ID.
 * @param {string} sender - The sender's ID.
 * @param {string} botLid - The bot's LID.
 * @returns {Promise<boolean>} - Whether the sender is allowed to execute commands.
 */
const isAllowedByGroupMode = async (sock, remoteJid, sender, botLid) => {
    try {
        const groupMode = await getGroupModeCached(remoteJid); // Fetch the group mode
        console.log(`🔍 Group Mode for ${remoteJid}: ${groupMode}`);

        const normalizedSender = normalizeUserId(sender); // Normalize the sender's ID
        const isOwner = isBotOwner(normalizedSender, sock); // Check if the sender is the bot owner

        if (groupMode === 'me') {
            // Only the bot owner is allowed
            return isOwner;
        } else if (groupMode === 'admin') {
            // Both group admins and the bot owner are allowed
            const isAdmin = await isGroupAdmin(sock, remoteJid, normalizedSender);
            return isOwner || isAdmin;
        }

        // Default: deny if group mode is unsupported
        return false;
    } catch (error) {
        console.error(`❌ Failed to determine group mode for ${remoteJid}:`, error);
        return false;
    }
};

module.exports = {
    isBotOwner,
    isBotAdmin,
    isGroupAdmin,
    isAllowedByGroupMode,
};