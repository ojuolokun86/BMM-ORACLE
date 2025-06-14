const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { viewOnceMediaStore } = require('../utils/globalStore');
const fs = require('fs');
const path = require('path');





/**
 * Handle view-once messages and store them in the global store.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {object} message - The incoming message object.
 */
const handleViewOnceMessage = async (sock, message) => {
    const remoteJid = message.key.remoteJid;
    const messageId = message.key.id;
    const messageType = Object.keys(message.message?.viewOnceMessage?.message || {})[0];

    if (!messageType) {
        console.log('❌ No media found in the view-once message.');
        return;
    }

    const supportedMediaTypes = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'voiceMessage'];
    if (!supportedMediaTypes.includes(messageType)) {
        console.log(`❌ Unsupported media type: ${messageType}`);
        return;
    }

    try {
        const mediaContent = message.message.viewOnceMessage.message[messageType];

        if (!mediaContent?.directPath || !mediaContent?.mediaKey) {
            console.error('❌ Missing mediaKey or directPath.');
            return;
        }

        console.log('⬇️ Downloading view-once media for storage...');
        const buffer = await downloadMediaMessage(
            { message: { [messageType]: mediaContent }, key: message.key },
            'buffer',
            { logger: console }
        );

        viewOnceMediaStore[messageId] = {
            mediaBuffer: buffer,
            mediaType: messageType,
            caption: mediaContent.caption || '',
            senderJid: message.key.participant || message.key.remoteJid,
            timestamp: Date.now(),
            fileName: mediaContent.fileName || 'file',
        };

        console.log(`✅ Stored full view-once media from ${remoteJid} (type: ${messageType})`);
    } catch (err) {
        console.error('❌ Failed to handle view-once message:', err);
    }
};




const repostViewOnceMedia = async (sock, detectedMedia, userId) => {
    try {
        const { fullMessage, mediaType } = detectedMedia;

        // Try to get mediaContent from all possible wrappers
        let mediaContent =
            fullMessage.message?.viewOnceMessage?.message?.[mediaType] ||
            fullMessage.message?.viewOnceMessageV2?.message?.[mediaType] ||
            fullMessage.message?.[mediaType];

        // If still missing directPath or mediaKey, try to dig deeper
        if (
            (!mediaContent?.directPath || !mediaContent?.mediaKey) &&
            (fullMessage.message?.viewOnceMessageV2?.message || fullMessage.message?.viewOnceMessage?.message)
        ) {
            const nested =
                fullMessage.message?.viewOnceMessageV2?.message?.[mediaType] ||
                fullMessage.message?.viewOnceMessage?.message?.[mediaType];
            if (nested) mediaContent = nested;
        }

        const senderJid =
            fullMessage.message?.extendedTextMessage?.contextInfo?.participant ||
            fullMessage.key.participant ||
            fullMessage.key.remoteJid;

        console.log(`🔍 Original sender JID: ${senderJid}`);

        if (!mediaContent?.directPath || !mediaContent?.mediaKey) {
            console.error('❌ View-once media is missing required fields (directPath or mediaKey).');
            await sock.sendMessage(fullMessage.key.remoteJid, {
                text: '❌ Failed to process the view-once media. It may have expired or been deleted.',
            });
            return;
        }

        console.log('🔄 Downloading view-once media...');
        const buffer = await downloadMediaMessage(
            { message: { [mediaType]: mediaContent }, key: fullMessage.key },
            'buffer',
            { logger: console }
        );

        if (!buffer) {
            console.error('❌ Failed to download view-once media.');
            await sock.sendMessage(fullMessage.key.remoteJid, {
                text: '❌ Failed to download the view-once media. Please try again later.',
            });
            return;
        }
        let ownerName = 'Unknown';
            try {
                if (sock.user && sock.user.name) {
                    ownerName = sock.user.name;
                } else {
                    // Optionally, fetch from DB if not available in sock
                    // ownerName = await getOwnerName(userId);
                }
            } catch (e) {
                console.error('Failed to get owner name:', e);
            }
        console.log('📤 Reposting view-once media...');
       const mediaPayload = {
            caption: `🤖 *BMM BOT* 🤖\n\n🔁 Reposted view-once media from @${senderJid.split('@')[0]}${
                mediaContent.caption ? `\n\n📄 Original Caption: ${mediaContent.caption}` : ''
            }\n\n👤 *Owner:* ${ownerName}`,
            mentions: [senderJid], // Ensure the original sender is mentioned
        };

        // Handle different media types
        if (mediaType === 'imageMessage') {
            mediaPayload.image = buffer;
        } else if (mediaType === 'videoMessage') {
            mediaPayload.video = buffer;
        } else if (mediaType === 'documentMessage') {
            mediaPayload.document = buffer;
            mediaPayload.fileName = mediaContent.fileName || 'file';
        } else if (mediaType === 'audioMessage' || mediaType === 'voiceMessage') {
            mediaPayload.audio = buffer;
            mediaPayload.ptt = mediaType === 'voiceMessage'; // Set as voice note if it's a voice message
        } else {
            console.error(`❌ Unsupported media type: ${mediaType}`);
            await sock.sendMessage(fullMessage.key.remoteJid, {
                text: `❌ Unsupported media type: ${mediaType}.`,
            });
            return;
        }

        await sock.sendMessage(fullMessage.key.remoteJid, mediaPayload);
        console.log(`✅ View-once media reposted to chat ${fullMessage.key.remoteJid}.`);
    } catch (error) {
        console.error('❌ Failed to repost view-once media:', error);
        await sock.sendMessage(fullMessage.key.remoteJid, {
            text: '❌ Failed to repost the view-once media. Please try again later.',
        });
    }
};
/**
 * Detect view-once media in a message or its quoted reply.
 * @param {object} message - The incoming message object.
 * @returns {object|null} - An object with mediaType and fullMessage or null if not found.
 */
