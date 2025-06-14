const handleMessage = require('../message-controller/msgHandler'); // Import the message handler
const { handleNewUserJoin } = require('../utils/groupUser'); // Import the function to handle new user joins
const { botInstances,} = require('../utils/globalStore'); // Import the global botInstances object
const { updateUserMetrics } = require('../database/models/metrics'); // Import the user metrics functions
const { addActivityLog, addAnalyticsData } = require('../server/info'); // Import addActivityLog
const { getUserCached } = require('../database/userDatabase'); // Import the user database functions
const { formatResponse } = require('../utils/utils');
const { useHybridAuthState } = require('../database/hybridAuthState');
const { isCallAllowed } = require('../dnd/dndManager');


const userQueues = new Map(); // Map to store per-user/group queues

/**
 * Add a task to the queue for a given key (user or group).
 * @param {string} queueKey - The key for the queue (userId or group JID).
 * @param {Function} task - The async function to execute.
 */
const addToQueue = (queueKey, task) => {
    if (typeof task !== 'function') {
        console.error(`❌ Invalid task for queueKey ${queueKey}. Task must be a function.`);
        return;
    }

    if (!userQueues.has(queueKey)) {
        userQueues.set(queueKey, []);
    }

    const queue = userQueues.get(queueKey);
    queue.push(task);

    if (queue.length === 1) {
        processQueue(queueKey);
    }
};


/**
 * Process the queue for a given key.
 * @param {string} queueKey - The key for the queue (userId or group JID).
 */
const processQueue = async (queueKey) => {
    const queue = userQueues.get(queueKey);
    while (queue && queue.length > 0) {
        const task = queue[0];
        let userId, authId;
        const startTime = Date.now();
        try {
            // If your task returns userId/authId, capture them here
            ({ userId, authId } = await task());
        } catch (error) {
            console.error(`❌ Error processing task for queueKey ${queueKey}:`, error);
        }
        const endTime = Date.now();
        const timeTaken = endTime - startTime;

        // Only update metrics if userId and authId are available
        if (userId && authId) {
            updateUserMetrics(userId, authId, { queueProcessingTime: timeTaken });
            console.log(`⏱️ Task for user ${userId} and authId ${authId} took ${timeTaken}ms to complete.`);
        }

        queue.shift();
    }
    if (queue && queue.length === 0) {
        userQueues.delete(queueKey);
    }
};


