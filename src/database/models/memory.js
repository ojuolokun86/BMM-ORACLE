const memoryStore = new Map(); // In-memory storage for sessions
const  supabase  = require('../../supabaseClient'); // Supabase client for database operations
const globalStore = require('../../utils/globalStore');


/**
 * Load all sessions into memory.
 * @param {Array} sessions - Array of sessions from Supabase.
 */
const loadSessionsToMemory = (sessions) => {
    sessions.forEach((session) => {
        memoryStore.set(session.phoneNumber, session);
    });
};

/**
 * Get a session from memory.
 * @param {string} phoneNumber - The phone number of the session.
 * @returns {Object|null} - The session object or null if not found.
 */
const getSessionFromMemory = (phoneNumber) => {
    return memoryStore.get(phoneNumber) || null;
};

/**
 * Save or update a session in memory.
 * @param {string} phoneNumber - The phone number of the session.
 * @param {Object} sessionData - The session data to save.
 */
const saveSessionToMemory = (phoneNumber, sessionData, authId) => {

    // Prevent overwriting existing authId with undefined
    const existing = memoryStore.get(phoneNumber);
    if (existing && !authId && existing.authId) {
        authId = existing.authId;
        console.warn(`⚠️ Recovered missing authId for ${phoneNumber} from existing session.`);
    }

    if (!phoneNumber) {
        console.warn('⚠️ Cannot save session: phoneNumber is undefined.');
        return;
    }

    if (!sessionData || typeof sessionData !== 'object') {
        console.warn(`⚠️ Cannot save session for ${phoneNumber}: Invalid session data.`);
        return;
    }

        if (!sessionData.creds || typeof sessionData.creds !== 'object') {
            console.warn(`⚠️ Cannot save session for ${phoneNumber}: Missing or invalid creds.`);
            return;
        }
        // You can log a warning if creds.me.id is missing, but allow saving anyway
        if (!sessionData.creds.me || !sessionData.creds.me.id) {
            console.warn(`⚠️ Credentials incomplete for ${phoneNumber}. Will complete after login.`);
        }


    if (typeof sessionData.keys !== 'object') {
        console.warn(`⚠️ Cannot save session for ${phoneNumber}: Invalid keys.`);
        return;
    }

    // Set startTime if not already set
    if (!existing?.startTime) {
        sessionData.startTime = Date.now(); // Set the start time when the session is first saved
    } else {
        sessionData.startTime = existing.startTime; // Retain the original start time
    }

    sessionData.authId = authId;
    sessionData.phoneNumber = phoneNumber; // ✅ add this line
    memoryStore.set(phoneNumber, sessionData);

};
/**
 * Delete a session from memory.
 * @param {string} phoneNumber - The phone number of the session.
 */
const deleteSessionFromMemory = (phoneNumber) => {
    if (memoryStore.has(phoneNumber)) {
        memoryStore.delete(phoneNumber);
        console.log(`✅ Session for ${phoneNumber} deleted from memory.`);
    } else {
        console.warn(`⚠️ Session for ${phoneNumber} not found in memory.`);
    }
};
/**
 * Get all sessions from memory.
 * @returns {Array} - Array of all sessions in memory.
 */
const getAllSessionsFromMemory = () => {
    return Array.from(memoryStore.values());
};

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
 * Get memory usage for a specific user session.
 * @param {string} phoneNumber - The phone number of the session.
 * @returns {string|null} - The memory usage in MB or null if the session is not found.
 */
const getSessionMemoryUsage = (phoneNumber) => {
    const session = memoryStore.get(phoneNumber);
    if (!session) return null;

    const sizeInBytes = calculateObjectSize(session);
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2); // Convert to MB
    return `${sizeInMB} MB`;
};

/**
 * Get memory usage for all sessions.
 * @returns {Array} - An array of objects with phone numbers and memory usage.
 */
