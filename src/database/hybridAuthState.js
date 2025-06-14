const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const memory = require('./models/memory'); // In-memory session management
const { saveSessionToSupabase } = require('./models/supabaseAuthState'); // Supabase sync
const { auth } = require('../supabaseClient');
const { deleteUser } = require('./userDatabase');

/**
 * Validate session data integrity.
 * @param {Object} data - The session data to validate.
 */
const validateSessionData = (data) => {
    if (!data || typeof data !== 'object') throw new Error('Invalid session data: Not an object');
    if (!data.creds || !data.creds.me || !data.creds.me.id) throw new Error('Invalid session data: Missing credentials');
    if (!data.keys || typeof data.keys !== 'object') throw new Error('Invalid session data: Missing keys');
};

/**
 * Use hybrid auth state with in-memory storage and Supabase sync.
 * @param {string} phoneNumber - The phone number for the session.
 * @returns {Object} - The session state and saveCreds function.
 */
async function useHybridAuthState(phoneNumber, authId) {
    let sessionData = memory.getSessionFromMemory(phoneNumber);

    // If session exists and is valid, use it
    if (sessionData && sessionData.creds && sessionData.creds.me && sessionData.creds.me.id) {
        // Deserialize keys if needed
        try {
            const deserializedKeys = {};
            for (const keyType in sessionData.keys) {
                deserializedKeys[keyType] = {};
                for (const keyId in sessionData.keys[keyType]) {
                    const rawValue = sessionData.keys[keyType][keyId];
                    deserializedKeys[keyType][keyId] =
                        typeof rawValue === 'string'
                            ? JSON.parse(rawValue, BufferJSON.reviver)
                            : rawValue;
                }
            }
            sessionData.keys = deserializedKeys;
            sessionData.authId = authId;
        } catch (error) {
            console.error(`❌ Failed to deserialize keys for ${phoneNumber}:`, error.message);
            throw error;
        }
    } else {
        // No valid session: create a new one, but DO NOT SAVE YET
        console.log(`⚠️ No valid session for ${phoneNumber}. Creating new session (not saving until paired).`);
        sessionData = { creds: initAuthCreds(), keys: {}, authId };
        // Do NOT save to memory or Supabase yet!
    }

    return {
        state: {
            creds: sessionData.creds,
            keys: {
                get: async (type, ids) => {
                    const result = {};
                    if (sessionData.keys[type]) {
                        for (const id of ids) {
                            if (sessionData.keys[type][id]) {
                                result[id] = sessionData.keys[type][id];
                            }
                        }
                    }
                    return result;
                },
                set: async (data) => {
                    for (const category in data) {
                        if (!sessionData.keys[category]) sessionData.keys[category] = {};
                        for (const id in data[category]) {
                            sessionData.keys[category][id] = data[category][id];
                        }
                    }
                    // Do NOT save to memory/Supabase here!
                },
            },
        },
        saveCreds: async () => {
            try {
                // Only save if creds are valid (paired/connected)
                if (sessionData.creds && sessionData.creds.me && sessionData.creds.me.id) {
                    // Serialize keys for memory and Supabase
                    const serializedKeys = {};
                    for (const keyType in sessionData.keys) {
                        serializedKeys[keyType] = {};
                        for (const keyId in sessionData.keys[keyType]) {
                            serializedKeys[keyType][keyId] = JSON.stringify(sessionData.keys[keyType][keyId], BufferJSON.replacer);
                        }
                    }

                    // Save serialized session data to memory
                    memory.saveSessionToMemory(phoneNumber, {
                        creds: sessionData.creds,
                        keys: serializedKeys
                    }, authId);

                    // Save serialized session data to Supabase
                    await saveSessionToSupabase(phoneNumber, {
                        creds: sessionData.creds,
                        keys: serializedKeys,
                        authId,
                    });
                } else {
                    // Not paired yet, do not save!
                    // Optionally, log or warn here
                }
            } catch (err) {
                console.error(`❌ Failed to save credentials for ${phoneNumber}:`, err.message);
            }
        },
    };
}

module.exports = { useHybridAuthState };