function extractMessageContent(message) {
    if (!message || !message.message) return '';
    const msg = message.message;

    // Handle ephemeral message wrapper
    if (msg.ephemeralMessage?.message) {
        return extractMessageContent({ message: msg.ephemeralMessage.message });
    }

    // Handle view-once wrapper
    if (msg.viewOnceMessage?.message) {
        return extractMessageContent({ message: msg.viewOnceMessage.message });
    }

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.documentMessage?.caption) return msg.documentMessage.caption;
    if (msg.audioMessage?.caption) return msg.audioMessage.caption;
    if (msg.voiceMessage?.duration) return `🎤 Voice message: ${msg.voiceMessage.duration} seconds`;
    if (msg.gifMessage?.url) return `🎞️ GIF: ${msg.gifMessage.url}`;
    if (msg.stickerMessage?.fileSha256) return '📄 Sticker received';

    if (msg.buttonsResponseMessage?.selectedButtonId) return msg.buttonsResponseMessage.selectedButtonId;
    if (msg.listResponseMessage?.title) return msg.listResponseMessage.title;
    if (msg.templateButtonReplyMessage?.selectedId) return msg.templateButtonReplyMessage.selectedId;

    if (msg.contactMessage?.displayName) return msg.contactMessage.displayName;
    if (msg.contactMessage?.contact?.name) return `📇 Contact: ${msg.contactMessage.contact.name}`;
    if (msg.contactsArrayMessage?.contacts?.[0]?.displayName) return msg.contactsArrayMessage.contacts[0].displayName;

    if (msg.locationMessage?.name) return msg.locationMessage.name;
    if (msg.liveLocationMessage?.name) return msg.liveLocationMessage.name;

    if (msg.callMessage?.callId) return `📞 Call from ${msg.callMessage.callId}`;
    if (msg.reactionMessage?.text) return `❤️ Reacted: ${msg.reactionMessage.text}`;
    if (msg.potentiallyMobileDeviceMessage?.text) return msg.potentiallyMobileDeviceMessage.text;
    if (msg.pollUpdateMessage?.pollUpdates) return '📊 Poll response received';
    if (msg.pollCreationMessage?.name) return `📊 Poll created: ${msg.pollCreationMessage.name}`;
    if (msg.protocolMessage?.type === 3) return '🗑️ Message deleted';
    if (msg.protocolMessage?.type === 17) return '';
    if (msg.protocolMessage?.type === 3) return '🗑️ Message deleted';
    if (msg.protocolMessage?.type === 14) return '⭐ Message kept in chat';
    if (msg.protocolMessage?.type === 15) return '⭐ Message unkept in chat';
    if (msg.protocolMessage?.type === 17) return ''; // Peer data op, ignore
    if (msg.protocolMessage?.type === 25) return '✏️ Message edited';
    if (msg.groupInviteMessage?.groupName) return `📩 Group Invite: ${msg.groupInviteMessage.groupName}`;

    if (msg.paymentMessage?.amount) {
        const amount = msg.paymentMessage.amount;
        return `💰 Payment of ${amount.currency} ${amount.amount} received`;
    }

     if (msg.imageMessage) return `🖼️ Image${msg.imageMessage.caption ? ': ' + msg.imageMessage.caption : ''}`;
    if (msg.videoMessage) return `🎥 Video${msg.videoMessage.caption ? ': ' + msg.videoMessage.caption : ''}`;
    if (msg.audioMessage) return `🎵 Audio message`;
    if (msg.documentMessage) return `📄 Document: ${msg.documentMessage.fileName || ''}`;
    if (msg.stickerMessage) return '🗒️ Sticker';
    if (msg.contactMessage) return `👤 Contact: ${msg.contactMessage.displayName || ''}`;
    if (msg.locationMessage) return `📍 Location: ${msg.locationMessage.degreesLatitude},${msg.locationMessage.degreesLongitude}`;
    if (msg.liveLocationMessage) return `📍 Live Location: ${msg.liveLocationMessage.degreesLatitude},${msg.liveLocationMessage.degreesLongitude}`;
    if (msg.audioMessage?.caption) return msg.audioMessage.caption;
    if (msg.gifMessage?.url) return `🎞️ GIF: ${msg.gifMessage.url}`;

    // Status (if you want to show status updates)
    if (msg.protocolMessage?.type === 2) return '🟢 Status update';

    if (msg.orderMessage?.title) return `🛍️ Order: ${msg.orderMessage.title}`;
    if (msg.documentMessage?.fileName) return `📄 Document: ${msg.documentMessage.fileName}`;

    // Handle quoted messages
    const quoted = msg?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted) {
        const quotedContent = extractMessageContent({ message: quoted });
        if (quotedContent) return `🗨️ Quoted: ${quotedContent}`;
    }

    console.log(`👁️ Unhandled message type for message ID ${message.key?.id}:`, msg);
    return '';
}




