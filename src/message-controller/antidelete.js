const { mediaStore } = require('../utils/globalStore'); // Import the mediaStore
const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // Import media download function
const { deleteFileFromSupabase } = require('../utils/supabaseStorage'); // Import delete function
const DOCUMENTS_BUCKET = 'documents'; // Replace with your Supabase bucket name
const { deletedMessagesByBot } = require('../utils/globalStore');
const supabase = require('../supabaseClient'); // Import the Supabase client
const { saveAntideleteMessage, getAntideleteMessage, deleteAntideleteMessage } = require('../utils/globalStore'); // Import the antidelete functions
const { getBotInstance } = require('../utils/getBotInstance'); // Import the bot instance ID
const { formatResponse } = require('../utils/utils');
const { antideleteCache } = require('../utils/settingsCache');


async function getAntideleteSettingsCached(groupId, botInstanceId) {
    const cacheKey = `${groupId}:${botInstanceId}`;
    const cached = antideleteCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) return cached.data;

    const { data, error } = await supabase
        .from('antidelete_settings')
        .select('is_enabled, is_global')
        .eq('group_id', groupId)
        .eq('bot_instance_id', botInstanceId)
        .maybeSingle();

    antideleteCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}
/**
 * Save a message to memory for antidelete if enabled in Supabase.
 * Call this from msgHandler.js for every incoming text message.
 */
const handleAntideleteSave = async (remoteJid, userId, messageType, messageId, messageContent, isGroup, isFromMe) => {
    if (!(messageType === 'conversation' || messageType === 'extendedTextMessage')) return;

    console.log(`🔍 Msg from me: ${isFromMe}`);
    if (isFromMe) return;

    const botInstanceId = userId;

    const antideleteKey = isGroup ? remoteJid : 'dm';
    const antideleteSetting = await getAntideleteSettingsCached(antideleteKey, botInstanceId);
if (!antideleteSetting?.is_enabled && !(antideleteSetting?.is_global && !isGroup)) {
    console.log(`❌ Antidelete is disabled for chat ${remoteJid} and bot instance ${botInstanceId}. Skipping restore.`);
    return;
}

    if (antideleteSetting?.is_enabled || (antideleteSetting?.is_global && !isGroup)) {
        saveAntideleteMessage(remoteJid, messageId, messageContent);
        console.log(`🔍 Antidelete message saved for chat ${remoteJid}: ${messageContent}`);
    }
};

/**
 * Handle restoring deleted text messages.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {object} message - The deleted message object.
 * @param {string} botInstanceId - The bot instance ID.
 */
const handleAntidelete = async (sock, message, botInstanceId) => {
    const remoteJid = message.key.remoteJid; // Chat ID
    const isGroup = remoteJid.endsWith('@g.us'); // Check if the chat is a group
    const deletedMessageId = message.message?.protocolMessage?.key?.id; // ID of the deleted message
    const protocolMessageType = message.message?.protocolMessage?.type;
    const botLid = sock.user?.lid ? sock.user.lid.split(':')[0].split('@')[0] : null;
    const botId = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : null;
    const realBotInstanceId = botInstanceId && botLid && botId; // Use the provided bot instance ID or the bot's LID

    if (protocolMessageType !== 0) {
        console.log(`ℹ️ Message is not a deleted message. Ignoring.`);
        return;
    }

    // Check if the message was deleted by the same bot instance
    if (
    (botLid && deletedMessagesByBot[botLid] && deletedMessagesByBot[botLid].has(deletedMessageId)) ||
    (botId && deletedMessagesByBot[botId] && deletedMessagesByBot[botId].has(deletedMessageId))
) {
    console.log(`⚠️ Ignoring message ${deletedMessageId} deleted by bot instance (id: ${botId}, lid: ${botLid}).`);
    return;
}

    const botLidJid = botLid ? `${botLid}@lid` : null;
        const botIdJid = botId ? `${botId}@s.whatsapp.net` : null;

        let deletedBy;
        if (isGroup) {
            deletedBy = message.key.participant || remoteJid;
        } else {
            deletedBy = message.key.fromMe ? (botLidJid || botIdJid) : remoteJid;
        }

        if (deletedBy === botLidJid || deletedBy === botIdJid) {
            console.log(`⚠️ Message deleted by the bot instance (${deletedBy}). Skipping restore.`);
            return;
        }
    // Fetch antidelete settings
    const antideleteKey = isGroup ? remoteJid : 'dm'; // Use 'dm' for direct messages
    const { data: antideleteSetting, error: fetchError } = await supabase
        .from('antidelete_settings')
        .select('is_enabled, is_global')
        .eq('group_id', antideleteKey)
        .eq('bot_instance_id', botInstanceId)
        .single();

    if (fetchError || (!antideleteSetting?.is_enabled && !(antideleteSetting?.is_global && !isGroup))) {
        console.log(`❌ Antidelete is disabled for chat ${remoteJid} and bot instance ${botInstanceId}. Skipping restore.`);
        return;
    }

    // Log the query parameters
    console.log(`🔍 Query Parameters:
        - Chat ID: ${remoteJid}
        - Message ID: ${deletedMessageId}
        - Bot Instance ID: ${botInstanceId}
    `);

    
    
   
    // Check if the deleted message exists in the media store
    const mediaData = mediaStore.get(deletedMessageId);
    if (mediaData) {
        console.log(`✅ Media file found in memory for message ID: ${deletedMessageId}`);

        // Map the `messageType` to valid types for `sendMessage`
        const validMediaTypes = {
            imageMessage: 'image',
            videoMessage: 'video',
            documentMessage: 'document',
            audioMessage: 'audio', // Add support for audio files
            voiceMessage: 'audio', // Add support for voice notes
        };

       
        const resolvedMediaType = validMediaTypes[mediaData.messageType];
        if (!resolvedMediaType) {
            console.error(`❌ Unsupported media type: ${mediaData.messageType}`);
            return;
        }

        // Format the deletion time
        const deletionTime = new Date().toLocaleString(); // Current time when the message was deleted
        const deletedByUser = deletedBy.split('@')[0]; // Extract the user ID
        
        // Restore the media file
        try {
            await sock.sendMessage(remoteJid, {
                text: `♻️ Restored deleted file:\n\n*File Content:* ${mediaData.caption || 'No caption'}\n\n*Deleted By:* @${deletedByUser}\n*Deleted At:* ${deletionTime}`,
                mentions: [deletedBy],
            });

            await sock.sendMessage(remoteJid, {
                [resolvedMediaType]: mediaData.buffer,
                caption: mediaData.caption || '',
            });

            console.log(`✅ Restored media file for message ID: ${deletedMessageId}`);
        } catch (error) {
            console.error(`❌ Failed to restore media file for message ID: ${deletedMessageId}`, error);
        }

        // Remove the restored media from the store to free memory
        mediaStore.delete(deletedMessageId);
        console.log(`✅ Media file removed from memory for message ID: ${deletedMessageId}`);
   return;
}
const msg = getAntideleteMessage(remoteJid, deletedMessageId);
if (msg) {
    const deletionTime = new Date().toLocaleString();
    const deletedByUser = deletedBy.split('@')[0];
    // Format the restored message with BMM BOT tag and owner name
    const restoreText = `♻️ Restored deleted message:\n\n*Message Content:* ${msg.content}\n\n*Deleted By:* @${deletedByUser}\n*Deleted At:* ${deletionTime}`;
    const formattedRestoreText = await formatResponse(sock, restoreText);

    await sock.sendMessage(remoteJid, {
        text: formattedRestoreText,
        mentions: [deletedBy],
    });
    deleteAntideleteMessage(remoteJid, deletedMessageId);
    console.log(`✅ Restored and removed message from memory for message ID: ${deletedMessageId}`);
} else {
    console.log(`❌ Deleted message not found in memory for message ID: ${deletedMessageId}`);
}};

