 // Detect view-once media
 const viewOnceMedia = detectViewOnceMedia(message);
 if (viewOnceMedia) {
     console.log('📸 View-once media detected. Processing...');
 
     try {
         const downloadsDir = path.join(__dirname, '../../downloads');
         if (!fs.existsSync(downloadsDir)) {
             fs.mkdirSync(downloadsDir, { recursive: true });
         }
 
        
 
         // Properly extract data
         const { mediaType, fullMessage } = viewOnceMedia;
         const mediaContent = fullMessage.message?.viewOnceMessage?.message?.[mediaType];
 
         if (!mediaContent?.directPath || !mediaContent?.mediaKey) {
             console.error('❌ View-once media is missing required fields (directPath or mediaKey).');
             return;
         }
 
         const buffer = await downloadMediaMessage(
    { message: { [mediaType]: mediaContent }, key: fullMessage.key },
    'buffer',
    { logger: console }
);

if (!buffer) {
    console.error('❌ Failed to download view-once media.');
    return;
}

// Send the media back to the same chat
const safeSender = sender.replace(/[^0-9]/g, "");
await sock.sendMessage(
  remoteJid,
  {
    image: buffer,
    caption: `👁️ View-once media from @${safeSender}`,
    mentions: [sender]
  },
  { quoted: message }
);

console.log(`✅ View-once media sent to chat instead of being saved.`);


     } catch (error) {
         console.error('❌ Failed to download view-once media:', error);
     }
 
     return;
 }

   // Handle commands in DMs
   if (!isGroup && messageContent.startsWith(userPrefix)) {
    console.log(`✅ Processing command from ${realSender} in DM.`);
    await handleCommand(sock, message, userId, messageContent); // Pass messageContent to cmdHandler.js
    return;
}

// Handle group commands
if (isGroup && messageContent.startsWith(userPrefix)) {
console.log(`✅ Processing command from ${realSender} in group ${remoteJid}.`);

// Fetch the group mode
const groupMode = await getGroupMode(remoteJid);
console.log(`🔍 Group mode for ${remoteJid}: ${groupMode}`);

// Define bot owner IDs (both id and lid)
const botOwnerIds = [
    userId, // The bot's user ID
    sock.user?.id.split(':')[0].split('@')[0], // The bot's ID
    sock.user?.lid?.split(':')[0].split('@')[0], // The bot's LID
].filter(Boolean); // Filter out undefined or null values
console.log(`🔍 Bot owner IDs: ${botOwnerIds}`);

// Check if the command is from the admin bot instance
if (userId === ADMIN_NUMBER) {
    console.log(`✅ Command is being processed by the admin bot instance (${ADMIN_NUMBER}).`);
    await handleCommand(sock, message, userId, messageContent); // Pass messageContent to cmdHandler.js
    return;
}

// Check if the command is from the owner of the new user's bot instance
if (!botOwnerIds.includes(realSender)) {
    console.log(`❌ Command denied: Sender ${realSender} is not the bot owner in group ${remoteJid}.`);
    return;
}

// Allow the bot owner to bypass restrictions
if (realSender === userId) {
    console.log(`✅ Command from bot owner (${realSender}) is allowed.`);
    await handleCommand(sock, message, userId, messageContent); // Pass messageContent to cmdHandler.js
    return;
}

// Check if the group mode is "admin"
if (groupMode === 'admin') {
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const isAdmin = groupMetadata.participants.some(
        (participant) => participant.id === `${realSender}@s.whatsapp.net` && participant.admin
    );

    if (!isAdmin) {
        console.log(`❌ Command denied: Sender ${realSender} is not an admin in group ${remoteJid}.`);
        await sock.sendMessage(remoteJid, {
            text: '❌ Only group admins can use commands in this group.',
        });
        return;
    }

    console.log(`✅ Command from ${realSender} in group ${remoteJid} is allowed (mode: "admin").`);
    await handleCommand(sock, message, userId, messageContent); // Pass messageContent to cmdHandler.js
    return;
}

// Check if the group mode is "me"
if (groupMode === 'me') {
    console.log(`🔍 Group mode for ${remoteJid}: ${groupMode}`);

    // Check if the sender is the bot owner
    if (!botOwnerIds.includes(realSender)) {
        console.log(`❌ Command denied: Sender ${realSender} is not the bot owner in group ${remoteJid}.`);
        return;
    }

    console.log(`✅ Command from bot owner (${realSender}) is allowed in group ${remoteJid} (mode: "me").`);
    await handleCommand(sock, message, userId, messageContent); // Pass messageContent to cmdHandler.js
    return;
}

// If the group mode is unsupported, log and ignore the command
console.log(`❌ Ignoring command from ${realSender} in group ${remoteJid} (unsupported mode: "${groupMode}").`);
return;
}

