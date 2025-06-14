const fs = require('fs');
const path = require('path');
const env = require('../utils/loadEnv'); // Import environment variables
const supabase = require('../supabaseClient'); // Import Supabase client

/**
 * Fetch group metadata.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} groupId - The group ID.
 * @returns {Promise<object>} - The group metadata.
 */
const fetchGroupMetadata = async (sock, groupId) => {
    try {
        const groupMetadata = await sock.groupMetadata(groupId);
        console.log(`✅ Fetched metadata for group: ${groupId}`);
        return groupMetadata;
    } catch (error) {
        console.error(`❌ Failed to fetch metadata for group: ${groupId}`, error);
        throw error;
    }
};

async function getGroupOwner(sock, groupId) {
    const metadata = await sock.groupMetadata(groupId);
    // WhatsApp group owner is usually in the 'owner' field, fallback to first superadmin/admin
    return metadata.owner || (metadata.participants.find(p => p.admin === 'superadmin')?.id) || (metadata.participants.find(p => p.admin)?.id) || 'Unknown';
}

/**
 * Get all participants in a group.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} groupId - The group ID.
 * @returns {Promise<string[]>} - An array of participant IDs.
 */
const getGroupParticipants = async (sock, groupId) => {
    try {
        const groupMetadata = await fetchGroupMetadata(sock, groupId);
        const participants = groupMetadata.participants.map((p) => p.id);
        console.log(`✅ Fetched participants for group: ${groupId}`);
        return participants;
    } catch (error) {
        console.error(`❌ Failed to fetch participants for group: ${groupId}`, error);
        throw error;
    }
};

/**
 * Get all admins in a group.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} groupId - The group ID.
 * @returns {Promise<string[]>} - An array of admin IDs.
 */
const getGroupAdmins = async (sock, groupId) => {
    try {
        const groupMetadata = await sock.groupMetadata(groupId); // Fetch group metadata

        // Filter participants with admin or superadmin roles
        const admins = groupMetadata.participants
            .filter(participant => participant.admin === 'admin' || participant.admin === 'superadmin')
            .map(participant => participant.id);

        return admins;
    } catch (error) {
        console.error(`❌ Failed to fetch group admins for group ${groupId}:`, error);
        return [];
    }
};


/**
 * Get the group name.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} groupId - The group ID.
 * @returns {Promise<string>} - The group name.
 */
const getGroupName = async (sock, groupId) => {
    try {
        const groupMetadata = await fetchGroupMetadata(sock, groupId);
        return groupMetadata.subject; // Group name
    } catch (error) {
        console.error(`❌ Failed to fetch group name for group: ${groupId}`, error);
        throw error;
    }
};

/**
 * Get the bot owner's name from the `users` table in the database.
 * @param {string} instanceId - The bot instance ID (used to fetch the bot owner's name).
 * @returns {Promise<string>} - The bot owner's name.
 */
const getBotOwnerName = async (instanceId) => {
    try {
        // Query the `users` table to fetch the bot owner's name
        const { data, error } = await supabase
            .from('users')
            .select('name')
            .or(`id.eq.${instanceId},lid.eq.${instanceId}`)
            .single(); // Fetch a single matching record

        if (error) {
            console.error(`❌ Failed to fetch bot owner name for instance: ${instanceId}`, error);
            return 'Unknown User';
        }

        if (data && data.name) {
            console.log(`✅ Bot owner name fetched from database: ${data.name}`);
            return data.name;
        }

        console.warn(`⚠️ No bot owner name found in database for instance: ${instanceId}`);
        return 'Unknown User';
    } catch (err) {
        console.error(`❌ Unexpected error while fetching bot owner name for instance: ${instanceId}`, err);
        return 'Unknown User';
    }
};

module.exports = {
    fetchGroupMetadata,
    getGroupParticipants,
    getGroupAdmins,
    getGroupName,
    getBotOwnerName,
    getGroupOwner,
};