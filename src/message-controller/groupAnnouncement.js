const supabase = require('../supabaseClient'); // Import Supabase client
const { sendToChat } = require('../utils/messageUtils'); // Import the sendToChat function
const { announcementIntervals } = require('../utils/globalStore'); 

/**
 * Start an announcement in a group for a specific bot instance.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} groupId - The group ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @param {string} interval - The interval for the announcement (e.g., "h1 m30 s0").
 * @param {string} message - The announcement message.
 */
const startAnnouncement = async (sock, groupId, botInstanceId, interval, message) => {
    try {
        // Parse the interval into milliseconds
        const timeParts = interval.match(/h(\d+)|m(\d+)|s(\d+)/g) || [];
        const hours = parseInt(timeParts.find((t) => t.startsWith('h'))?.slice(1) || '0', 10);
        const minutes = parseInt(timeParts.find((t) => t.startsWith('m'))?.slice(1) || '0', 10);
        const seconds = parseInt(timeParts.find((t) => t.startsWith('s'))?.slice(1) || '0', 10);

        // Validate the interval
        if (hours === 0 && minutes === 0 && seconds === 0) {
            throw new Error('Invalid interval. Please specify a valid time (e.g., h1 m30 s0).');
        }

        const intervalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

        console.log(`🔍 Parsed interval: ${hours} hours, ${minutes} minutes, ${seconds} seconds (${intervalMs} ms)`);

        // Save the announcement to the database
        const { error } = await supabase
            .from('announcements')
            .upsert(
                { group_id: groupId, bot_instance_id: botInstanceId, interval: intervalMs, message },
                { onConflict: ['group_id', 'bot_instance_id'] }
            );

        if (error) {
            console.error(`❌ Failed to save announcement for group ${groupId} and bot instance ${botInstanceId}:`, error);
            throw error;
        }

        console.log(`✅ Announcement saved for group ${groupId} and bot instance ${botInstanceId}. Starting announcements...`);

        // Start the announcement interval
        const intervalId = setInterval(async () => {
            console.log(`📢 Sending announcement to group ${groupId} by bot instance ${botInstanceId}: ${message}`);
            await sendToChat(sock, groupId, { message });
        }, intervalMs);

        // Store the intervalId in memory (not in the database)
       
        global.announcementIntervals[`${groupId}_${botInstanceId}`] = intervalId;

        console.log(`✅ Announcement started for group ${groupId} and bot instance ${botInstanceId} with interval ${intervalMs}ms.`);
    } catch (error) {
        console.error(`❌ Failed to start announcement for group ${groupId} and bot instance ${botInstanceId}:`, error);
    }
};

/**
 * Stop an announcement in a group for a specific bot instance.
 * @param {string} groupId - The group ID.
 * @param {string} botInstanceId - The bot instance ID.
 */
const stopAnnouncement = async (groupId, botInstanceId) => {
    try {
        // Remove the announcement from the database
        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('group_id', groupId)
            .eq('bot_instance_id', botInstanceId);

        if (error) {
            console.error(`❌ Failed to delete announcement for group ${groupId} and bot instance ${botInstanceId}:`, error);
            throw error;
        }

        console.log(`✅ Announcement deleted for group ${groupId} and bot instance ${botInstanceId}.`);

        // Clear the interval from memory
        const intervalKey = `${groupId}_${botInstanceId}`;
        if (global.announcementIntervals && global.announcementIntervals[intervalKey]) {
            clearInterval(global.announcementIntervals[intervalKey]);
            delete global.announcementIntervals[intervalKey];
            console.log(`✅ Announcement interval cleared for group ${groupId} and bot instance ${botInstanceId}.`);
        } else {
            console.log(`ℹ️ No active announcement interval found for group ${groupId} and bot instance ${botInstanceId}.`);
        }
    } catch (error) {
        console.error(`❌ Failed to stop announcement for group ${groupId} and bot instance ${botInstanceId}:`, error);
    }
};

module.exports = { startAnnouncement, stopAnnouncement };