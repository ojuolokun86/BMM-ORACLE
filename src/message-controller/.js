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
//     //patchMessageBeforeSending: async (msg) => msg, // Optional placeholder " new registration perttern"

// });


// robocopy "E:\Bot development\kali share dev\M-BOT" "E:\Bot development\VPS\M-BOT" /E /XD public node_modules /XF .env package-lock.json
// robocopy "E:\Bot development\kali share dev\M-BOT" "E:\Bot development\kali share railway\M-BOT" /E /XD public node_modules /XF .env package-lock.json
// robocopy "E:\Bot development\kali share dev\M-BOT" "E:\Bot development\kali share fly.io\M-BOT" /E /XD public node_modules /XF .env package-lock.json
// robocopy "E:\Bot development\kali share dev\M-BOT" "E:\Bot development\kali share render\M-BOT" /E /XD public node_modules /XF .env package-lock.json
// robocopy "E:\Bot development\kali share dev\M-BOT" "E:\Bot development\ORACLE\M-BOT" /E /XD public node_modules /XF .env package-lock.json



// will already have fun menu 
// so if this is fun command 
// let add the function 
// we dont have roll
// rps
// meme
// anie
// waifu
// cat
// dog
// song
// movie
// game

// can we use this 

// const fetch = require('node-fetch');

// async function lyricsCommand(sock, chatId, songTitle) {
//     if (!songTitle) {
//         await sock.sendMessage(chatId, { 
//             text: '🔍 Please enter the song name to get the lyrics! Usage: *lyrics <song name>*'
//         });
//         return;
//     }

//     try {
//         // Fetch song lyrics using the some-random-api.com API
//         const apiUrl = `https://some-random-api.com/lyrics?title=${encodeURIComponent(songTitle)}`;
//         const res = await fetch(apiUrl);
        
//         if (!res.ok) {
//             throw await res.text();
//         }
        
//         const json = await res.json();
        
//         if (!json.lyrics) {
//             await sock.sendMessage(chatId, { 
//                 text: `❌ Sorry, I couldn't find any lyrics for "${songTitle}".`
//             });
//             return;
//         }
        
//         // Sending the formatted result to the user
//         await sock.sendMessage(chatId, {
//             text: `🎵 *Song Lyrics* 🎶\n\n▢ *Title:* ${json.title || songTitle}\n▢ *Artist:* ${json.author || 'Unknown'}\n\n📜 *Lyrics:*\n${json.lyrics}\n\nHope you enjoy the music! 🎧 🎶`
//         });
//     } catch (error) {
//         console.error('Error in lyrics command:', error);
//         await sock.sendMessage(chatId, { 
//             text: `❌ An error occurred while fetching the lyrics for "${songTitle}".`
//         });
//     }
// }

// module.exports = { lyricsCommand };

// aand this


// const yts = require('yt-search');
// const axios = require('axios');

// async function playCommand(sock, chatId, message) {
//     try {
//         const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
//         const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
//         if (!searchQuery) {
//             return await sock.sendMessage(chatId, { 
//                 text: "What song do you want to download?"
//             });
//         }

//         // Search for the song
//         const { videos } = await yts(searchQuery);
//         if (!videos || videos.length === 0) {
//             return await sock.sendMessage(chatId, { 
//                 text: "No songs found!"
//             });
//         }

//         // Send loading message
//         await sock.sendMessage(chatId, {
//             text: "_Please wait your download is in progress_"
//         });

//         // Get the first video result
//         const video = videos[0];
//         const urlYt = video.url;

//         // Fetch audio data from API
//         const response = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`);
//         const data = response.data;

//         if (!data || !data.status || !data.result || !data.result.downloadUrl) {
//             return await sock.sendMessage(chatId, { 
//                 text: "Failed to fetch audio from the API. Please try again later."
//             });
//         }

//         const audioUrl = data.result.downloadUrl;
//         const title = data.result.title;