// generateMessageTag: [Function: generateMessageTag],
//   query: [AsyncFunction: query],
//   waitForMessage: [AsyncFunction: waitForMessage],
//   waitForSocketOpen: [AsyncFunction: waitForSocketOpen],
//   sendRawMessage: [AsyncFunction: sendRawMessage],
//   sendNode: [Function: sendNode],
//   logout: [AsyncFunction: logout],
//   end: [Function: end],
//   onUnexpectedError: [Function: onUnexpectedError],
//   uploadPreKeys: [AsyncFunction: uploadPreKeys],
//   uploadPreKeysToServerIfRequired: [AsyncFunction: uploadPreKeysToServerIfRequired],
//   requestPairingCode: [AsyncFunction: requestPairingCode],
//   waitForConnectionUpdate: [AsyncFunction (anonymous)],
//   sendWAMBuffer: [Function: sendWAMBuffer],
//   executeUSyncQuery: [AsyncFunction: executeUSyncQuery],
//   getBotListV2: [AsyncFunction: getBotListV2],
//   processingMutex: { mutex: [Function: mutex] },
//   fetchPrivacySettings: [AsyncFunction: fetchPrivacySettings],
//   upsertMessage: [AsyncFunction (anonymous)],
//   appPatch: [AsyncFunction: appPatch],
//   sendPresenceUpdate: [AsyncFunction: sendPresenceUpdate],
//   presenceSubscribe: [Function: presenceSubscribe],
//   profilePictureUrl: [AsyncFunction: profilePictureUrl],
//   onWhatsApp: [AsyncFunction: onWhatsApp],
//   fetchBlocklist: [AsyncFunction: fetchBlocklist],
//   fetchStatus: [AsyncFunction: fetchStatus],
//   fetchDisappearingDuration: [AsyncFunction: fetchDisappearingDuration],
//   updateProfilePicture: [AsyncFunction: updateProfilePicture],
//   removeProfilePicture: [AsyncFunction: removeProfilePicture],
//   updateProfileStatus: [AsyncFunction: updateProfileStatus],
//   updateProfileName: [AsyncFunction: updateProfileName],
//   updateBlockStatus: [AsyncFunction: updateBlockStatus],
//   updateCallPrivacy: [AsyncFunction: updateCallPrivacy],
//   updateMessagesPrivacy: [AsyncFunction: updateMessagesPrivacy],
//   updateLastSeenPrivacy: [AsyncFunction: updateLastSeenPrivacy],
//   updateOnlinePrivacy: [AsyncFunction: updateOnlinePrivacy],
//   updateProfilePicturePrivacy: [AsyncFunction: updateProfilePicturePrivacy],
//   updateStatusPrivacy: [AsyncFunction: updateStatusPrivacy],
//   updateReadReceiptsPrivacy: [AsyncFunction: updateReadReceiptsPrivacy],
//   updateGroupsAddPrivacy: [AsyncFunction: updateGroupsAddPrivacy],
//   updateDefaultDisappearingMode: [AsyncFunction: updateDefaultDisappearingMode],
//   getBusinessProfile: [AsyncFunction: getBusinessProfile],
//   resyncAppState: [AsyncFunction (anonymous)],
//   chatModify: [Function: chatModify],
//   cleanDirtyBits: [AsyncFunction: cleanDirtyBits],
//   addLabel: [Function: addLabel],
//   addChatLabel: [Function: addChatLabel],
//   removeChatLabel: [Function: removeChatLabel],
//   addMessageLabel: [Function: addMessageLabel],
//   removeMessageLabel: [Function: removeMessageLabel],
//   star: [Function: star],
//   groupMetadata: [AsyncFunction: groupMetadata],
//   groupCreate: [AsyncFunction: groupCreate],
//   groupLeave: [AsyncFunction: groupLeave],
//   groupUpdateSubject: [AsyncFunction: groupUpdateSubject],
//   groupRequestParticipantsList: [AsyncFunction: groupRequestParticipantsList],
//   groupRequestParticipantsUpdate: [AsyncFunction: groupRequestParticipantsUpdate],
//   groupParticipantsUpdate: [AsyncFunction: groupParticipantsUpdate],
//   groupUpdateDescription: [AsyncFunction: groupUpdateDescription],
//   groupInviteCode: [AsyncFunction: groupInviteCode],
//   groupRevokeInvite: [AsyncFunction: groupRevokeInvite],
//   groupAcceptInvite: [AsyncFunction: groupAcceptInvite],
//   groupRevokeInviteV4: [AsyncFunction: groupRevokeInviteV4],
//   groupAcceptInviteV4: [AsyncFunction (anonymous)],
//   groupGetInviteInfo: [AsyncFunction: groupGetInviteInfo],
//   groupToggleEphemeral: [AsyncFunction: groupToggleEphemeral],
//   groupSettingUpdate: [AsyncFunction: groupSettingUpdate],
//   groupMemberAddMode: [AsyncFunction: groupMemberAddMode],
//   groupJoinApprovalMode: [AsyncFunction: groupJoinApprovalMode],
//   groupFetchAllParticipating: [AsyncFunction: groupFetchAllParticipating],
//   getPrivacyTokens: [AsyncFunction: getPrivacyTokens],
//   assertSessions: [AsyncFunction: assertSessions],
//   relayMessage: [AsyncFunction: relayMessage],
//   sendReceipt: [AsyncFunction: sendReceipt],
//   sendReceipts: [AsyncFunction: sendReceipts],
//   readMessages: [AsyncFunction: readMessages],
//   refreshMediaConn: [AsyncFunction: refreshMediaConn],
//   waUploadToServer: [AsyncFunction (anonymous)],
//   sendPeerDataOperationMessage: [AsyncFunction: sendPeerDataOperationMessage],
//   createParticipantNodes: [AsyncFunction: createParticipantNodes],
//   getUSyncDevices: [AsyncFunction: getUSyncDevices],
//   updateMediaMessage: [AsyncFunction: updateMediaMessage],
//   sendMessage: [AsyncFunction: sendMessage],
//   sendMessageAck: [AsyncFunction: sendMessageAck],
//   sendRetryRequest: [AsyncFunction: sendRetryRequest],
//   rejectCall: [AsyncFunction: rejectCall],
//   fetchMessageHistory: [AsyncFunction: fetchMessageHistory],
//   requestPlaceholderResend: [AsyncFunction: requestPlaceholderResend],
//   logger: EventEmitter {
//     levels: { labels: [Object], values: [Object] },
//     silent: [Function: noop],
//     onChild: [Function: noop],
//     trace: [Function: noop],
//     debug: [Function: noop],
//     info: [Function: noop],
//     warn: [Function: noop],
//     error: [Function: noop],
//     fatal: [Function: noop],
//     [Symbol(pino.levelComp)]: [Function: bound compareLevel],

