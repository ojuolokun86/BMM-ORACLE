const supabase = require('../supabaseClient'); // Import Supabase client
const { formatResponseCache } = require('./settingsCache');

/**
 * Get the format_response setting for a user.
 * @param {string} userId - The user's ID.
 * @returns {Promise<boolean>} - The format_response setting (true or false).
 */
const getFormatResponseSetting = async (userId) => {
    const normalizedUserId = normalizeUserId(userId);
    try {
        const { data, error } = await supabase
            .from('users')
            .select('format_response')
            .eq('user_id', normalizedUserId)
            .single();
        console.log('Querying format_response for userId:', normalizedUserId);
        if (error) {
            console.error(`❌ Failed to fetch format_response setting for user ${normalizedUserId}:`, error);
            return true; // Default to true if an error occurs
        }
        return data.format_response ?? true; // Default to true if null
    } catch (error) {
        console.error(`❌ Unexpected error fetching format_response setting for user ${normalizedUserId}:`, error);
        return true; // Default to true if an unexpected error occurs
    }
};

/**
 * Update the format_response setting for a user.
 * @param {string} userId - The user's ID.
 * @param {boolean} formatResponse - The new format_response setting.
 * @returns {Promise<void>}
 */
const updateFormatResponseSetting = async (userId, formatResponse) => {
    const normalizedUserId = normalizeUserId(userId);
    try {
        const { error } = await supabase
            .from('users')
            .update({ format_response: formatResponse })
            .eq('user_id', normalizedUserId);

        if (error) {
            console.error(`❌ Failed to update format_response setting for user ${normalizedUserId}:`, error);
        } else {
            // Update cache immediately
            formatResponseCache.set(normalizedUserId, { data: formatResponse, timestamp: Date.now() });
            console.log(`✅ Updated format_response setting for user ${normalizedUserId} to ${formatResponse}`);
        }
    } catch (error) {
        console.error(`❌ Unexpected error updating format_response setting for user ${normalizedUserId}:`, error);
    }
};

/**
 * Get the cached format_response setting for a user, or fetch it from the database if not cached.
 * @param {string} userId - The user's ID.
 * @returns {Promise<boolean>} - The cached or fetched format_response setting (true or false).
 */
const getFormatResponseSettingCached = async (userId) => {
    const cacheKey = userId;
    const cached = formatResponseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
        return cached.data;
    }
    const value = await getFormatResponseSetting(userId);
    formatResponseCache.set(cacheKey, { data: value, timestamp: Date.now() });
    return value;
};

/**
 * Format a response with a header and footer if the setting is enabled.
 * @param {string} userId - The user's ID.
 * @param {string} message - The message to format.
 * @returns {Promise<string>} - The formatted message.
 */
function normalizeUserId(userId) {
    return userId ? userId.split('@')[0].split(':')[0] : '';
}

const formatResponse = async (botInstance, message) => {
    const userIdRaw = botInstance?.user?.id || botInstance?.sock?.user?.id;
    const userId = normalizeUserId(userIdRaw);
    const formatResponse = await getFormatResponseSettingCached(userId); // Use cached version
    if (!formatResponse) {
        return message;
    }

    let ownerName = 'Unknown';
    try {
        ownerName = botInstance?.user?.name || botInstance?.sock?.user?.name || 'Unknown';
    } catch (e) {
        console.error('Failed to get owner name:', e);
    }

    const header = '🤖 *BMM BOT* 🤖\n\n';
    const footer = `\n\n👤 *Owner:* ${ownerName}`;
    return `${header}${message}${footer}`;
};

module.exports = {
    getFormatResponseSetting,
    updateFormatResponseSetting,
    formatResponse,
    normalizeUserId,
    getFormatResponseSettingCached,
};