//         // Send the audio
//         await sock.sendMessage(chatId, {
//             audio: { url: audioUrl },
//             mimetype: "audio/mpeg",
//             fileName: `${title}.mp3`
//         }, { quoted: message });

//     } catch (error) {
//         console.error('Error in song2 command:', error);
//         await sock.sendMessage(chatId, { 
//             text: "Download failed. Please try again later."
//         });
//     }
// }

// module.exports = playCommand; 
// and this 
// /*Créditos A Quien Correspondan 
// Play Traido y Editado 
// Por Cuervo-Team-Supreme*/
// const axios = require('axios');
// const yts = require('yt-search');
// const fetch = require('node-fetch');
// const fs = require('fs');
// const path = require('path');
// const { exec } = require('child_process');
// const util = require('util');
// const execPromise = util.promisify(exec);

// async function songCommand(sock, chatId, message) {
//     try {
//         const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
//         const searchQuery = text.split(' ').slice(1).join(' ').trim();
        
//         if (!searchQuery) {
//             return await sock.sendMessage(chatId, { 
//                 text: "What song do you want to download?"
//             });
//         }

//         // Search for the song
//         const { videos } = await yts(searchQuery);
//         if (!videos || videos.length === 0) {
//             return await sock.sendMessage(chatId, { 
//                 text: "No songs found!"
//             });
//         }

//         // Get the first video result
//         const video = videos[0];
//         const urlYt = video.url;

//         // Prepare temp files
//         const tempDir = path.join(__dirname, '../temp');
//         if (!fs.existsSync(tempDir)) {
//             fs.mkdirSync(tempDir);
//         }
//         const tempFile = path.join(tempDir, `${Date.now()}.mp3`);
//         const tempM4a = path.join(tempDir, `${Date.now()}.m4a`);

//         try {
//             // Send the thumbnail and info immediately after getting video info
//             if (video.thumbnail) {
//                 try {
//                     await sock.sendMessage(chatId, {
//                         image: { url: video.thumbnail },
//                         caption: `*${video.title}*\n\n*Duration:* ${formatDuration(video.duration.seconds)}\n*Views:* ${formatNumber(video.views)}\n\n> *_Downloaded by Knight Bot MD_*`
//                     }, { quoted: message });
//                 } catch (thumbErr) {
//                 }
//             }

