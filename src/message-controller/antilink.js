const supabase = require('../supabaseClient');
const { warnUser, getWarningThreshold, resetWarnings } = require('../database/warning');
const { sendToChat } = require('../utils/messageUtils');
const path = require('path');
const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|t\.me\/[^\s]+|bit\.ly\/[^\s]+|[\w-]+\.(com|net|org|info|biz|xyz|live|tv|me|link)(\/\S*)?)/gi;
const { normalizeUserId } = require('../utils/normalizeUserId'); // Import the normalize function
const { deletedMessagesByBot } = require('../utils/globalStore');
const { getGroupAdmins } = require('../utils/groupData'); // Import the group data functions
const { antilinkCache } = require('../utils/settingsCache');

/**
 * Fetch a user from the `users` table by user ID.
 * @param {string} userId - The user's ID.
 * @returns {Promise<object|null>} - The user data or null if not found.
 */
const getUserFromUsersTable = async (userId) => {
    const normalizedUserId = normalizeUserId(userId); // Normalize userId
    console.log(`🔍 Fetching user from users table for user ID: ${normalizedUserId}...`);

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', normalizedUserId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching user from users table for user ID ${normalizedUserId}:`, error);
        throw error;
    }

    if (!data) {
        console.log(`⚠️ User with ID ${normalizedUserId} not found in users table.`);
        return null;
    }

    return data;
};

/**
 * Update Anti-Link settings for a group and user.
 * @param {string} groupId - The group ID.
 * @param {string} userLid - The user's Linked ID.
 * @param {object} settings - The new Anti-Link settings.
 * @returns {Promise<void>}
 */
const updateAntiLinkSettings = async (groupId, userLid, settings) => {
    console.log(`🔄 Updating Anti-Link settings for group ${groupId} and user ${userLid}:`, settings);

    const { error } = await supabase
        .from('antilink_settings')
        .upsert(
            {
                group_id: groupId,
                user_id: userLid, // Use Linked ID as user_id
                ...settings, // Spread the settings object to include antilink_enabled, warning_count, etc.
            },
            { onConflict: ['group_id', 'user_id'] } // Ensure these columns have a unique constraint
        );

    if (error) {
        console.error(`❌ Error updating Anti-Link settings for group ${groupId} and user ${userLid}:`, error);
        throw error;
    }
     if (!error) {
        const cacheKey = `${groupId}:${userLid}`;
        antilinkCache.set(cacheKey, { data: settings, timestamp: Date.now() });
    }

    console.log(`✅ Anti-Link settings updated for group ${groupId} and user ${userLid}.`);
};

/**
 * Fetch Anti-Link settings for a group and user.
 * @param {string} groupId - The group ID.
 * @param {string} userLid - The user's Linked ID.
 * @returns {Promise<object>} - The Anti-Link settings.
 */
