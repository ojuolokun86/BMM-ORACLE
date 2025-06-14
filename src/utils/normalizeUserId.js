/**
 * Normalize a user ID by removing the @s.whatsapp.net suffix.
 * @param {string} userId - The user ID to normalize.
 * @returns {string} - The normalized user ID.
 */
const normalizeUserId = (userId) => {
    if (!userId || typeof userId !== 'string') {
        console.error(`❌ Invalid userId: Expected a string but got ${typeof userId}. Value:`, userId);
        return '';
    }
    return userId.split('@')[0]; // Remove the @s.whatsapp.net suffix
};

module.exports = { normalizeUserId };