//             // Use new siputzx endpoint and include thumbnail
//             const apiUrl = `https://api.siputzx.my.id/api/dl/youtube/mp3?url=${encodeURIComponent(urlYt)}`;
//             const siputzxRes = await fetch(apiUrl, { headers: { 'accept': '*/*' } });
//             const siputzxData = await siputzxRes.json();
//             let downloadLink = null;
//             if (siputzxData && siputzxData.status && siputzxData.data) {
//                 downloadLink = siputzxData.data;
//             }
//             if (downloadLink) {
//                 const response = await fetch(downloadLink);
//                 if (!response.ok) {
//                     await sock.sendMessage(chatId, { text: 'Failed to download the song file from the server.' }, { quoted: message });
//                     return;
//                 }
//                 const buffer = await response.buffer();
//                 if (!buffer || buffer.length < 1024) {
//                     await sock.sendMessage(chatId, { text: 'Downloaded file is empty or too small.' }, { quoted: message });
//                     return;
//                 }
//                 fs.writeFileSync(tempM4a, buffer);
//                 await execPromise(`ffmpeg -i "${tempM4a}" -vn -acodec libmp3lame -ac 2 -ab 128k -ar 44100 "${tempFile}"`);
//                 const stats = fs.statSync(tempFile);
//                 if (stats.size < 1024) {
//                     throw new Error('Conversion failed');
//                 }
//                 await sock.sendMessage(chatId, {
//                     audio: { url: tempFile },
//                     mimetype: "audio/mpeg",
//                     fileName: `${video.title}.mp3`,
//                     ptt: false
//                 }, { quoted: message });
//                 setTimeout(() => {
//                     try {
//                         if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
//                         if (fs.existsSync(tempM4a)) fs.unlinkSync(tempM4a);
//                     } catch {}
//                 }, 5000);
//                 return;
//             } else {
//                 // Fallback to vreden API
//                 try {
//                     const vredenUrl = `https://api.vreden.my.id/api/dl/ytmp3?url=${encodeURIComponent(urlYt)}`;
//                     const vredenRes = await fetch(vredenUrl, {
//                         headers: {
//                             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
//                             'Accept': 'application/json'
//                         }
//                     });
//                     let vredenData;
//                     if (!vredenRes.ok) {
//                         await sock.sendMessage(chatId, {
//                             text: 'Sorry, this song could not be downloaded (fallback API error). Please try another song or try again later.'
//                         }, { quoted: message });
//                         return;
//                     }
//                     const contentType = vredenRes.headers.get('content-type');
//                     if (!contentType || !contentType.includes('application/json')) {
//                         const errText = await vredenRes.text();
//                         await sock.sendMessage(chatId, {
//                             text: 'Sorry, this song could not be downloaded (fallback API returned invalid content). Please try another song or try again later.'
//                         }, { quoted: message });
//                         return;
//                     }
//                     try {
//                         vredenData = await vredenRes.json();
//                     } catch (jsonErr) {
//                         await sock.sendMessage(chatId, {
//                             text: 'Sorry, this song could not be downloaded (fallback API invalid response). Please try another song or try again later.'
//                         }, { quoted: message });
//                         return;
//                     }
//                     if (
//                         vredenData &&
//                         vredenData.status === 200 &&
//                         vredenData.result &&
//                         vredenData.result.status === true &&
//                         vredenData.result.download &&
//                         vredenData.result.download.status === true &&
//                         vredenData.result.download.url
//                     ) {
//                         const vredenDownloadUrl = vredenData.result.download.url;
//                         const vredenFilename = vredenData.result.download.filename || `${video.title}.mp3`;
//                         const response = await fetch(vredenDownloadUrl);
//                         if (!response.ok) {
//                             await sock.sendMessage(chatId, { text: 'Failed to download the song file from the fallback server.' }, { quoted: message });
//                             return;
//                         }
//                         const buffer = await response.buffer();
//                         if (!buffer || buffer.length < 1024) {
//                             await sock.sendMessage(chatId, { text: 'Downloaded file is empty or too small (fallback).' }, { quoted: message });
//                             return;
//                         }
//                         fs.writeFileSync(tempM4a, buffer);
//                         await execPromise(`ffmpeg -i "${tempM4a}" -vn -acodec libmp3lame -ac 2 -ab 128k -ar 44100 "${tempFile}"`);
//                         const stats = fs.statSync(tempFile);
//                         if (stats.size < 1024) {
//                             throw new Error('Conversion failed (fallback)');
//                         }
//                         await sock.sendMessage(chatId, {
//                             audio: { url: tempFile },
//                             mimetype: "audio/mpeg",
//                             fileName: vredenFilename,
//                             ptt: false
//                         }, { quoted: message });
//                         setTimeout(() => {
//                             try {
//                                 if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
//                                 if (fs.existsSync(tempM4a)) fs.unlinkSync(tempM4a);
//                             } catch {}
//                         }, 5000);
//                         return;
//                     } else {
//                         await sock.sendMessage(chatId, {
//                             text: 'Sorry, this song could not be downloaded. Please try another song or try again later.'
//                         }, { quoted: message });
//                         return;
//                     }
//                 } catch (vredenErr) {
//                     await sock.sendMessage(chatId, {
//                         text: 'Sorry, this song could not be downloaded. Please try another song or try again later.'
//                     }, { quoted: message });
//                     return;
//                 }
//             }
//         } catch (e1) {
//             try {
//                 // Try zenkey API as fallback
//                 const zenkeyRes = await fetch(`https://api.zenkey.my.id/api/download/ytmp3?apikey=zenkey&url=${encodeURIComponent(urlYt)}`);
//                 const zenkeyData = await zenkeyRes.json();
                
