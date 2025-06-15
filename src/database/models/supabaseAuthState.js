const supabase = require('../../supabaseClient');
const { BufferJSON } = require('@whiskeysockets/baileys');
const { botInstances } = require('../../utils/globalStore');
const memory = require('./memory'); // <-- Add this at the top
require('dotenv').config();
const SERVER_ID = process.env.SERVER_ID; // Set this in your .env, e.g. SERVER_ID=flyio

console.log('Supabase Auth State loaded successfully ✅');

/**
 * Save session to Supabase.
 */
const saveSessionToSupabase = async (phoneNumber, sessionData) => {
    try {
        if (!sessionData.creds || typeof sessionData.creds !== 'object') {
            console.warn(`⚠️ Skipping save for ${phoneNumber}: Missing or invalid creds.`);
            return;
        }
        if (!sessionData.keys || typeof sessionData.keys !== 'object') {
            console.warn(`⚠️ Skipping save for ${phoneNumber}: Missing or invalid keys.`);
            return;
        }
        if (!sessionData.authId) {
            console.warn(`⚠️ Missing authId for ${phoneNumber}. Saving anyway.`);
        }

        const serializedCreds = JSON.stringify(sessionData.creds, BufferJSON.replacer);
        const serializedKeys = {};
        for (const keyType in sessionData.keys) {
            serializedKeys[keyType] = {};
            for (const keyId in sessionData.keys[keyType]) {
                serializedKeys[keyType][keyId] = JSON.stringify(sessionData.keys[keyType][keyId], BufferJSON.replacer);
            }
        }

        const { data, error } = await supabase
            .from('sessions')
            .upsert({
                phoneNumber,
                authId: sessionData.authId,
                creds: serializedCreds,
                keys: JSON.stringify(serializedKeys),
                server_id: SERVER_ID // Always set server_id to this bot's ID
            });

        if (data && data.length > 0) {
            console.log(`✅ Session saved to Supabase for ${phoneNumber}, data:`, data);
        }
        if (error) {
            throw new Error(error.message);
        }
    } catch (error) {
        console.error(`❌ Failed to save session to Supabase for ${phoneNumber}:`, error.message);
    }
};

/**
 * Load session from Supabase (only if assigned to this server).
 */
const loadSessionFromSupabase = async (phoneNumber) => {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('creds, keys, server_id')
            .eq('phoneNumber', phoneNumber)
            .eq('server_id', SERVER_ID)
            .single();
        console.log(`🔍 Session loaded from Supabase: ${SERVER_ID},`);
        if (error) {
            if (error.code === 'PGRST116') {
                console.log(`⚠️ No session found for ${phoneNumber} on this server`);
                return null;
            }
            throw new Error(error.message);
        }

        if (data.server_id !== SERVER_ID) {
            console.warn(`⚠️ Session for ${phoneNumber} is not assigned to this server (${SERVER_ID}).`);
            return null;
        }

        const creds = JSON.parse(data.creds, BufferJSON.reviver);
        const keys = typeof data.keys === 'string'
            ? JSON.parse(data.keys, BufferJSON.reviver)
            : data.keys;
         if (!creds.registered) creds.registered = true;

        if (!creds || !keys) {
            throw new Error(`Invalid session data for ${phoneNumber}`);
        }

       

        console.log(`✅ Session loaded from Supabase for ${phoneNumber}`);
        return { creds, keys };
    } catch (error) {
        console.error(`❌ Could not load session for ${phoneNumber}:`, error.message);
        return null;
    }
};

/**
 * Delete session from Supabase (only if assigned to this server).
 */
const deleteSessionFromSupabase = async (phoneNumber) => {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .delete()
            .eq('phoneNumber', phoneNumber)
            .eq('server_id', SERVER_ID);

        if (error) {
            throw new Error(error.message);
        }

        if (data && data.length > 0) {
            console.log(`✅ Successfully deleted session for ${phoneNumber}`);
        } else {
            console.log(`⚠️ No session found for ${phoneNumber} on this server. Nothing was deleted.`);
        }
    } catch (error) {
        console.error(`❌ Could not delete session for ${phoneNumber}:`, error.message);
    }
};

/**
 * List all session phone numbers assigned to this server.
 */
const listSessionsFromSupabase = async () => {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('phoneNumber, authId')
            .eq('server_id', SERVER_ID);

        if (error) {
            throw new Error(error.message);
        }

        if (!data || data.length === 0) {
            console.log('⚠️ No sessions found in Supabase for this server.');
            return [];
        }

        console.log('🔍 Sessions fetched from Supabase:', data);
        return data.map((session) => ({
            phoneNumber: session.phoneNumber || 'Unknown',
            authId: session.authId || null,
            active: !!botInstances[session.phoneNumber],
        }));
    } catch (error) {
        console.error('❌ Could not list sessions:', error.message);
        return [];
    }
};

/**
 * Sync all in-memory sessions to Supabase.
 */
const syncMemoryToSupabase = async () => {
    try {
        const sessions = memory.getAllSessionsFromMemory();
        for (const session of sessions) {
            if (!session.phoneNumber) {
                console.warn('⚠️ Skipping session with undefined phone number.');
                continue;
            }
            await saveSessionToSupabase(session.phoneNumber, session);
        }
        console.log(`✅ Synced ${sessions.length} sessions from memory to Supabase.`);
    } catch (error) {
        console.error('❌ Failed to sync memory to Supabase:', error.message);
    }
};

/**
 * Load all sessions from Supabase into memory (only those assigned to this server).
 */
const loadAllSessionsFromSupabase = async () => {
    try {
        const { data, error } = await supabase.from('sessions').select('*').eq('server_id', SERVER_ID);
        if (error) throw new Error(error.message);

        const validSessions = data
            .map((session) => {
                try {
                    if (!session.phoneNumber || !session.creds || !session.keys) return null;
                    const creds = JSON.parse(session.creds, BufferJSON.reviver);
                    const keys = JSON.parse(session.keys, BufferJSON.reviver);
                    return { phoneNumber: session.phoneNumber, authId: session.authId, creds, keys };
                } catch { return null; }
            })
            .filter(Boolean);

        memory.loadSessionsToMemory(validSessions);
        console.log(`✅ Loaded ${validSessions.length} valid sessions into memory.`);

        // Start all sessions in parallel for speed
        const { getSocketInstance } = require('../../server/socket');
        const io = getSocketInstance();
        const { startNewSession } = require('../../users/userSession');
        await Promise.all(validSessions.map(async (session) => {
            if (botInstances[session.phoneNumber]) return;
            try {
                await startNewSession(session.phoneNumber, io, session.authId);
            } catch (err) {
                console.error(`❌ Failed to start session for ${session.phoneNumber}:`, err.message);
            }
        }));
    } catch (error) {
        console.error('❌ Failed to load sessions from Supabase:', error.message);
    }
};

/**
 * Check if a session exists in Supabase for a given phone number (on this server).
 * @returns {boolean}
 */
const sessionExistsInDB = async (phoneNumber) => {
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('phoneNumber')
            .eq('phoneNumber', phoneNumber)
            .eq('server_id', SERVER_ID)
            .single();
        if (error && error.code !== 'PGRST116') {
            throw new Error(error.message);
        }
        return !!data;
    } catch (error) {
        console.error(`❌ Error checking session existence for ${phoneNumber}:`, error.message);
        return false;
    }
};

module.exports = {
    sessionExistsInDB,
    saveSessionToSupabase,
    loadSessionFromSupabase,
    deleteSessionFromSupabase,
    listSessionsFromSupabase,
    syncMemoryToSupabase,
    loadAllSessionsFromSupabase,
};