const getAllSessionsMemoryUsage = () => {
    return Array.from(memoryStore.entries()).map(([phoneNumber, session]) => {
        const sizeInBytes = calculateObjectSize(session);
        const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2); // Convert to MB
        return { phoneNumber, memoryUsage: `${sizeInMB} MB` };
    });
};


/**
 * List all sessions from memory.
 * @returns {Array} - An array of session objects from memory.
 */
const listSessionsFromMemory = () => {
    const sessions = Array.from(memoryStore.entries()).map(([phoneNumber, session]) => ({
        phoneNumber,
         authId: session.authId || null,
        active: !!session, // Check if the session exists
    }));
    return sessions;
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

    const maxRam = user.max_ram || 10; // Default to 10 MB if not set
    const maxRom = user.max_rom || 200; // Default to 200 MB if not set

    // RAM check (per session)
    if (sizeInMB > maxRam) {
        console.warn(`⚠️ RAM usage for user ${phoneNumber} exceeds the limit (${sizeInMB.toFixed(2)} MB > ${maxRam} MB). Offloading session to Supabase...`);
        const { saveSessionToSupabase, } = require('../models/supabaseAuthState');
        await saveSessionToSupabase(phoneNumber, session);
        deleteSessionFromMemory(phoneNumber);
    }

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

setInterval(async () => {
    const sessions = getAllSessionsFromMemory();
    for (const session of sessions) {
        if (!session.phoneNumber) continue;
        await enforceMemoryLimit(session.phoneNumber);
    }
}, 60000); // Check every 60 seconds


/**
 * Get memory usage for all sessions belonging to a specific user.
 * @param {Array} phoneNumbers - Array of phone numbers associated with the user.
 * @returns {Array} - An array of objects with phone numbers and memory usage.
 */
const getUserSessionsMemoryUsage = (phoneNumbers) => {
    return Array.from(memoryStore.entries())
        .filter(([phoneNumber]) => phoneNumbers.includes(phoneNumber)) // Filter sessions by phone numbers
        .map(([phoneNumber, session]) => {
            const sizeInBytes = calculateObjectSize(session);
            const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2); // Convert to MB
            return { phoneNumber, memoryUsage: `${sizeInMB} MB` };
        });
};

/**
 * Get the uptime for a specific bot session.
 * @param {string} phoneNumber - The phone number of the session.
 * @returns {string} - The uptime in the format "Xh Ym Zs" or "N/A" if not available.
 */
const getUptime = (phoneNumber) => {
    const session = memoryStore.get(phoneNumber);
    if (!session || !session.startTime) return 'N/A';

    const uptimeInSeconds = Math.floor((Date.now() - session.startTime) / 1000);
    const hours = Math.floor(uptimeInSeconds / 3600);
    const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
    const seconds = uptimeInSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
};

/**
 * Get the last active time for a specific bot session.
 * @param {string} phoneNumber - The phone number of the session.
 * @returns {string} - The last active timestamp in ISO format or "N/A" if not available.
 */
const getLastActive = (phoneNumber) => {
    const session = memoryStore.get(phoneNumber);
    return session?.lastActive || 'N/A';
};

/**
 * Get the version of the bot.
 * @returns {string} - The bot version.
 */
const getVersion = () => {
    return process.env.BOT_VERSION || '1.0.0'; // Fetch from environment variable or use a default value
};


const updateLastActive = (phoneNumber) => {
    const session = memoryStore.get(phoneNumber);
    if (session) {
        session.lastActive = new Date().toISOString(); // Set the current timestamp
        memoryStore.set(phoneNumber, session);
    }
};
module.exports = {
    loadSessionsToMemory,
    getSessionFromMemory,
    saveSessionToMemory,
    deleteSessionFromMemory,
    getAllSessionsFromMemory,
    calculateObjectSize,
    getSessionMemoryUsage,
    getAllSessionsMemoryUsage,
    listSessionsFromMemory,
    enforceMemoryLimit,
    getUserTotalROM,
    getUserSessionsMemoryUsage,
    getUptime,
    getLastActive,
    getVersion,
    updateLastActive
};