//                 if (zenkeyData && zenkeyData.result && zenkeyData.result.downloadUrl) {
//                     // Download the file first
//                     const response = await fetch(zenkeyData.result.downloadUrl);
//                     const buffer = await response.buffer();
                    
//                     // Write to temp file
//                     fs.writeFileSync(tempM4a, buffer);
                    
//                     // Convert to MP3 with proper WhatsApp-compatible settings
//                     await execPromise(`ffmpeg -i "${tempM4a}" -vn -acodec libmp3lame -ac 2 -ab 128k -ar 44100 "${tempFile}"`);
                    
//                     // Check file size
//                     const stats = fs.statSync(tempFile);
//                     if (stats.size < 1024) {
//                         throw new Error('Conversion failed');
//                     }

//                     await sock.sendMessage(chatId, {
//                         audio: { url: tempFile },
//                         mimetype: "audio/mpeg",
//                         fileName: `${video.title}.mp3`,
//                         ptt: false
//                     }, { quoted: message });

//                     // Clean up temp files after a delay to ensure WhatsApp has read the file
//                     setTimeout(() => {
//                         try {
//                             if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
//                             if (fs.existsSync(tempM4a)) fs.unlinkSync(tempM4a);
//                         } catch (cleanupErr) {
//                         }
//                     }, 5000);
//                     return;
//                 }
//             } catch (e2) {
//                 try {
//                     // Try axeel API as last resort
//                     const axeelRes = await fetch(`https://api.axeel.my.id/api/download/ytmp3?apikey=axeel&url=${encodeURIComponent(urlYt)}`);
//                     const axeelData = await axeelRes.json();
                    
//                     if (axeelData && axeelData.result && axeelData.result.downloadUrl) {
//                         // Download the file first
//                         const response = await fetch(axeelData.result.downloadUrl);
//                         const buffer = await response.buffer();
                        
//                         // Write to temp file
//                         fs.writeFileSync(tempM4a, buffer);
                        
//                         // Convert to MP3 with proper WhatsApp-compatible settings
//                         await execPromise(`ffmpeg -i "${tempM4a}" -vn -acodec libmp3lame -ac 2 -ab 128k -ar 44100 "${tempFile}"`);
                        
//                         // Check file size
//                         const stats = fs.statSync(tempFile);
//                         if (stats.size < 1024) {
//                             throw new Error('Conversion failed');
//                         }

//                         await sock.sendMessage(chatId, {
//                             audio: { url: tempFile },
//                             mimetype: "audio/mpeg",
//                             fileName: `${video.title}.mp3`,
//                             ptt: false
//                         }, { quoted: message });

//                         // Clean up temp files after a delay to ensure WhatsApp has read the file
//                         setTimeout(() => {
//                             try {
//                                 if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
//                                 if (fs.existsSync(tempM4a)) fs.unlinkSync(tempM4a);
//                             } catch (cleanupErr) {
//                             }
//                         }, 5000);
//                         return;
//                     }
//                 } catch (e3) {
//                     throw new Error("All download methods failed");
//                 }
//             }
//         }
//     } catch (error) {
//         await sock.sendMessage(chatId, { 
//             text: "Download failed. Please try again later."
//         });
//     }
// }

// function formatDuration(seconds) {
//     const hours = Math.floor(seconds / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
//     const remainingSeconds = seconds % 60;
    
//     if (hours > 0) {
//         return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
//     } else {
//         return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
//     }
// }

// function formatNumber(num) {
//     return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// }

// module.exports = songCommand; 

// but do i need temp file 
// i dont want temp filecane we create new file



// let keep this is for next update 
// i want to make sure it realy work well

// const path = require('path');
// const Database = require('better-sqlite3');
// const LRU = require('lru-cache');
// const { initAuthCreds, makeCacheableSignalKeyStore, BufferJSON } = require('@whiskeysockets/baileys');
// const { saveSessionToSupabase } = require('./supabaseAuthState');

// const dbPath = path.join(__dirname, '../../sessions.sqlite');
// const db = new Database(dbPath);