/**
 * Enable or disable antidelete globally for DMs.
 * @param {string} botInstanceId - The bot instance ID.
 * @param {boolean} isEnabled - Whether to enable or disable antidelete globally for DMs.
 */
const setGlobalAntideleteForDMs = async (botInstanceId, isEnabled) => {
    try {
        const { error } = await supabase
            .from('antidelete_settings')
            .upsert(
                { group_id: 'dm', bot_instance_id: botInstanceId, is_global: isEnabled },
                { onConflict: ['group_id', 'bot_instance_id'] }
            );

        if (error) {
            console.error(`❌ Failed to set global antidelete for DMs for bot instance ${botInstanceId}:`, error);
            throw error;
        }

        // Update cache immediately
        const cacheKey = `dm:${botInstanceId}`;
        antideleteCache.set(cacheKey, { data: { is_global: isEnabled }, timestamp: Date.now() });

        console.log(`✅ Global antidelete for DMs for bot instance ${botInstanceId} set to ${isEnabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
        console.error(`❌ Error setting global antidelete for DMs for bot instance ${botInstanceId}:`, error);
    }
};

/**
 * Enable or disable antidelete for a specific chat.
 * @param {string} chatId - The group or chat ID.
 * @param {string} botInstanceId - The bot instance ID.
 * @param {boolean} isEnabled - Whether to enable or disable antidelete for the chat.
 */
const setChatAntidelete = async (chatId, botInstanceId, isEnabled) => {
    try {
        const { error } = await supabase
            .from('antidelete_settings')
            .upsert(
                { group_id: chatId, bot_instance_id: botInstanceId, is_enabled: isEnabled },
                { onConflict: ['group_id', 'bot_instance_id'] }
            );

        if (error) {
            console.error(`❌ Failed to set antidelete for chat ${chatId} and bot instance ${botInstanceId}:`, error);
            throw error;
        }

        // Update cache immediately
        const cacheKey = `${chatId}:${botInstanceId}`;
        antideleteCache.set(cacheKey, { data: { is_enabled: isEnabled }, timestamp: Date.now() });

        console.log(`✅ Antidelete for chat ${chatId} and bot instance ${botInstanceId} set to ${isEnabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
        console.error(`❌ Error setting antidelete for chat ${chatId} and bot instance ${botInstanceId}:`, error);
    }
};

// Periodically clear the deletedMessagesByBot store to prevent memory overflow
setInterval(() => {
    for (const botId in deletedMessagesByBot) {
        deletedMessagesByBot[botId].clear();
    }
    console.log('🧹 Cleared deletedMessagesByBot store.');
}, 60 * 60 * 1000); // Clear every hour



module.exports = {
    handleAntidelete,
    setGlobalAntideleteForDMs,
    setChatAntidelete,
    handleAntideleteSave,
};