// const sock = makeWASocket({
//     version: await fetchWhatsAppWebVersion(), // Fetch latest version
//     auth: state, // Auth state loaded via useHybridAuthState or useMultiFileAuthState
//     logger: pino({ level: 'debug' }), // Logging level
//     browser: ['Windows', 'Chrome', '105.0'], // [platform, browser, version] — this is okay
//     printQRInTerminal: false, // Optional: disable terminal QR display if you're sending via WebSocket

//     // Behavior Flags
//     markOnlineOnConnect: false, // safer to leave false
//     generateHighQualityLinkPreview: true,
//     syncFullHistory: true,
//     syncFullHistoryTimeoutMs: 60000,
//     receivedPendingNotifications: true,

//     // Network
//     keepAliveIntervalMs: 30000, // Ping WhatsApp every 30s
//     connectTimeoutMs: 60000, // 60s timeout

//     // Retry
//     retryRequestDelayMs: 3000, // 3s delay for retry

//     // Message handling
//    getMessage: async () => {},

//     // Optimization
//     transactionOpts: {
//         maxOps: 100,
//         maxBytes: 1e6
//     },

//     // Other optional flags
//     emitOwnEvents: true, // emits your own messages (fromMe)
//     linkPreviewImageThumbnailWidth: 100, // thumbnail preview size

//     // Experimental (can be omitted unless you're debugging)
//     //patchMessageBeforeSending: async (msg) => msg, // Optional placeholder
// });


// robocopy "E:\Bot development\kali share dev\M-BOT" "E:\Bot development\VPS\M-BOT" /E /XD public /XF .env

// robocopy "E:\Bot development\kali share dev\M-BOT" "E:\Bot development\kali share railway\M-BOT" /E /XD public /XF .env
// robocopy "E:\Bot development\kali share dev\M-BOT" "E:\Bot development\kali share fly.io\M-BOT" /E /XD public /XF .env
// robocopy "E:\Bot development\kali share dev\M-BOT" "E:\Bot development\kali share render\M-BOT" /E /XD public /XF .env