// ...existing code...
// ...existing code...
const detectViewOnceMedia = (message) => {
  console.log('🔍 Detecting view-once media...');
  console.log('Message structure:', JSON.stringify(message, null, 2));

  // 1. Check for viewOnceMessage or viewOnceMessageV2 (top-level)
  const viewOnceMsg =
    message.message?.viewOnceMessage?.message ||
    message.message?.viewOnceMessageV2?.message;
  if (viewOnceMsg) {
    const mediaType = Object.keys(viewOnceMsg).find(key =>
      ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'voiceMessage'].includes(key)
    );
    if (mediaType) {
      console.log(`✅ Detected direct view-once media of type: ${mediaType}`);
      return { mediaType, fullMessage: message };
    }
  }

  // 1b. Check for direct media message with viewOnce flag (iPhone)
  const directMediaTypes = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage', 'voiceMessage'];
  for (const type of directMediaTypes) {
    const media = message.message?.[type];
    if (media && media.viewOnce) {
      console.log(`✅ Detected direct ${type} with viewOnce flag`);
      return { mediaType: type, fullMessage: message };
    }
  }

  // 2. Check if this is a reply to a view-once message (quoted message)
  const contextInfo = message.message?.extendedTextMessage?.contextInfo;
  const quotedMsg = contextInfo?.quotedMessage;
  if (quotedMsg) {
    for (const type of directMediaTypes) {
      const media = quotedMsg[type];
      if (media && (media.viewOnce || quotedMsg?.viewOnceMessage || quotedMsg?.viewOnceMessageV2)) {
        console.log(`✅ Detected quoted ${type} with viewOnce flag`);
        return { mediaType: type, fullMessage: { message: quotedMsg, key: { ...message.key } } };
      }
      // If quotedMsg is a viewOnceMessage or viewOnceMessageV2 wrapper
      if (
        quotedMsg?.viewOnceMessage?.message?.[type] ||
        quotedMsg?.viewOnceMessageV2?.message?.[type]
      ) {
        console.log(`✅ Detected quoted viewOnceMessage of type: ${type}`);
        return { mediaType: type, fullMessage: { message: quotedMsg, key: { ...message.key } } };
      }
    }
  }

  // 3. Check if this is a reply to a stored view-once message
  const quotedId = contextInfo?.stanzaId;
  if (quotedId && viewOnceMediaStore[quotedId]) {
    const stored = viewOnceMediaStore[quotedId];
    console.log(`🔍 Found stored view-once media with ID: ${quotedId}`);
    console.log(`✅ Detected view-once via reply to stored message: ${quotedId}`);
    return {
      mediaType: stored.mediaType,
      fullMessage: {
        message: { [stored.mediaType]: stored.buffer ? stored.buffer : {} },
        key: { id: quotedId, remoteJid: message.key.remoteJid }
      },
      stored,
    };
  }

  console.log('❌ No view-once media found in message or reply.');
  return null;
};
// ...existing code...
// ...existing code...

module.exports = {
    handleViewOnceMessage,
    repostViewOnceMedia,
    detectViewOnceMedia,
};