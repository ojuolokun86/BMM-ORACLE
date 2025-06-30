const { initAuthCreds, BufferJSON, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { saveSessionToSupabase, loadSessionFromSupabase } = require('./models/supabaseAuthState');
const pino = require('pino');

async function useSupabaseAuthState(phoneNumber, authId) {
    // Try loading from Supabase
    let sessionData = await loadSessionFromSupabase(phoneNumber);

    if (!sessionData || !sessionData.creds || !sessionData.keys) {
        // No valid session, create fresh creds
        sessionData = { creds: initAuthCreds(), keys: {}, authId };
        console.log(`🆕 New session created for ${phoneNumber}`);
    } else {
        sessionData.authId = authId;
        console.log(`🔁 Loaded existing session for ${phoneNumber}`);
    }

    // Wrap keys in cacheable memory store
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

                // Save immediately to Supabase
                await saveSessionToSupabase(phoneNumber, {
                    creds: sessionData.creds,
                    keys: sessionData.keys,
                    authId
                });
            }
        },
        pino({ level: 'fatal' }) // minimal logging
    );

    return {
        state: {
            creds: sessionData.creds,
            keys: wrappedKeys
        },
        saveCreds: async () => {
            await saveSessionToSupabase(phoneNumber, {
                creds: sessionData.creds,
                keys: sessionData.keys,
                authId
            });
        }
    };
}

module.exports = { useSupabaseAuthState };
