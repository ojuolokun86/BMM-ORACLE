const supabase = require('../supabaseClient'); // Import your Supabase client
const { botInstances } = require('./globalStore');

/**
 * Fetch the user ID from the database by matching their ID or sanitized LID.
 * @param {string} userId - The user's ID (e.g., WhatsApp ID).
 * @param {string} lid - The user's Linked ID (optional).
 * @returns {Promise<string|null>} - The user ID if authorized, or null if not found.
 */
const getUserId = async (userId, lid = null) => {
    try {
        // Sanitize the LID by removing any suffix (e.g., ":59@lid")
        const sanitizedLid = lid ? lid.split(':')[0] : null;

        // Query the users table in Supabase
        const { data, error } = await supabase
            .from('users')
            .select('id, lid')
            .or(`id.eq.${userId},lid.eq.${sanitizedLid}`);

        if (error) {
            console.error('❌ Error querying users table:', error);
            return null;
        }

        // Check if any matching user exists
        if (data && data.length > 0) {
            console.log(`✅ User found: ID=${data[0].id}, LID=${data[0].lid}`);
            return data[0].id; // Return the user ID
        }

        console.log(`❌ User not found: ID=${userId}, LID=${sanitizedLid}`);
        return null;
    } catch (err) {
        console.error('❌ Unexpected error in getUserId:', err);
        return null;
    }
};

/**
 * Resolve the userId dynamically based on the id and lid.
 * @param {string} id - The WhatsApp ID.
 * @param {string} lid - The Linked ID.
 * @returns {string|null} - The resolved userId or null if no match is found.
 */
const resolveUserId = (id, lid) => {
    for (const [userId, instance] of Object.entries(botInstances)) {
        if (instance.id === id && instance.lid === lid) {
            return userId; // Return the matching userId
        }
    }
    return null; // No match found
};

module.exports = { getUserId, resolveUserId };