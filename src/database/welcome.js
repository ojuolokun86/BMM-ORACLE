const supabase = require('../supabaseClient');

/**
 * Enable or disable the welcome message for a group.
 * @param {string} groupId - The group ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @param {boolean} isEnabled - Whether the welcome message is enabled.
 * @returns {Promise<void>}
 */
const setWelcomeStatus = async (groupId, botInstanceId, isEnabled) => {
    const { error } = await supabase
        .from('welcome_settings')
        .upsert({ group_id: groupId, bot_instance_id: botInstanceId, is_enabled: isEnabled }, { onConflict: ['group_id', 'bot_instance_id'] });

    if (error) {
        console.error(`❌ Error setting welcome status for group ${groupId} and bot instance ${botInstanceId}:`, error);
        throw error;
    }

    console.log(`✅ Welcome status for group ${groupId} and bot instance ${botInstanceId} set to ${isEnabled ? 'enabled' : 'disabled'}.`);
};

/**
 * Set a custom welcome message for a group.
 * @param {string} groupId - The group ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @param {string} message - The custom welcome message.
 * @returns {Promise<void>}
 */
const setWelcomeMessage = async (groupId, botInstanceId, message) => {
    const { error } = await supabase
        .from('welcome_settings')
        .upsert({ group_id: groupId, bot_instance_id: botInstanceId, welcome_message: message }, { onConflict: ['group_id', 'bot_instance_id'] });

    if (error) {
        console.error(`❌ Error setting welcome message for group ${groupId} and bot instance ${botInstanceId}:`, error);
        throw error;
    }

    console.log(`✅ Welcome message for group ${groupId} and bot instance ${botInstanceId} set to: "${message}".`);
};

/**
 * Get the welcome settings for a group and bot instance.
 * @param {string} groupId - The group ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @returns {Promise<object>} - The welcome settings.
 */
const getWelcomeSettings = async (groupId, botInstanceId) => {
    console.log(`🔍 Fetching welcome settings for group ${groupId} and bot instance ${botInstanceId}...`);
    const { data, error } = await supabase
        .from('welcome_settings')
        .select('*')
        .eq('group_id', groupId)
        .eq('bot_instance_id', botInstanceId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching welcome settings for group ${groupId} and bot instance ${botInstanceId}:`, error);
        throw error;
    }

    console.log(`✅ Fetched welcome settings:`, data);
    return data || { is_enabled: false, welcome_message: null };
};
module.exports = {
    setWelcomeStatus,
    setWelcomeMessage,
    getWelcomeSettings,
};