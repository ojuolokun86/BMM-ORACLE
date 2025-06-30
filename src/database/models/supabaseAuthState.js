const supabase = require('../../supabaseClient');
const { BufferJSON } = require('@whiskeysockets/baileys');
const { botInstances } = require('../../utils/globalStore');
require('dotenv').config();

const SERVER_ID = process.env.SERVER_ID;
console.log('✅ Supabase Auth State loaded successfully');

/**
 * Save session to Supabase.
 */
const saveSessionToSupabase = async (phoneNumber, sessionData) => {
    try {
        if (!sessionData.creds || typeof sessionData.creds !== 'object') {
            console.warn(`⚠️ Skipping save for ${phoneNumber}: Invalid creds`);
            return;
        }
        if (!sessionData.keys || typeof sessionData.keys !== 'object') {
            console.warn(`⚠️ Skipping save for ${phoneNumber}: Invalid keys`);
            return;
        }

        const creds = JSON.stringify(sessionData.creds, BufferJSON.replacer);
        const serializedKeys = {};

        for (const category in sessionData.keys) {
            serializedKeys[category] = {};
            for (const id in sessionData.keys[category]) {
                serializedKeys[category][id] = JSON.stringify(sessionData.keys[category][id], BufferJSON.replacer);
            }
        }

        const { error } = await supabase
            .from('sessions')
            .upsert({
                phoneNumber,
                authId: sessionData.authId,
                creds,
                keys: JSON.stringify(serializedKeys),
                server_id: SERVER_ID,
            });

        if (error) throw new Error(error.message);
        console.log(`✅ Session saved to Supabase for ${phoneNumber}`);
    } catch (err) {
        console.error(`❌ Failed to save session for ${phoneNumber}:`, err.message);
    }
};

/**
 * Load session from Supabase.
 */
const loadSessionFromSupabase = async (phoneNumber) => {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('creds, keys, server_id, authId') // <-- add authId here
            .eq('phoneNumber', phoneNumber)
            .eq('server_id', SERVER_ID)
            .single();

        if (error?.code === 'PGRST116') {
            console.log(`⚠️ No session found for ${phoneNumber} on this server`);
            return null;
        }
        if (error) throw new Error(error.message);
        if (!data) return null;

        const creds = JSON.parse(data.creds, BufferJSON.reviver);
        const rawKeys = JSON.parse(data.keys);
        const keys = {};

        for (const category in rawKeys) {
            keys[category] = {};
            for (const id in rawKeys[category]) {
                try {
                    keys[category][id] = JSON.parse(rawKeys[category][id], BufferJSON.reviver);
                } catch (e) {
                    console.warn(`⚠️ Failed to parse key ${category}/${id}:`, e.message);
                }
            }
        }
        console.log(`Loaded authId for ${phoneNumber}:`, data.authId);
        return { creds, keys, authId: data.authId };
        
    } catch (err) {
        console.error(`❌ Could not load session for ${phoneNumber}:`, err.message);
        return null;
    }
};

/**
 * Delete session from Supabase.
 */
const deleteSessionFromSupabase = async (phoneNumber) => {
    try {
        const { error } = await supabase
            .from('sessions')
            .delete()
            .eq('phoneNumber', phoneNumber)
            .eq('server_id', SERVER_ID);

        if (error) throw new Error(error.message);
        console.log(`✅ Session deleted for ${phoneNumber}`);
    } catch (err) {
        console.error(`❌ Could not delete session for ${phoneNumber}:`, err.message);
    }
};

/**
 * List all sessions for current server.
 */
const listSessionsFromSupabase = async () => {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('phoneNumber, authId')
            .eq('server_id', SERVER_ID);

        if (error) throw new Error(error.message);
        if (!data || data.length === 0) return [];

        return data.map(session => ({
            phoneNumber: session.phoneNumber,
            authId: session.authId, // <-- Make sure this is not null in your DB!
            active: !!botInstances[session.phoneNumber],
        }));
    } catch (err) {
        console.error('❌ Failed to list sessions:', err.message);
        return [];
    }
};

/**
 * Load all sessions and restart bots.
 */
const loadAllSessionsFromSupabase = async () => {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('server_id', SERVER_ID);

        if (error) throw new Error(error.message);
        if (!data || data.length === 0) return;

        const valid = [];

        for (const session of data) {
            try {
                const creds = JSON.parse(session.creds, BufferJSON.reviver);
                const keysRaw = JSON.parse(session.keys);
                const keys = {};
                for (const category in keysRaw) {
                    keys[category] = {};
                    for (const id in keysRaw[category]) {
                        keys[category][id] = JSON.parse(keysRaw[category][id], BufferJSON.reviver);
                    }
                }
                valid.push({ phoneNumber: session.phoneNumber, authId: session.authId, creds, keys });
            } catch (e) {
                console.warn(`❌ Failed to parse session for ${session.phoneNumber}:`, e.message);
            }
        }

        const { getSocketInstance } = require('../../server/socket');
        const { startNewSession } = require('../../users/userSession');
        const io = getSocketInstance();

        await Promise.all(valid.map(async session => {
            if (!botInstances[session.phoneNumber]) {
                try {
                    await startNewSession(session.phoneNumber, io, session.authId);
                } catch (e) {
                    console.error(`❌ Failed to start ${session.phoneNumber}:`, e.message);
                }
            }
        }));

        console.log(`✅ Loaded ${valid.length} sessions from Supabase`);
    } catch (err) {
        console.error('❌ Could not load sessions:', err.message);
    }
};

/**
 * Check if session exists.
 */
const sessionExistsInDB = async (phoneNumber) => {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('phoneNumber')
            .eq('phoneNumber', phoneNumber)
            .eq('server_id', SERVER_ID)
            .single();

        if (error?.code === 'PGRST116') return false;
        if (error) throw new Error(error.message);

        return !!data;
    } catch (err) {
        console.error(`❌ Error checking session for ${phoneNumber}:`, err.message);
        return false;
    }
};

module.exports = {
    saveSessionToSupabase,
    loadSessionFromSupabase,
    deleteSessionFromSupabase,
    listSessionsFromSupabase,
    loadAllSessionsFromSupabase,
    sessionExistsInDB,
};
