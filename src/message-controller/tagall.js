const { generateTagAllMessage } = require('../utils/style'); // Import tagall message formatter
const { sendToChat } = require('../utils/messageUtils'); // Import the sendToChat function
const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // Import media download function
const { getBotOwnerName } = require('../utils/groupData'); // Import bot owner name function
const { getGroupAdmins } = require('../utils/groupData');

/**
 * Handle the "tagall" command.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {object} message - The incoming message object.
 * @param {string} remoteJid - The group ID.
 * @param {string} userId - The bot owner's ID.
 * @param {boolean} useFormattedTagAll - Whether to use formatted tagall messages.
 * @param {string[]} args - The command arguments.
 * @returns {Promise<boolean>} - Whether the command was handled.
 */
const handleTagAllCommand = async (sock, message, remoteJid, userId, useFormattedTagAll, args) => {
    try {
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const participants = groupMetadata.participants.map((p) => p.id); // Get all participant IDs
        const mentions = participants; // Tag all participants
        const groupName = groupMetadata.subject; // Get the group name
        const senderName = message.pushName || 'Unknown'; // Get the sender's name
        const botOwnerName = await getBotOwnerName(userId); // Fetch the bot owner's WhatsApp name
        const adminList = await getGroupAdmins(sock, remoteJid); // returns array of admin IDs
        let additionalMessage = args.join(' ') || ''; // Get the additional message content from the arguments
          // Check if the message is a reply
        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedMessageType = quotedMessage ? Object.keys(quotedMessage)[0] : null;

        if (quotedMessage) {
            console.log(`🔍 Quoted message type: ${quotedMessageType}`);

            // Handle plain text replies
            if (quotedMessageType === 'conversation') {
                additionalMessage = quotedMessage.conversation;
            } else if (quotedMessageType === 'extendedTextMessage') {
                additionalMessage = quotedMessage.extendedTextMessage.text;
            }

            if (quotedMessageType === 'conversation' || quotedMessageType === 'extendedTextMessage') {
                console.log(`🔍 Using quoted message as additional message: ${additionalMessage}`);

                const tagAllMessage = useFormattedTagAll
                    ? generateTagAllMessage(groupName, senderName, botOwnerName, additionalMessage, participants, adminList).text
                    : `${additionalMessage || '📢 Attention everyone!'}`;

                await sendToChat(sock, remoteJid, { message: tagAllMessage, mentions, quotedMessage: message });
                console.log('✅ Tag-all message sent as a reply to text.');
                return true;
            }

            // Handle media replies
            if (['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'voiceMessage'].includes(quotedMessageType)) {
                const mediaMessage = quotedMessage[quotedMessageType];
                const mediaBuffer = await downloadMediaMessage(
                    { message: { [quotedMessageType]: mediaMessage } },
                    'buffer',
                    {}
                );

                if (!mediaBuffer) {
                    console.error('❌ Failed to download media. Buffer is empty.');
                    await sendToChat(sock, remoteJid, { message: '❌ Failed to download media. Please try again later.',
                        quotedMessage: message
                     });
                    return true;
                }

                const originalCaption = mediaMessage.caption || additionalMessage;
                const mediaType = quotedMessageType.replace('Message', ''); // Convert message type to media type
                const mediaOptions = {
                    media: mediaBuffer,
                    mediaType,
                    caption: useFormattedTagAll
                        ? generateTagAllMessage(groupName, senderName, botOwnerName, originalCaption, participants, adminList).text
                        : `${originalCaption || '📢 Attention everyone!'}`,
                    mentions,
                };

                await sendToChat(sock, remoteJid, mediaOptions, { quotedMessage: message });
                console.log('✅ Tag-all message sent as a reply to media.');
                return true;
            }

            // Handle unsupported media types
            console.log(`⚠️ Unsupported media type: ${quotedMessageType}`);
            await sendToChat(sock, remoteJid, { message: '❌ Unsupported media type. Please try again with a supported file.' });
            return true;
        }

        // Default behavior: Send a formatted or plain tagall message
        console.log('📢 Sending default tagall message...');
        if (useFormattedTagAll) {
            const { text, mentions } = generateTagAllMessage(groupName, senderName, botOwnerName, additionalMessage, participants, adminList);
            await sendToChat(sock, remoteJid, { message: text, mentions, quotedMessage: message });
        } else {
            const plainMessage = `${additionalMessage || '📢 Attention everyone!'}`;
            await sendToChat(sock, remoteJid, { message: plainMessage, mentions, quotedMessage: message });
        }

        console.log('✅ Tag-all message sent.');
        return true; // Command handled
    } catch (error) {
        console.error('❌ Failed to execute "tagall" command:', error);
        await sendToChat(sock, remoteJid, { message: '❌ Failed to tag all members. Please try again later.', quotedMessage: message });
        return false;
    }
};

module.exports = { handleTagAllCommand };