// db.exec(`
//   CREATE TABLE IF NOT EXISTS sessions (
//     phoneNumber TEXT PRIMARY KEY,
//     creds TEXT NOT NULL,
//     keys TEXT NOT NULL,
//     authId TEXT,
//     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
//   );
// `);

// const memoryCache = new LRU({
//   max: 100,
//   ttl: 1000 * 60 * 30
// });

// function saveSession(phoneNumber, creds, keys, authId) {
//   const serializedCreds = JSON.stringify(creds, BufferJSON.replacer);
//   const serializedKeys = {};
//   for (const category in keys) {
//     serializedKeys[category] = {};
//     for (const id in keys[category]) {
//       serializedKeys[category][id] = JSON.stringify(keys[category][id], BufferJSON.replacer);
//     }
//   }
//   const stmt = db.prepare(`
//     INSERT INTO sessions (phoneNumber, creds, keys, authId, updated_at)
//     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
//     ON CONFLICT(phoneNumber) DO UPDATE SET
//       creds = excluded.creds,
//       keys = excluded.keys,
//       authId = excluded.authId,
//       updated_at = CURRENT_TIMESTAMP
//   `);
//   stmt.run(phoneNumber, serializedCreds, JSON.stringify(serializedKeys), authId);
//   memoryCache.set(phoneNumber, { creds, keys, authId });
// }

// function loadSession(phoneNumber) {
//   if (memoryCache.has(phoneNumber)) {
//     return memoryCache.get(phoneNumber);
//   }
//   const stmt = db.prepare(`SELECT creds, keys, authId FROM sessions WHERE phoneNumber = ?`);
//   const row = stmt.get(phoneNumber);
//   if (!row) return null;
//   const creds = JSON.parse(row.creds, BufferJSON.reviver);
//   const rawKeys = JSON.parse(row.keys);
//   const keys = {};
//   for (const category in rawKeys) {
//     keys[category] = {};
//     for (const id in rawKeys[category]) {
//       keys[category][id] = JSON.parse(rawKeys[category][id], BufferJSON.reviver);
//     }
//   }
//   const session = { creds, keys, authId: row.authId };
//   memoryCache.set(phoneNumber, session);
//   return session;
// }

// async function useHybridAuthState(phoneNumber, authId) {
//   let session = loadSession(phoneNumber);
//   if (!session) {
//     session = { creds: initAuthCreds(), keys: {}, authId };
//   } else {
//     session.authId = authId;
//   }
//   const wrappedKeys = makeCacheableSignalKeyStore({
//     get: async (type, ids) => {
//       const result = {};
//       if (session.keys[type]) {
//         for (const id of ids) {
//           if (session.keys[type][id]) {
//             result[id] = session.keys[type][id];
//           }
//         }
//       }
//       return result;
//     },
//     set: async (data) => {
//       for (const category in data) {
//         if (!session.keys[category]) session.keys[category] = {};
//         for (const id in data[category]) {
//           session.keys[category][id] = data[category][id];
//         }
//       }
//       saveSession(phoneNumber, session.creds, session.keys, session.authId);
//     }
//   });
//   return {
//     state: {
//       creds: session.creds,
//       keys: wrappedKeys
//     },
//     saveCreds: async () => {
//       saveSession(phoneNumber, session.creds, session.keys, session.authId);
//     }
//   };
// }

// async function syncSQLiteToSupabase() {
//   const stmt = db.prepare(`SELECT phoneNumber FROM sessions`);
//   const sessions = stmt.all();
//   for (const { phoneNumber } of sessions) {
//     const session = loadSession(phoneNumber);
//     if (session) {
//       await saveSessionToSupabase(phoneNumber, {
//         creds: session.creds,
//         keys: session.keys,
//         authId: session.authId,
//       });
//     }
//   }
//   console.log(`✅ Synced ${sessions.length} sessions to Supabase`);
// }

// module.exports = {
//   useHybridAuthState,
//   saveSession,
//   loadSession,
//   syncSQLiteToSupabase
// };
