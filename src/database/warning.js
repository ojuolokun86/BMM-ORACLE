const supabase = require('../supabaseClient');
const { normalizeUserId } = require('../utils/normalizeUserId'); // Import the normalizeUserId function
const env = require('../utils/loadEnv'); // Import environment variables
const ADMIN_NUMBER = env.ADMIN_NUMBER; // Load the admin number from .env

/**
 * Normalize the bot instance ID to ensure consistent formatting.
 * @param {string} botInstanceId - The bot instance ID.
 * @returns {string} - The normalized bot instance ID.
 */
const normalizeBotInstanceId = (botInstanceId) => {
    return botInstanceId.split('@')[0].split(':')[0]; // Removes @s.whatsapp.net and anything after :
};


/**
 * Warn a user in a group.
 * @param {string} groupId - The group ID.
 * @param {string} userId - The user ID.
 * @param {string} reason - The reason for the warning.
 * @param {string} botInstanceId - The bot instance ID.
 * @returns {Promise<number>} - The updated warning count.
 */
const warnUser = async (groupId, userId, reason, botInstanceId) => {
    const normalizedBotInstanceId = normalizeBotInstanceId(botInstanceId);
    console.log(`[DEBUG] Warning user ${userId} in group ${groupId} using bot instance ${normalizedBotInstanceId}`);

    const { data, error } = await supabase
        .from('warnings')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('bot_instance_id', normalizedBotInstanceId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching warnings for user ${userId} in group ${groupId}:`, error);
        throw error;
    }

    let warningCount = data ? data.warning_count + 1 : 1;

    if (data) {
        // Update existing warning
        const { error: updateError } = await supabase
            .from('warnings')
            .update({ warning_count: warningCount, reason, updated_at: new Date() })
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .eq('bot_instance_id', normalizedBotInstanceId);


            console.log('[DEBUG] Supabase delete result:', data);

        if (updateError) {
            console.error(`❌ Error updating warnings for user ${userId} in group ${groupId}:`, updateError);
            throw updateError;
        }
    } else {
        // Insert new warning
        const { error: insertError } = await supabase
            .from('warnings')
            .insert({ group_id: groupId, user_id: userId, reason, warning_count: warningCount, bot_instance_id: normalizedBotInstanceId });

        if (insertError) {
            console.error(`❌ Error inserting warnings for user ${userId} in group ${groupId}:`, insertError);
            throw insertError;
        }
    }

    console.log(`✅ Warning count for user ${userId} in group ${groupId} updated to ${warningCount}.`);
    return warningCount;
};

/**
 * Reset all warnings for a user in a group.
 * Deletes all offenses for the user from the database.
 * @param {string} groupId - The group ID.
 * @param {string} userId - The user ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @returns {Promise<void>}
 */
const resetWarnings = async (groupId, userId, botInstanceId) => {
    const normalizedBotInstanceId = normalizeBotInstanceId(botInstanceId);
    console.log(`[DEBUG] Resetting warnings for user ${userId} in group ${groupId} using bot instance ${normalizedBotInstanceId}`);

    const { data, error } = await supabase
    .from('warnings')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('bot_instance_id', normalizedBotInstanceId)
    .select(); // 👈 This is the key fix
  
        console.log('[DEBUG] Supabase delete result:', data);

    if (error) {
        console.error(`❌ Error resetting warnings for user ${userId} in group ${groupId}:`, error);
        throw error;
    }

    console.log(`✅ All warnings for user ${userId} in group ${groupId} have been reset.`);
};
/**
 * Fetch all warnings for a group.
 * @param {string} groupId - The group ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @returns {Promise<object[]>} - The list of warnings.
 */
const getAllWarningsForGroup = async (groupId, botInstanceId) => {
    const normalizedBotInstanceId = normalizeBotInstanceId(botInstanceId);
    console.log(`🔍 Fetching all warnings for group ${groupId} and bot instance ${normalizedBotInstanceId}...`);

    const { data, error } = await supabase
        .from('warnings')
        .select('*')
        .eq('group_id', groupId)
        .eq('bot_instance_id', normalizedBotInstanceId);

    if (error) {
        console.error(`❌ Error fetching warnings for group ${groupId}:`, error);
        throw error;
    }

    console.log(`✅ Fetched ${data.length} warnings for group ${groupId}.`);
    return data || [];
};

/**
 * Fetch warnings for a specific user in a group.
 * @param {string} groupId - The group ID.
 * @param {string} userId - The user ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @returns {Promise<object|null>} - The warning data or null if not found.
 */
const getWarnings = async (groupId, userId, botInstanceId) => {
    const normalizedBotInstanceId = normalizeBotInstanceId(botInstanceId);
    console.log(`🔍 Fetching warnings for user ${userId} in group ${groupId} and bot instance ${normalizedBotInstanceId}...`);

    const { data, error } = await supabase
        .from('warnings')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('bot_instance_id', normalizedBotInstanceId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching warnings for user ${userId} in group ${groupId}:`, error);
        throw error;
    }

    console.log(`✅ Fetched warnings for user ${userId} in group ${groupId}:`, data);
    return data || null;
};