module.exports = async (sock, userId, version) => {
    console.log(`🤖🤖 Initializing bot instance for user: ${userId} with WhatsApp Web version: ${version}`);
    const user = await getUserCached (userId); // Get the user object for the user
    console.log(`🤖🤖 User object for userId ${userId}:`, user);

        if (!user) {
            console.error(`❌ User with userId ${userId} not found in the database.`);
            return; // Exit early if the user does not exist
        }
    
    const authId = user.auth_id; // Extract authId from the user object
    console.log(`🤖🤖 Initializing bot instance for user: ${userId} with authId: ${authId}`);

    if (!sock || !sock.ev) {
        console.error(`❌ Invalid sock object for user: ${userId}`);
        return;
    }

    botInstances[userId] = sock; // Store the socket in the global botInstances object
    if (!botInstances[userId]) {
        console.error(`❌ Invalid botInstance for user: ${userId}. Expected a valid WhatsApp socket instance.`);
        return;
    }

    console.log(`🤖🤖 Bot instance initialized for user: ${userId} using WhatsApp Web version: ${version}`);
    // Listen for incoming messages
    sock.ev.on('messages.upsert', async (messageUpdate) => {
        const startTime = Date.now();
        console.log(`📥 New message received for user: ${userId}`);
        const message = messageUpdate.messages[0];
        const messageContent = extractMessageContent(message); // Message content
        const remoteJid = message.key.remoteJid; // Chat ID (e.g., group or individual chat)
        const sender = message.key.participant || remoteJid; // Sender's ID (for group chats, use participant)
        const normalizedSender = sender.split('@')[0]; // Normalize sender's number
        const isFromMe = message.key.fromMe; // Whether the message is from the bot itself
        const isGroup = remoteJid.endsWith('@g.us'); // Check if the message is from a group
        const messageId = message.key.id; // Unique message ID
        const messageType = Object.keys(message.message?.viewOnceMessage?.message || {})[0]; // Get the type of the media
        // Correctly identify the sender and receiver in DMs
        const realSender = isGroup ? normalizedSender : (isFromMe ? userId : normalizedSender);
        const realReceiver = isGroup ? remoteJid : userId;
        console.info(`📥 Message from
             ${realSender}
              to ${realReceiver}
               in ${isGroup ? 'group' : 
                'DM'}: ${messageContent}`);

             
        // Add the message to the user's queue
      const queueKey = isGroup ? remoteJid : userId;
      addToQueue(queueKey, async () => {
    

    console.log(`[${new Date().toISOString()}] ⏳ Start processing message for ${userId}`);

    

    // 1. Presence update (available)
    const t1 = Date.now();
    try {
        await sock.sendPresenceUpdate('available', remoteJid);
    } catch (err) {}
    console.log(`[${new Date().toISOString()}] ⏱️ Presence available took ${Date.now() - t1}ms`);

    // 3. Handle message
    const t3 = Date.now();
    try {
        await handleMessage(sock, message, userId, authId);
        console.log(`[${new Date().toISOString()}] ✅ handleMessage completed`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ handleMessage error:`, err);
    } finally {
    // 4. Presence update (unavailable) - always runs
    const t4 = Date.now();
    try {
        // Wait 2 seconds before setting unavailable
        await new Promise(resolve => setTimeout(resolve, 2000));
        await sock.sendPresenceUpdate('unavailable', remoteJid);
        console.log(`🚀presence unavailable sent for ${userId}`);
    } catch (err) {}
    console.log(`[${new Date().toISOString()}] ⏱️ Presence unavailable took ${Date.now() - t4}ms`);

    const endTime = Date.now();
    console.log(`[${new Date().toISOString()}] ✅ Total processing time: ${endTime - startTime}ms`);
    addActivityLog(authId, {
        action: messageContent, // or any string you want to show as the action
        type: 'message',
        userId,
        timestamp: new Date().toISOString(),
        content: messageContent,
        processingTime: endTime - startTime // in ms
    });
}

 
    return { userId, authId };
});
    });
    // Listen for group participant updates
    sock.ev.on('group-participants.update', async (update) => {
        const { id: groupId, participants, action } = update;

        if (action === 'add') {
            console.log(`🔍 New participants added to group ${groupId}:`, participants);

            for (const userJid of participants) {
                console.log(`👤 Handling new user join: ${userJid}`);
                await handleNewUserJoin(sock, groupId, userJid, botInstances[userId]);
            }
        } else if (action === 'remove') {
            console.log(`👋 Participants removed from group ${groupId}:`, participants);
            // Handle user removal if needed
        }
    });

    const handledCalls = new Set();

sock.ev.on('call', async (callEvent) => {
    for (const call of callEvent) {
        // Only handle incoming offers (type === 'offer') and not already handled
        if (handledCalls.has(call.id)) continue;
        handledCalls.add(call.id);

        setTimeout(() => handledCalls.delete(call.id), 60 * 1000); // Clean up after 1 min

        const callerJid = call.from;
        // Use DND manager to check if call is allowed
        const allowed = await isCallAllowed(userId, callerJid, call.isVideo ? 'video' : 'voice');
        if (!allowed) {
            console.log(`🔕 DND active for ${userId}. Rejecting call from ${callerJid}.`);
            try {
                await sock.rejectCall(call.id, callerJid);
                console.log(`🔕 Rejected call from ${callerJid} due to DND.`);
                const reply = await formatResponse(sock, "❌ Sorry, I'm unavailable for calls right now. Please send a message instead.");
                await sock.sendMessage(callerJid, { text: reply });
            } catch (err) {
                console.error(`❌ Failed to reject call from ${callerJid}:`, err);
            }
        }
    }
});
const { state, saveCreds } = await useHybridAuthState(userId, authId);
sock.ev.on('creds.update', async () => {
    await saveCreds();
    console.log('✅ Session credentials updated and saved.');
});

// Optionally, after handling a session close or prekey event:
sock.ev.on('connection.update', async (update) => {
    if (update.connection === 'close' || update.qr) {
        await saveCreds();
        console.log('✅ Session credentials saved after connection update.');
    }
});
};

// This code initializes a WhatsApp bot instance for a specific user, sets up event listeners for incoming messages and group participant updates,
// and processes messages in a queue to ensure they are handled sequentially. It also handles new user joins in groups and rejects calls if the user has DND enabled.

