const supabase = require('../supabaseClient');
const { prefixCache } = require('../utils/settingsCache');

/**
 * Fetch the prefix for a user from the `users` table in Supabase.
 * @param {string} userId - The user's ID.
 * @returns {Promise<string>} - The user's prefix or the default prefix ('.') if not found.
 */
const getUserPrefix = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('prefix')
            .eq('user_id', userId)
            .single(); // Expect a single row

        if (error && error.code === 'PGRST116') {
            console.log(`⚠️ No prefix found for user ${userId}. Returning default prefix (".").`);
            return '.'; // Default prefix
        }

        if (error) {
            console.error(`❌ Error fetching prefix for user ${userId}:`, error);
            return '.'; // Default prefix
        }

        return data?.prefix || '.'; // Return the prefix or default to '.'
    } catch (error) {
        console.error(`❌ Unexpected error fetching prefix for user ${userId}:`, error);
        return '.'; // Default prefix
    }
};

/**
 * Update the prefix for a user in the `users` table in Supabase.
 * @param {string} userId - The user's ID.
 * @param {string} newPrefix - The new prefix to set.
 * @returns {Promise<void>}
 */
const updateUserPrefix = async (userId, newPrefix) => {
    const { error } = await supabase
        .from('users')
        .update({ prefix: newPrefix })
        .eq('user_id', userId);

    if (error) {
        console.error(`❌ Error updating prefix for user ${userId}:`, error);
        throw error;
    }
      prefixCache.set(userId, { data: newPrefix, timestamp: Date.now() });
    console.log(`✅ Prefix for user ${userId} updated to "${newPrefix}".`);
};

/**
 * Update the prefix for all users to the default value ('.').
 * @returns {Promise<void>}
 */
const updateAllUserPrefixesToDefault = async () => {
    try {
        const { data: users, error } = await supabase
            .from('users') // Replace 'users' with your actual table name
            .select('user_id');

        if (error) {
            console.error('❌ Error fetching users from database:', error);
            throw error;
        }

        for (const user of users) {
            const { user_id } = user;
            await updateUserPrefix(user_id, '.'); // Update each user's prefix to the default value
        }

        console.log('✅ All user prefixes updated to the default value (".").');
    } catch (error) {
        console.error('❌ Failed to update all user prefixes to default:', error);
    }
};

/**
 * Delete the prefix for a user from Supabase.
 * @param {string} userId - The user's ID.
 * @returns {Promise<void>}
 */
const deleteUserPrefix = async (userId) => {
    const { error } = await supabase
        .from('users')
        .delete()
        .eq('user_id', userId);

    if (error) {
        console.error(`❌ Error deleting prefix for user ${userId}:`, error);
        throw error;
    }

    console.log(`✅ Prefix for user ${userId} deleted from Supabase.`);
};

async function getUserPrefixCached(userId) {
    const cached = prefixCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) return cached.data;

    const prefix = await getUserPrefix(userId); // original DB function
    prefixCache.set(userId, { data: prefix, timestamp: Date.now() });
    return prefix;
}

module.exports = {
    getUserPrefix,
    updateUserPrefix,
    updateAllUserPrefixesToDefault,
    deleteUserPrefix,
    getUserPrefixCached,
};