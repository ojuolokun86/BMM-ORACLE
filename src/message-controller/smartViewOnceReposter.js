const { viewOnceMediaStore } = require('../utils/globalStore');
const { repostViewOnceMedia } = require('./yourCurrentViewOnceHandler');

/**
 * Reply-based view-once handler.
 * When a user replies to a view-once message, this will fetch it from the store and repost it.
 */
const handleReplyToViewOnce = async (sock, message) => {
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const quotedId = contextInfo?.stanzaId;

    if (!quotedId) {
        console.log('❌ No quoted message ID found.');
        return;
    }

    // Check if this quoted message ID exists in the store
    const detectedMedia = viewOnceMediaStore[quotedId];

    if (!detectedMedia) {
        console.log(`❌ View-once media with ID ${quotedId} not found in store.`);
        await sock.sendMessage(message.key.remoteJid, {
            text: '⚠️ View-once media not available anymore or was never stored.',
        });
        return;
    }

    console.log(`📥 Reply detected. Reposting view-once media originally from ID: ${quotedId}`);

    // Use existing function to repost the media
    await repostViewOnceMedia(sock, detectedMedia, message.key.participant || message.key.remoteJid);
};

module.exports = { handleReplyToViewOnce };
