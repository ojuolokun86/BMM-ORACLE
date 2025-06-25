const { initAuthCreds, BufferJSON, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const memory = require('./models/memory');
const { saveSessionToSupabase } = require('./models/supabaseAuthState');
const { auth } = require('../supabaseClient');
const { deleteUser } = require('./userDatabase');
const pino = require('pino');

async function useHybridAuthState(phoneNumber, authId) {
    let sessionData = memory.getSessionFromMemory(phoneNumber);

    if (sessionData && sessionData.creds && sessionData.creds.me?.id) {
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
        console.log(`⚠️ No valid session for ${phoneNumber}. Creating new session.`);
        sessionData = { creds: initAuthCreds(), keys: {}, authId };
    }

    // ✅ Wrap keys HERE after sessionData is defined
    const wrappedKeys = makeCacheableSignalKeyStore(
        {
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
            }
        },
        pino({ level: 'fatal' }).child({ level: 'fatal' })
    );

    return {
        state: {
            creds: sessionData.creds,
            keys: wrappedKeys,
        },
        saveCreds: async () => {
            try {
                if (sessionData.creds?.me?.id) {
                    const serializedKeys = {};
                    for (const keyType in sessionData.keys) {
                        serializedKeys[keyType] = {};
                        for (const keyId in sessionData.keys[keyType]) {
                            serializedKeys[keyType][keyId] = JSON.stringify(sessionData.keys[keyType][keyId], BufferJSON.replacer);
                        }
                    }

                    memory.saveSessionToMemory(phoneNumber, {
                        creds: sessionData.creds,
                        keys: serializedKeys
                    }, authId);

                    await saveSessionToSupabase(phoneNumber, {
                        creds: sessionData.creds,
                        keys: serializedKeys,
                        authId,
                    });
                }
            } catch (err) {
                console.error(`❌ Failed to save credentials for ${phoneNumber}:`, err.message);
            }
        },
    };
}

module.exports = { useHybridAuthState };