/**
 * Get the warning threshold for a group.
 * @param {string} groupId - The group ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @returns {Promise<number>} - The warning threshold (default is 3 if not set).
 */
const getWarningThreshold = async (groupId, botInstanceId) => {
    const normalizedBotInstanceId = normalizeBotInstanceId(botInstanceId);
    console.log(`🔍 Fetching warning threshold for group ${groupId} and bot instance ${normalizedBotInstanceId}...`);

    const { data, error } = await supabase
        .from('group_settings')
        .select('warning_threshold')
        .eq('group_id', groupId)
        .eq('bot_instance_id', normalizedBotInstanceId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching warning threshold for group ${groupId} and bot instance ${normalizedBotInstanceId}:`, error);
        throw error;
    }

    console.log(`✅ Warning threshold for group ${groupId} is ${data?.warning_threshold || 3}.`);
    return data?.warning_threshold || 3; // Default to 3 if not set
};

/**
 * Set the warning threshold for a group.
 * @param {string} groupId - The group ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @param {number} threshold - The warning threshold.
 * @returns {Promise<void>}
 */
const setWarningThreshold = async (groupId, botInstanceId, threshold) => {
    const normalizedBotInstanceId = normalizeBotInstanceId(botInstanceId);
    console.log(`🔄 Setting warning threshold for group ${groupId} and bot instance ${normalizedBotInstanceId} to ${threshold}...`);

    const { error } = await supabase
        .from('group_settings')
        .upsert(
            { group_id: groupId, bot_instance_id: normalizedBotInstanceId, warning_threshold: threshold },
            { onConflict: ['group_id', 'bot_instance_id'] }
        );

    if (error) {
        console.error(`❌ Error setting warning threshold for group ${groupId} and bot instance ${normalizedBotInstanceId}:`, error);
        throw error;
    }

    console.log(`✅ Warning threshold for group ${groupId} and bot instance ${normalizedBotInstanceId} set to ${threshold}.`);
};

/**
 * Delete warnings older than 3 days.
 * @returns {Promise<void>}
 */
const deleteOldWarnings = async () => {
    try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const { error } = await supabase
            .from('warnings')
            .delete()
            .lt('updated_at', threeDaysAgo.toISOString());

        if (error) {
            console.error('❌ Error deleting old warnings:', error);
        } else {
            console.log('✅ Warnings older than 3 days deleted successfully.');
        }
    } catch (error) {
        console.error('❌ Failed to delete old warnings:', error);
    }
};

// Schedule the task to run daily
setInterval(deleteOldWarnings, 24 * 60 * 60 * 1000); // Run every 24 hours

module.exports = {
    warnUser,
    resetWarnings,
    getWarnings,
    getAllWarningsForGroup,
    getWarningThreshold,
    setWarningThreshold,
    deleteOldWarnings, // Export the function for testing or manual execution
};