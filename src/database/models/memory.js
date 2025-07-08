const memoryStore = new Map(); // In-memory storage for sessions
const  supabase  = require('../../supabaseClient'); // Supabase client for database operations
const globalStore = require('../../utils/globalStore');


/**
 * Calculate the size of an object in bytes.
 * @param {Object} obj - The object to calculate the size of.
 * @returns {number} - The size of the object in bytes.
 */
const calculateObjectSize = (obj) => {
    const objectString = JSON.stringify(obj);
    return Buffer.byteLength(objectString, 'utf8');
};

/**
 * Enforce memory limit for a user session.
 * @param {string} phoneNumber - The phone number of the session.
 */
const enforceMemoryLimit = async (phoneNumber) => {

     if (globalStore.deletedUsers && globalStore.deletedUsers[phoneNumber]) {
        return;
    }
    const session = memoryStore.get(phoneNumber);
    if (!session) return;

    const sizeInBytes = calculateObjectSize(session);
    const sizeInMB = sizeInBytes / (1024 * 1024);

    let user;
    try {
        const { data, error } = await supabase
            .from('users')
            .select('max_ram, max_rom, auth_id')
            .eq('user_id', phoneNumber)
            .maybeSingle();

        if (error) throw error;
        user = data;
        if (!user) {
            console.warn(`⚠️ No user found in DB for phoneNumber/user_id: ${phoneNumber}. Skipping memory enforcement.`);
            return;
        }
    } catch (error) {
        console.error(`❌ Failed to fetch memory limits for user ${phoneNumber}:`, error.message || error);
        return; // Don't enforce limits if we can't fetch them
    }

    const maxRom = user.max_rom || 200; // Default to 200 MB if not set

    // ROM check (per user)
    const totalROM = getUserTotalROM(user.auth_id);
    if (totalROM > maxRom) {
        console.warn(`⚠️ ROM usage for user ${phoneNumber} (authId: ${user.auth_id}) exceeds the limit (${totalROM} MB > ${maxRom} MB). Deleting saved media...`);
        // Delete all saved media for this user
        const { mediaStore } = require('../../utils/globalStore');
        for (const [msgId, media] of mediaStore.entries()) {
            // If you can identify media by authId or phoneNumber, delete only theirs
            mediaStore.delete(msgId);
        }
        // Optionally, clear groupMessages, antideleteStore, etc. for this user
    }
};

/**
 * Calculate total ROM (all memory used by a user's bots, messages, media, etc.)
 * @param {string} authId - The user's authId
 * @returns {number} - Total memory in MB
 */
const getUserTotalROM = (authId) => {
    // 1. Sum all session memory for this user's bots
    const sessions = Array.from(memoryStore.values()).filter(s => s.authId === authId);
    let totalBytes = sessions.reduce((sum, session) => sum + calculateObjectSize(session), 0);

    // 2. Add all group messages for this user's bots
    const { groupMessages, mediaStore } = require('../../utils/globalStore');
    sessions.forEach(session => {
        const phoneNumber = session.phoneNumber;
        // Group messages
        for (const [jid, msgs] of Object.entries(groupMessages)) {
            if (msgs.some(m => m.key?.participant?.includes(phoneNumber) || m.key?.remoteJid?.includes(phoneNumber))) {
                totalBytes += calculateObjectSize(msgs);
            }
        }
    });

    // 3. Add all media for this user's bots
    for (const [msgId, media] of mediaStore.entries()) {
        // If you store phoneNumber or authId in media, filter by that
        // Otherwise, skip or estimate
        totalBytes += calculateObjectSize(media);
    }

    // 4. Add antideleteStore, etc. as needed

    return +(totalBytes / (1024 * 1024)).toFixed(2); // MB
};

/**
 * Get the uptime for a specific bot session.
 * @param {string} phoneNumber - The phone number of the session.
 * @returns {string} - The uptime in the format "Xh Ym Zs" or "N/A" if not available.
 */
const getUptime = (phoneNumber) => {
    const { botInstances } = require('../../utils/globalStore');
    console.log('getUptime called with:', phoneNumber, 'botInstances keys:', Object.keys(botInstances));
    const instance = botInstances[phoneNumber];
    if (!instance || !instance.startTime) return 'N/A';

    const uptimeInSeconds = Math.floor((Date.now() - instance.startTime) / 1000);
    const hours = Math.floor(uptimeInSeconds / 3600);
    const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
    const seconds = uptimeInSeconds % 60;
    console.log(`Uptime for ${phoneNumber}: ${hours}h ${minutes}m ${seconds}s`);
    return `${hours}h ${minutes}m ${seconds}s`;
};

/**
 * Get the last active time for a specific bot session.
 * @param {string} phoneNumber - The phone number of the session.
 * @returns {string} - The last active timestamp in ISO format or "N/A" if not available.
 */
const getLastActive = (phoneNumber) => {
    const { botInstances } = require('../../utils/globalStore');
    const instance = botInstances[phoneNumber];
    return instance?.lastActive || 'N/A';
};

/**
 * Update the last active time for a specific bot session.
 * @param {string} phoneNumber - The phone number of the session.
 */
const updateLastActive = (phoneNumber) => {
    const { botInstances } = require('../../utils/globalStore');
    const instance = botInstances[phoneNumber];
    if (instance) {
        instance.lastActive = new Date().toISOString();
    }
};

/**
 * Get the version of the bot.
 * @returns {string} - The bot version.
 */
const getVersion = () => {
    return process.env.BOT_VERSION || '1.0.0'; // Fetch from environment variable or use a default value
};


module.exports = {
    calculateObjectSize,
    enforceMemoryLimit,
    getUserTotalROM,
    getUptime,
    getLastActive,
    getVersion,
    updateLastActive
};