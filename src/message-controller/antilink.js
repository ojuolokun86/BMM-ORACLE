const supabase = require('../supabaseClient');
const { warnUser, getWarningThreshold, resetWarnings } = require('../database/warning');
const { sendToChat } = require('../utils/messageUtils');
const { normalizeUserId } = require('../utils/normalizeUserId');
const { deletedMessagesByBot } = require('../utils/globalStore');
const { getGroupAdmins } = require('../utils/groupData');
const { antilinkCache } = require('../utils/settingsCache');

const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|t\.me\/[^\s]+|bit\.ly\/[^\s]+|[\w-]+\.(com|net|org|info|biz|xyz|live|tv|me|link)(\/\S*)?)/gi;

/**
 * Fetch a user from the `users` table by user ID or LID.
 * @param {string} userIdOrLid - The user's ID or LID.
 * @returns {Promise<object|null>} - The user data or null if not found.
 */
const getUserFromUsersTable = async (userIdOrLid) => {
    const normalized = normalizeUserId(userIdOrLid);
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`user_id.eq.${normalized},lid.eq.${normalized}`)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching user from users table for user ID/LID ${normalized}:`, error);
        throw error;
    }
    if (!data) {
        console.log(`⚠️ User with ID/LID ${normalized} not found in users table.`);
        return null;
    }
    return data;
};

/**
 * Update Anti-Link settings for a group and user.
 * @param {string} groupId - The group ID.
 * @param {string} userId - The user's ID (should be normalized user_id).
 * @param {object} settings - The new Anti-Link settings.
 * @returns {Promise<void>}
 */
const updateAntiLinkSettings = async (groupId, userId, settings) => {
    const normalizedUserId = normalizeUserId(userId);
    const { error } = await supabase
        .from('antilink_settings')
        .upsert(
            {
                group_id: groupId,
                user_id: normalizedUserId,
                ...settings,
            },
            { onConflict: ['group_id', 'user_id'] }
        );
    if (error) {
        console.error(`❌ Error updating Anti-Link settings for group ${groupId} and user ${normalizedUserId}:`, error);
        throw error;
    }
    const cacheKey = `${groupId}:${normalizedUserId}`;
    antilinkCache.delete(cacheKey); // Invalidate cache after update
};

/**
 * Fetch Anti-Link settings for a group and user.
 * @param {string} groupId - The group ID.
 * @param {string} userId - The user's ID (should be normalized user_id).
 * @returns {Promise<object>} - The Anti-Link settings.
 */
const getAntiLinkSettings = async (groupId, userId) => {
    const normalizedUserId = normalizeUserId(userId);
    const { data, error } = await supabase
        .from('antilink_settings')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', normalizedUserId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching Anti-Link settings for group ${groupId} and user ${normalizedUserId}:`, error);
        throw error;
    }
    return data || { antilink_enabled: false, warning_count: 3, bypass_admin: false, bypass_users: [] };
};

/**
 * Fetch Anti-Link settings for a group and user with caching.
 * @param {string} groupId - The group ID.
 * @param {string} userId - The user's ID (should be normalized user_id).
 * @returns {Promise<object>} - The Anti-Link settings.
 */
async function getAntiLinkSettingsCached(groupId, userId) {
    const normalizedUserId = normalizeUserId(userId);
    const cacheKey = `${groupId}:${normalizedUserId}`;
    const cached = antilinkCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) return cached.data;
    const data = await getAntiLinkSettings(groupId, normalizedUserId);
    antilinkCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}

/**
 * Handle Anti-Link detection in a group.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {object} message - The incoming message object.
 * @param {string} userId - The bot's user_id (normalized, as saved in DB).
 */
const handleAntiLink = async (sock, message, userId) => {
    const chatId = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;
    const messageId = message.key.id;

    // Extract message content for all message types
    const msgText =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption ||
        message.message?.documentMessage?.caption ||
        '';

    // Fetch the bot owner's user_id and lid from memory or the users table
    let botOwnerData = null;
    if (sock.user?.user_id) {
        botOwnerData = { user_id: sock.user.user_id, lid: sock.user.lid, id: sock.user.id };
    } else if (sock.user?.id) {
        // Normalize before lookup
        const plainId = normalizeUserId(sock.user.id.split(':')[0]);
        botOwnerData = await getUserFromUsersTable(plainId);
    } else {
        botOwnerData = null;
    }

    if (!botOwnerData || (!botOwnerData.user_id && !botOwnerData.lid)) {
        console.error(`❌ Could not fetch bot owner's user_id/lid. Skipping Anti-Link processing.`);
        return;
    }

    const normalizedBotOwnerId = normalizeUserId(botOwnerData.user_id?.split(':')[0]);
    const normalizedBotOwnerLid = normalizeUserId(botOwnerData.lid?.split(':')[0]);
    const normalizedBotOwnerSockId = normalizeUserId(botOwnerData.id?.split(':')[0]);
    const normalizedSender = normalizeUserId(sender.split('@')[0]);

    // Check if the sender is the bot owner (by user_id, lid, or id)
    if (
        normalizedSender === normalizedBotOwnerId ||
        normalizedSender === normalizedBotOwnerLid ||
        normalizedSender === normalizedBotOwnerSockId
    ) {
        return; // Do not process messages sent by the bot owner
    }

    // Always use normalized userId for settings
    const groupSettings = await getAntiLinkSettingsCached(chatId, userId);
    if (!groupSettings.antilink_enabled) return;

    // Check if the sender is bypassed
    if (groupSettings.bypass_users?.includes(sender)) return;

    // Check if the sender is an admin and bypass_admin is enabled
    const isAdmin = await getGroupAdmins(sock, chatId);
    if (isAdmin && groupSettings.bypass_admin) return;

    // Detect links
    if (linkRegex.test(msgText)) {
        await sock.sendMessage(chatId, { delete: message.key });
        try {
            const reason = 'Posting a prohibited link';
            const warningCount = await warnUser(chatId, sender, reason, userId);
            const warningThreshold = await getWarningThreshold(chatId, userId);
            if (warningCount >= warningThreshold) {
                await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
                await resetWarnings(chatId, sender, userId);
            } else {
                const warningMessage = `⚠️ @${sender.split('@')[0]}, sharing links is not allowed in this group. You have ${warningCount}/${warningThreshold} warnings.`;
                await sock.sendMessage(chatId, { text: warningMessage, mentions: [sender] });
            }
        } catch (error) {
            console.error(`❌ Failed to warn user ${sender} in group ${chatId}:`, error);
        }
    }

    // Track the deleted message
    if (!deletedMessagesByBot[userId]) {
        deletedMessagesByBot[userId] = new Set();
    }
    deletedMessagesByBot[userId].add(messageId);
};

module.exports = {
    getUserFromUsersTable,
    updateAntiLinkSettings,
    getAntiLinkSettings,
    getAntiLinkSettingsCached,
    handleAntiLink,
};