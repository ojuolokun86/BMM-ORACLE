const { getAntideleteSettingsCached } = require('../message-controller/antidelete');
const { getAntiLinkSettingsCached } = require('../message-controller/antilink');
const { getUserStatusSettingsCached, getUserSubscriptionLevelCached, getGroupModeCached } = require('../database/userDatabase');
const { getUserPrefixCached } = require('../database/userPrefix');
const { getWelcomeSettingsCached } = require('../database/welcome');
const { getWarningThresholdCached, } = require('../database/warning');
const { getDndSettingsCached } = require('../dnd/dndManager');
const { userCache } = require('./settingsCache');
const settings = require('./settings');

/**
 * Gather all settings for a user/group/bot instance.
 * @param {object} params - { userId, groupId, botInstanceId }
 * @returns {Promise<object>} - Aggregated settings object
 */
async function getAllSettings({ userId, groupId, botInstanceId }) {
    // User info from cache
    const user = userCache.get(userId)?.data || {};

    // Prefix
    const prefix = await getUserPrefixCached(userId);

    // Antidelete (per chat/group)
    let antidelete = {};
    if (groupId && botInstanceId) {
        antidelete = await getAntideleteSettingsCached(groupId, botInstanceId);
    }

    // Antilink (per group)
    let antilink = {};
        if (groupId && userId) {
            antilink = await getAntiLinkSettingsCached(groupId, userId);
        }

    // Status settings
    const statusSettings = await getUserStatusSettingsCached(userId);

    // Welcome settings
   let welcome = {};
    if (groupId && botInstanceId) {
        welcome = await getWelcomeSettingsCached(groupId, botInstanceId);
    }

    // Warning settings
    let warning = {};
    if (groupId && botInstanceId) {
        warning = await getWarningThresholdCached(groupId, botInstanceId);
    }

    // DND settings
    let dnd = {};
    if (userId) {
        dnd = await getDndSettingsCached(userId);
    }


    // Group mode
    let groupMode = {};
    if (groupId && userId) {
        groupMode = await getGroupModeCached(userId, groupId);
    }

    // Subscription level
    let subscriptionLevel = 'free';
    if (user.auth_id) {
        subscriptionLevel = await getUserSubscriptionLevelCached(user.auth_id);
    }

    // Compose all settings
    return {
        botName: settings.botName,
        botVersion: settings.version,
        userId: user.user_id || userId,
        userLid: user.lid,
        prefix,
        antidelete,
        antilink,
        statusSettings,
        welcome,
        warning,
        dnd,
        groupMode,
        subscriptionLevel,
        // Add more as needed
    };
}

module.exports = { getAllSettings };