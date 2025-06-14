const { getUserPrefix, getUserPrefixCached } = require('../database/userPrefix'); // Import the prefix functions
const { mediaStore, } = require('../utils/globalStore'); // Import the mediaStore
const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // Import media download function
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { uploadFileToSupabase, deleteFileFromSupabase } = require('./supabaseStorage'); // Import Supabase storage functions
const DOCUMENTS_BUCKET = 'documents'; // Replace with your Supabase bucket name

const PYTHON_SCRIPT_PATH = path.join(__dirname, '../../whisper_transcribe.py'); // Path to the Python script





let handleCommand; // Declare handleCommand as undefined initially

/**
 * Dynamically load the handleCommand function when needed.
 */
const loadHandleCommand = () => {
    console.log('🔄 Attempting to dynamically load handleCommand...');
    if (!handleCommand) {
        try {
            handleCommand = require('../message-controller/cmdHandler').handleCommand; // Dynamically load the handleCommand function
            console.log('✅ handleCommand dynamically loaded successfully');
        } catch (error) {
            console.error('❌ Failed to dynamically load handleCommand:', error);
        }
    } else {
        console.log('ℹ️ handleCommand is already loaded.');
    }
};

/**
 * Handle media files (images, videos, documents, etc.).
 * @param {object} sock - The WhatsApp socket instance.
 * @param {object} message - The message object.
 * @param {string} userId - The bot instance user ID.
 */
const handleMediaFile = async (sock, message, userId) => {
    console.log('🔄 Entering handleMediaFile function...');
    const remoteJid = message.key.remoteJid; // Chat ID
    const sender = message.key.participant || remoteJid; // Sender's ID
    const messageId = message.key.id; // Extract the message ID
    const messageType = Object.keys(message.message || {})[0]; // Get the type of the message (e.g., imageMessage, videoMessage, documentMessage)

    console.log(`📂 Handling media file:
        - Sender: ${sender}
        - Chat ID: ${remoteJid}
        - Message Type: ${messageType || 'undefined'}
        - Bot Instance: ${userId}
    `);

    try {
        // Validate the media type
        const supportedMediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'voiceMessage'];
        if (!supportedMediaTypes.includes(messageType)) {
            console.error(`❌ Unsupported media type: ${messageType}`);
            return;
        }

        if (remoteJid.endsWith("@newsletter")) {
            console.log("🚫 Skipping newsletter message. Media decryption not supported.");
            return;
        }
        

        const mediaMessage = message.message[messageType];
        if (!mediaMessage) {
            console.error('❌ Media message is undefined. Skipping media handling.');
            return;
        }

        // Download the media file
        const buffer = await downloadMediaMessage(message, 'buffer', { logger: console });
        if (!buffer) {
            console.error('❌ Failed to download media file. Buffer is empty.');
            return;
        }

        // Save the media file and metadata to the in-memory store
        mediaStore.set(messageId, {
            chatId: remoteJid,
            messageType,
            buffer,
            caption: mediaMessage.caption || '',
            timestamp: Date.now(),
        });

        console.log(`✅ Media file saved to memory for message ID: ${messageId}`);
        const caption = mediaMessage.caption || ''; // Get the caption if available
        console.log(`📝 Media caption: "${caption}"`);

        // Handle specific media types
        if (messageType === 'audioMessage' || messageType === 'voiceMessage') {
            console.log('🎙️ Received an audio or voice note. Saved to memory.');
        } else if (messageType === 'documentMessage') {
            console.log('📄 Received a document. Saved to memory.');
        } else if (messageType === 'imageMessage') {
            console.log('🖼️ Received an image.');
        } else if (messageType === 'videoMessage') {
            console.log('🎥 Received a video.');
        } else if (messageType === 'stickerMessage') {
            console.log('🎭 Received a sticker.');
        }

        // Fetch the user's prefix
        const userPrefix = await getUserPrefixCached(userId);
        console.log(`🔍 Current prefix for user ${userId}: "${userPrefix}"`);

        // Dynamically load the handleCommand function
        loadHandleCommand();

        // Check if handleCommand is loaded
        if (typeof handleCommand !== 'function') {
            console.error('❌ handleCommand is not a function. Aborting command handling.');
            return;
        }

        // Forward to command handler if needed
        if (caption.startsWith(userPrefix)) {
            console.log('⚙️ Detected command in media caption. Forwarding to cmdHandler...');
            console.log(`🔄 Forwarding message to cmdHandler with caption: "${caption}"`);
            await handleCommand(sock, message, userId);
            console.log('✅ Command successfully forwarded to cmdHandler.');
            return;
        }

        // Check if the message is a reply to another message
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage) {
            console.log('🔄 Detected reply to a message. Forwarding to cmdHandler...');
            await handleCommand(sock, message, userId); // Forward to cmdHandler
            console.log('✅ Reply successfully forwarded to cmdHandler.');
            return;
        }

        // Handle media file normally if no command or reply is detected
        console.log('ℹ️ Media file processed successfully.');
    } catch (error) {
        console.error('❌ Failed to handle media file:', error);
    }
};



/**
 * Transcribe audio using Whisper (Python-based).
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} remoteJid - The chat ID.
 * @param {string} audioFilePath - Path to the audio file.
 */
const transcribeWithWhisper = async (sock, remoteJid, audioFilePath) => {
    console.log('🎙️ Transcribing audio with Whisper...');
    try {
        exec(`python ${PYTHON_SCRIPT_PATH} "${audioFilePath}"`, async (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Whisper transcription failed: ${error.message}`);
                await sock.sendMessage(remoteJid, {
                    text: '❌ Failed to transcribe your audio/voice note. Please try again later.',
                });
                return;
            }

            if (stderr) {
                console.error(`❌ Whisper transcription error: ${stderr}`);
                await sock.sendMessage(remoteJid, {
                    text: '❌ An error occurred during transcription. Please try again later.',
                });
                return;
            }

            const transcription = stdout.trim();
            console.log(`✅ Whisper transcription: ${transcription}`);

            // Send the transcription back to the user
            await sock.sendMessage(remoteJid, {
                text: `🎙️ Transcription of your audio/voice note:\n\n${transcription || 'No transcription available.'}`,
            });

            // Clean up the temporary audio file
            fs.unlinkSync(audioFilePath);
        });
    } catch (error) {
        console.error('❌ Failed to execute Whisper transcription:', error);
    }
};

module.exports = {
    handleMediaFile,
    transcribeWithWhisper,
};