const getAntiLinkSettings = async (groupId, userLid) => {
    console.log(`🔍 Fetching Anti-Link settings for group ${groupId} and user ${userLid}...`);

    const { data, error } = await supabase
        .from('antilink_settings')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userLid) // Use Linked ID as user_id
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching Anti-Link settings for group ${groupId} and user ${userLid}:`, error);
        throw error;
    }
    return data || { antilink_enabled: false, warning_count: 3, bypass_admin: false, bypass_users: [] }; // Default settings
};

/**
 * Fetch Anti-Link settings for a group and user with caching.
 * @param {string} groupId - The group ID.
 * @param {string} userLid - The user's Linked ID.
 * @returns {Promise<object>} - The Anti-Link settings.
 */
async function getAntiLinkSettingsCached(groupId, userLid) {
    const cacheKey = `${groupId}:${userLid}`;
    const cached = antilinkCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) return cached.data; // 10 min cache

    const data = await getAntiLinkSettings(groupId, userLid); // original DB function
    antilinkCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}

/**
 * Handle Anti-Link detection in a group.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {object} message - The incoming message object.
 * @param {string} userLid - The user's Linked ID.
 */
const handleAntiLink = async (sock, message, userLid) => {
    const chatId = message.key.remoteJid; // Group ID
    const sender = message.key.participant || message.key.remoteJid; // Sender's ID
    const messageId = message.key.id; // Extract the message ID

    // Extract message content for all message types
    const msgText =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption ||
        message.message?.documentMessage?.caption ||
        ''; // Default to an empty string if no text is found

    // Fetch the bot owner's lid and id from memory or the users table
    const botOwnerData = sock.user?.lid
        ? { lid: sock.user.lid, id: sock.user.id }
        : await getUserFromUsersTable(sock.user?.id);

    if (!botOwnerData || !botOwnerData.lid) {
        console.error(`❌ Could not fetch bot owner's lid. Skipping Anti-Link processing.`);
        return;
    }

    const normalizedBotOwnerLid = normalizeUserId(botOwnerData.lid.split(':')[0]); // Normalize and remove suffix
    const normalizedBotOwnerId = normalizeUserId(botOwnerData.id.split(':')[0]); // Normalize and remove suffix
    // Normalize the sender's ID for comparison
    const normalizedSender = normalizeUserId(sender.split('@')[0]);

    // Check if the sender is the bot owner
    if (
        normalizedSender === normalizedBotOwnerLid ||
        normalizedSender === normalizedBotOwnerId
    ) {
        return; // Do not process messages sent by the bot owner
    }

    const groupSettings = await getAntiLinkSettingsCached(chatId, userLid);
    console.log(`🔍 Anti-Link enabled: ${groupSettings.antilink_enabled}`);

    if (!groupSettings.antilink_enabled) {
        return; // Anti-Link is disabled
    }

    // Check if the sender is bypassed
    if (groupSettings.bypass_users?.includes(sender)) {
        return;
    }

    // Check if the sender is an admin and bypass_admin is enabled
    const isAdmin  =  await getGroupAdmins(sock, chatId);
    

    if (isAdmin && groupSettings.bypass_admin) {
        return;
    }

    // Detect links
    if (linkRegex.test(msgText)) {
        console.log(`✅ Link detected in message: "${msgText}"`);
        // Delete the message
        await sock.sendMessage(chatId, { delete: message.key });
        console.log(`⚠️ Message from ${sender} deleted in group: ${chatId} (link detected)`);

        // Warn the user for posting a link
        try {
            const reason = 'Posting a prohibited link';
            const warningCount = await warnUser(chatId, sender, reason, userLid);
            console.log(`⚠️ User ${sender} warned for posting a link. Current warning count: ${warningCount}`);

            // Fetch the group's warning threshold
            const warningThreshold = await getWarningThreshold(chatId, userLid);
            console.log(`🔍 Warning threshold for group ${chatId}: ${warningThreshold}`);

            // Check if the user has exceeded the warning threshold
            if (warningCount >= warningThreshold) {
                console.log(`🚨 User ${sender} has exceeded the warning threshold. Kicking from group ${chatId}...`);

                // Kick the user from the group
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                console.log(`✅ User ${sender} removed from group ${chatId}.`);

                // Reset the user's warnings after kicking
                await resetWarnings(chatId, sender, userLid);
                console.log(`♻️ Warnings for user ${sender} reset after removal.`);
            } else {
                // Warn the user in the group
                const warningMessage = `⚠️ @${sender.split('@')[0]}, sharing links is not allowed in this group. You have ${warningCount}/${warningThreshold} warnings.`;
                await sock.sendMessage(chatId, { text: warningMessage, mentions: [sender] });
                console.log(`✅ Warning message sent to ${sender} in group ${chatId}.`);
            }
        } catch (error) {
            console.error(`❌ Failed to warn user ${sender} in group ${chatId}:`, error);
        }
    } else {
        console.log(`ℹ️ No link detected in message: "${msgText}"`);
    }

    // Track the deleted message
    if (!deletedMessagesByBot[userLid]) {
        deletedMessagesByBot[userLid] = new Set();
    }
    deletedMessagesByBot[userLid].add(messageId);

    console.log(`✅ Message ${messageId} deleted by bot instance ${userLid}.`);
};

module.exports = {
    getUserFromUsersTable,
    getAntiLinkSettings,
    updateAntiLinkSettings,
    handleAntiLink,
};