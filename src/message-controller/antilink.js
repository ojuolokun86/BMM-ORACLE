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
const handleAntiLink = async (sock, message, userId, botInstance) => {
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
     const botId = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : null;
        if (botId) {
            if (!deletedMessagesByBot[botId]) deletedMessagesByBot[botId] = new Set();
            deletedMessagesByBot[botId].add(messageId);
            console.log('[DEBUG] Added to deletedMessagesByBot:', messageId, 'for botId:', botId, 'in chat:', chatId);
        }
    

    try {
        const reason = 'Posting a prohibited link';
        const warningCount = await warnUser(chatId, sender, reason, userId);
        const warningThreshold = await getWarningThreshold(chatId, userId);

        const roboticWarnings = [
            `🤖 SYSTEM ALERT: Link detected.\n@${sender.split('@')[0]}, link sharing is *unauthorized* in this group.\n⚠️ Warning ${warningCount}/${warningThreshold}. Violation logged.`,
            `🛡️ BMM BOT Firewall Activated.\n@${sender.split('@')[0]}, links are blocked for group security.\n⚠️ Strike ${warningCount}/${warningThreshold}. Next strike = auto removal.`,
            `🤖 BMM BOT DETECTED A LINK!\n@${sender.split('@')[0]}, this action is *not permitted*.\n⚠️ You now have ${warningCount}/${warningThreshold} warnings.`,
            `📡 POLICY ENFORCEMENT TRIGGERED\n@${sender.split('@')[0]}, link sharing violates group rules.\n🤖 Warning ${warningCount}/${warningThreshold}. Final action will be executed if limit is reached.`,
            `🚨 UNAUTHORIZED TRANSMISSION DETECTED\n@${sender.split('@')[0]}, links are not allowed here.\n⚠️ You have been flagged: ${warningCount}/${warningThreshold}.`,
            `🤖 AUTOMOD ALERT:\n@${sender.split('@')[0]}, link sharing is a *restricted operation*.\nWarning Count: ${warningCount}/${warningThreshold}.`,
            `⚠️ RULE VIOLATION NOTICE:\n@${sender.split('@')[0]}, external links are *forbidden* in this group.\n🤖 BMM BOT Warning: ${warningCount}/${warningThreshold}.`,
            `🛰️ PROTOCOL BREACH DETECTED\n@${sender.split('@')[0]}, link distribution is not authorized.\n⚠️ Warning Level: ${warningCount}/${warningThreshold}.`,
            `🤖 BMM BOT SECURITY SYSTEM ENGAGED\n@${sender.split('@')[0]}, link sharing is a violation.\n⚠️ Warning ${warningCount}/${warningThreshold}. Automatic enforcement pending.`,
            `🔐 ANTI-LINK ENFORCEMENT UNIT\n@${sender.split('@')[0]}, link detected and blocked.\n⚠️ Warning Level: ${warningCount}/${warningThreshold}. Bot will escalate if limit is reached.`,
            `🤖 SECURITY NOTICE: @${sender.split('@')[0]}, link transmission detected and blocked.\n⚠️ You are now at ${warningCount}/${warningThreshold} warnings. Auto-discipline system is active.`,

            `🤖 WARNING SYSTEM ONLINE:\n@${sender.split('@')[0]}, external link sharing is in breach of BMM BOT policy.\n⚠️ Violation ${warningCount}/${warningThreshold}. Logging incident.`,

            `🚫 CYBER PROTOCOL VIOLATION:\n@${sender.split('@')[0]}, links are restricted under group policy.\n⚠️ Warning Status: ${warningCount}/${warningThreshold}. Bot alert triggered.`,

            `🤖 ALERT: NETWORK BREACH ATTEMPT\n@${sender.split('@')[0]}, unauthorized link sharing blocked.\n⚠️ Current Violation Level: ${warningCount}/${warningThreshold}.`,

            `🤖 LINK FILTER ACTIVE:\n@${sender.split('@')[0]}, this message violated group security settings.\n⚠️ Warning Count: ${warningCount}/${warningThreshold}. System integrity maintained.`,

            `📡 MONITORING UNIT DETECTION:\n@${sender.split('@')[0]}, link transmission is not allowed in this frequency.\n⚠️ Infraction ${warningCount}/${warningThreshold}. Enforcement pending.`,

            `🤖 ACCESS DENIED:\n@${sender.split('@')[0]}, link detected — operation unauthorized.\n⚠️ Warning: ${warningCount}/${warningThreshold}. Repeating this may lead to elimination.`,

            `🔒 INTRUSION DETECTED\n@${sender.split('@')[0]}, group link policy breach confirmed.\n⚠️ Warning Level: ${warningCount}/${warningThreshold}. Disciplinary protocol armed.`,

            `🤖 SYSTEM OVERRIDE INITIATED\n@${sender.split('@')[0]}, prohibited link sharing is not permitted.\n⚠️ ${warningCount}/${warningThreshold} warnings issued. Monitor continues.`,

            `🤖 BMM BOT FIREWALL BLOCK\n@${sender.split('@')[0]}, your link has been removed.\n⚠️ Strike Count: ${warningCount}/${warningThreshold}. Threat status updated.`,

        ];

        // Pick random robotic warning
        const warningMessage = roboticWarnings[Math.floor(Math.random() * roboticWarnings.length)];

        if (warningCount >= warningThreshold) {
            await sock.groupParticipantsUpdate(chatId, [sender], 'remove');
            await resetWarnings(chatId, sender, userId);
        } else {
            await sendToChat(sock, chatId, { message: warningMessage, mentions: [sender] });
        }

    } catch (error) {
        console.error(`❌ Failed to warn user ${sender} in group ${chatId}:`, error);
    }
}
};

module.exports = {
    getUserFromUsersTable,
    updateAntiLinkSettings,
    getAntiLinkSettings,
    getAntiLinkSettingsCached,
    handleAntiLink,
};