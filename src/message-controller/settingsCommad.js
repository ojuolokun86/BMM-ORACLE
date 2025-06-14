const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // Import media download function
const { sendToChat } = require('../utils/messageUtils'); // Import the sendToChat function
const { generateProfilePicture } = require('@whiskeysockets/baileys'); // Import the function
const globalStore = require('../utils/globalStore'); // Import the global store
const { deleteUserData } = require('../database/userDatabase')
const { updateFormatResponseSetting } = require('../utils/utils'); // Add at the top if not present
const { normalizeUserId } = require('../utils/utils');
const { dndSettings } = require('../utils/globalStore');
const {
    DND_MODES,
    setDndMode,
    addToWhitelist,
    removeFromWhitelist,
    addToBlacklist,
    removeFromBlacklist,
    setContactsOnly,
    getDndSettingsCached,
} = require('../dnd/dndManager');
const { formatDndList } = require('../dnd/dndText');


/**
 * Handle settings-related commands.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {object} message - The incoming message object.
 * @param {string} remoteJid - The chat ID.
 * @param {string} userId - The bot owner's ID.
 * @param {string} command - The settings command.
 * @param {string[]} args - The command arguments.
 * @returns {Promise<void>}
 */
const handleSettingsCommand = async (sock, message, remoteJid, userId, command, args, botInstance, realSender, normalizedUserId, subscriptionLevel, botLid) => {
    try {
            // Restrict all commands to the bot owner
            if (realSender !== normalizedUserId && realSender !== botLid) {
            await sendToChat(botInstance, remoteJid, {
                message: `❌ Only the bot owner can use this command.`,
            });
            return;
        }
    
        
        switch (command) {
            case 'setpic':
                console.log('🖼️ Executing "setprofilepic" command...');
                try {
                    // Check if the message is a reply to an image
                    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    const quotedMessageType = quotedMessage ? Object.keys(quotedMessage)[0] : null;
            
                    if (quotedMessageType !== 'imageMessage') {
                        console.error('❌ No image found in the quoted message.');
                        await sendToChat(sock, remoteJid, {
                            message: '❌ Please reply to an image message to set it as the profile picture.',
                        });
                        return;
                    }
            
                    // Download the image from the quoted message
                    const imageMessage = quotedMessage.imageMessage;
                    const imageBuffer = await downloadMediaMessage(
                        { message: { imageMessage } },
                        'buffer',
                        {}
                    );
            
                    if (!imageBuffer || imageBuffer.length === 0) {
                        console.error('❌ Failed to download the image. Buffer is empty or corrupted.');
                        await sendToChat(sock, remoteJid, {
                            message: '❌ Failed to download the image. Please try again later.',
                        });
                        return;
                    }
            
                    // Debug the buffer size
                    console.log(`🔍 Image buffer size: ${imageBuffer.length} bytes`);
            
                    // Generate the profile picture using the downloaded buffer
                    let img;
                    try {
                        const result = await generateProfilePicture(imageBuffer);
                        img = result.img;
                        console.log('🔍 Generated profile picture successfully:', result);
                    } catch (error) {
                        console.error('❌ Failed to generate profile picture:', error);
                        await sendToChat(sock, remoteJid, {
                            message: '❌ Failed to process the image. Please try again later.',
                        });
                        return;
                    }
            
                    // Debug the generated image
                    console.log('🔍 Generated image object:', img);
                    // Ensure userId is in JID format
                        const userJid = userId.includes('@s.whatsapp.net') ? userId : `${userId}@s.whatsapp.net`;
                        console.log('🔍 JID to update profile picture for:', userJid);

                        // Set the profile picture
                    try {
                        await sock.updateProfilePicture(userJid, img);
                        console.log('✅ Profile picture updated successfully.');
            
                        await sendToChat(sock, remoteJid, {
                            message: '✅ Profile picture updated successfully!',
                        });
                    } catch (error) {
                        console.error('❌ Failed to update profile picture:', error);
                        await sendToChat(sock, remoteJid, {
                            message: '❌ Failed to update profile picture. Please try again later.',
                        });
                    }
                } catch (error) {
                    console.error('❌ An unexpected error occurred:', error);
                    await sendToChat(sock, remoteJid, {
                        message: '❌ An unexpected error occurred. Please try again later.',
                    });
                }
                break;
                case 'setname':
                    console.log('✏️ Executing "setname" command...');
                    try {
                        // Check if a name is provided
                        const newName = args.join(' ').trim();
                        if (!newName) {
                            console.error('❌ No name provided.');
                            await sendToChat(sock, remoteJid, {
                                message: '❌ Please provide a name to set. Usage: `.setname <name>`',
                            });
                            return;
                        }

                        // Update the bot's display name
                        await sock.updateProfileName(newName);
                        console.log(`✅ Profile name updated successfully to: ${newName}`);

                        await sendToChat(sock, remoteJid, {
                            message: `✅ Profile name updated successfully to: *${newName}*`,
                        });
                    } catch (error) {
                        console.error('❌ Failed to update profile name:', error);
                        await sendToChat(sock, remoteJid, {
                            message: '❌ Failed to update profile name. Please try again later.',
                        });
                    }
                    break;
                   case 'presence':
                            console.log('🔄 Executing "setpresence" command...');
                            try {
                                const presenceType = args[0]; // e.g., available, unavailable, composing, recording, dynamic
                                const botInstanceId = userId;
                                const { setDynamicPresence } = require('../utils/messageUtils');

                                // List of valid presence types
                                const validPresenceTypes = ['available', 'unavailable', 'composing', 'recording', 'dynamic'];

                                if (!validPresenceTypes.includes(presenceType)) {
                                    console.error('❌ Invalid presence type.');
                                    await sendToChat(sock, remoteJid, {
                                        message: '❌ Invalid presence type. Please use: available, unavailable, composing, recording, or dynamic.',
                                    });
                                    return;
                                }

                                if (presenceType === 'dynamic') {
                                    // Enable global dynamic presence updates for the bot instance
                                    globalStore.presenceSettings[botInstanceId] = {
                                        globalPresenceType: args[1] || 'available', // Default to "available" if no type is provided
                                    };
                                    console.log(`✅ Global dynamic presence updates enabled with type: ${globalStore.presenceSettings[botInstanceId].globalPresenceType}`);
                                    await sendToChat(sock, remoteJid, {
                                        message: `✅ Global dynamic presence updates enabled with type: *${globalStore.presenceSettings[botInstanceId].globalPresenceType}*`,
                                    });
                                    // Optionally, set presence now
                                    await setDynamicPresence(sock, remoteJid, globalStore.presenceSettings[botInstanceId].globalPresenceType, 5000);
                                    return;
                                }

                                if (presenceType === 'unavailable') {
                                    // Disable global dynamic presence updates for the bot instance
                                    delete globalStore.presenceSettings[botInstanceId];
                                    console.log('✅ Global dynamic presence updates disabled.');
                                    await setDynamicPresence(sock, remoteJid, 'unavailable', 1000);
                                    await sendToChat(sock, remoteJid, {
                                        message: '✅ Global dynamic presence updates disabled and presence set to unavailable.',
                                    });
                                    return;
                                }

                                // For available, composing, recording: set presence with cooldown
                                await setDynamicPresence(sock, remoteJid, presenceType, 5000);
                                console.log(`🔄 Updated presence for: ${remoteJid}`);
                                await sendToChat(sock, remoteJid, {
                                    message: `✅ Presence set to "${presenceType}" for this chat (auto-resets after 5s).`,
                                });

                            } catch (error) {
                                console.error('❌ An error occurred while updating presence:', error);
                                await sendToChat(sock, remoteJid, {
                                    message: '❌ Failed to update presence. Please try again later.',
                                });
                            }
                            break;
                                            

                        case 'setstatus':
                        console.log('✏️ Executing "setstatus" command...');
                        try {
                            // Check if a status message is provided
                            const newStatus = args.join(' ').trim();
                            if (!newStatus) {
                                console.error('❌ No status provided.');
                                await sendToChat(sock, remoteJid, {
                                    message: '❌ Please provide a status to set. Usage: `.setstatus <status>`',
                                });
                                return;
                            }

                            // Update the bot's "About Me" status
                            await sock.updateProfileStatus(newStatus);
                            console.log(`✅ Status updated successfully to: ${newStatus}`);

                            await sendToChat(sock, remoteJid, {
                                message: `✅ Status updated successfully to: *${newStatus}*`,
                            });
                        } catch (error) {
                            console.error('❌ Failed to update status:', error);
                            await sendToChat(sock, remoteJid, {
                                message: '❌ Failed to update status. Please try again later.',
                            });
                        }
                        break;

                       case 'seen':
                        console.log('👁️ Executing "seen" command...');
                        try {
                            const option = args[0]?.toLowerCase(); // Get the first argument (on/off)

                            if (!['on', 'off'].includes(option)) {
                                await sendToChat(sock, remoteJid, {
                                    message: '❌ Invalid option. Usage: `.seen on` or `.seen off`',
                                });
                                return;
                            }

                            const botInstanceId = userId; // Use userId as the instance key

                            if (option === 'on') {
                                globalStore.readReceiptSettings[botInstanceId] = true;
                                await sendToChat(sock, remoteJid, {
                                    message: '✅ Read receipts (blue tick) are now ENABLED.',
                                });
                            } else if (option === 'off') {
                                globalStore.readReceiptSettings[botInstanceId] = false;
                                await sendToChat(sock, remoteJid, {
                                    message: '✅ Read receipts (blue tick) are now DISABLED.',
                                });
                            }
                        } catch (error) {
                            await sendToChat(sock, remoteJid, {
                                message: '❌ Failed to update read receipt setting. Please try again later.',
                            });
                        }
                        break;

                    case 'block':
                    try {
                        let targetJid;
                        if (args.length > 0) {
                            // If a number is provided, normalize it to JID
                            const num = args[0].replace(/[^0-9]/g, '');
                            if (num.length > 5) {
                                targetJid = num + '@s.whatsapp.net';
                            }
                        } else {
                            // If no argument, block the user in the current DM
                            if (remoteJid.endsWith('@s.whatsapp.net')) {
                                targetJid = remoteJid;
                            }
                        }

                        if (!targetJid) {
                            await sendToChat(sock, remoteJid, {
                                message: '❌ Please use `.block` in a DM or `.block <number>` to block a user.',
                            });
                            return;
                        }

                        await sock.updateBlockStatus(targetJid, 'block');
                        await sendToChat(sock, remoteJid, {
                            message: `✅ User ${targetJid.split('@')[0]} has been blocked.`,
                        });
                    } catch (error) {
                        console.error('❌ Failed to block user:', error);
                        await sendToChat(sock, remoteJid, {
                            message: '❌ Failed to block user. Please try again later.',
                        });
                    }
                    break;

                    case 'unblock':
                try {
                    let targetJid;
                    if (args.length > 0) {
                        // If a number is provided, normalize it to JID
                        const num = args[0].replace(/[^0-9]/g, '');
                        if (num.length > 5) {
                            targetJid = num + '@s.whatsapp.net';
                        }
                    } else {
                        // If no argument, unblock the user in the current DM
                        if (remoteJid.endsWith('@s.whatsapp.net')) {
                            targetJid = remoteJid;
                        }
                    }

                    if (!targetJid) {
                        await sendToChat(sock, remoteJid, {
                            message: '❌ Please use `.unblock` in a DM or `.unblock <number>` to unblock a user.',
                        });
                        return;
                    }

                    await sock.updateBlockStatus(targetJid, 'unblock');
                    await sendToChat(sock, remoteJid, {
                        message: `✅ User ${targetJid.split('@')[0]} has been unblocked.`,
                    });
                } catch (error) {
                    console.error('❌ Failed to unblock user:', error);
                    await sendToChat(sock, remoteJid, {
                        message: '❌ Failed to unblock user. Please try again later.',
                    });
                }
                break;

                case 'logout':
                    console.log('🚪 Executing "logout" command...');
                    const phoneNumber = userId
                    try {
                        // Delete the bot instance and all related data for this user
                        await deleteUserData(phoneNumber);
                        await sendToChat(sock, remoteJid, {
                            message: '✅ Bot has been logged out and all session data deleted for this user.',
                        });
                        console.log(`✅ Bot instance and data deleted for user: ${phoneNumber}`);
                    } catch (error) {
                        console.error('❌ Failed to logout and delete bot instance:', error);
                        await sendToChat(sock, remoteJid, {
                            message: '❌ Failed to log out and delete bot instance. Please try again later.',
                        });
                    }
                    break;

                    case 'formatrespond':
                console.log('🔧 Executing "formatrespond" command...');
                try {

                      if (!['premium'].includes(subscriptionLevel)) {
                        await sendToChat(sock, remoteJid, {
                            message: '❌ Only premium users can use this command.',
                        });
                        return;
                    }
                    const option = args[0]?.toLowerCase();
                    if (!['on', 'off'].includes(option)) {
                        await sendToChat(botInstance, remoteJid, {
                            message: '❌ Invalid option. Usage: `.formatrespond on` or `.formatrespond off`',
                        });
                        return;
                    }
                  const normalizedId = normalizeUserId(userId);
                    await updateFormatResponseSetting(normalizedId, option === 'on');
                    await sendToChat(botInstance, remoteJid, {
                        message: option === 'on'
                            ? '✅ BMM Bot format response is now ENABLED.'
                            : '✅ BMM Bot format response is now DISABLED.',
                    });
                } catch (error) {
                    console.error('❌ Failed to update format response setting:', error);
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ Failed to update format response setting. Please try again later.',
                    });
                }
                break;
        case 'privacy':
        try {
    if (!['gold', 'premium'].includes(subscriptionLevel)) {
      await sendToChat(sock, remoteJid, { message: '❌ Only gold and premium users can use this command.' });
      return;
    }

    const option = args[0]?.toLowerCase();

    // Map command input to Baileys privacy options
    const validOptions = ['all', 'contacts', 'contact_blacklist', 'none'];
    if (!validOptions.includes(option)) {
      await sendToChat(sock, remoteJid, { message: '❌ Invalid option. Usage: `.privacy all|contacts|contact_blacklist|none`' });
      return;
    }

    // Call Baileys privacy update functions
    // You can update multiple privacy settings, here example for last seen, profile picture, status, read receipts, online:
    console.log(`🔒 Updating privacy settings to: ${option}`);
    await Promise.all([
        console.log(`🔒 Updating privacy settings to: ${option}`),
      sock.updateLastSeenPrivacy(option),
      console.log(`🔒 Updating last seen privacy settings to: ${option}`),
      sock.updateProfilePicturePrivacy(option),
        console.log(`🔒 Updating profile picture privacy settings to: ${option}`),
      sock.updateStatusPrivacy(option),
      console.log(`🔒 Updating status privacy settings to: ${option}`),
      sock.updateReadReceiptsPrivacy(option),
      console.log(`🔒 Updating read receipts privacy settings to: ${option}`),
      sock.updateOnlinePrivacy(option),
      console.log(`🔒 Updating online privacy settings to: ${option}`),
    ]);

    await sendToChat(sock, remoteJid, { message: `✅ Privacy updated successfully to: *${option}*` });
  } catch (error) {
    console.error('❌ Failed to update privacy:', error);
    await sendToChat(sock, remoteJid, { message: '❌ Failed to update privacy: ' + (error.message || 'Unknown error') });
  }
  break;
    case 'dnd':
    try {
        const subcmd = (args[0] || '').toLowerCase();
        const userOrGroupId = userId; // or remoteJid for group

        if (subcmd === 'mode') {
            const settings = await getDndSettingsCached(userOrGroupId);
            await sendToChat(sock, remoteJid, {
                message: `🔕 DND Modes:\n01. Off All\n02. On All\n03. Voice Only\n04. Video Only\n05. Contacts Only\n\nCurrent: ${settings.mode}`,
            });
            return;
        }

        // Change mode by code
        if (subcmd === 'chmod') {
            const code = args[1];
            let mode;
            switch (code) {
                case '01': mode = DND_MODES.OFF_ALL; break;
                case '02': mode = DND_MODES.ON_ALL; break;
                case '03': mode = DND_MODES.VOICE_ONLY; break;
                case '04': mode = DND_MODES.VIDEO_ONLY; break;
                case '05': mode = DND_MODES.CONTACTS_ONLY; break;
                default:
                    await sendToChat(sock, remoteJid, { message: '❌ Invalid mode code.' });
                    return;
            }
            await setDndMode(userOrGroupId, mode);
            await sendToChat(sock, remoteJid, { message: `✅ DND mode changed to: ${mode}` });
            return;
        }

        // Whitelist/Blacklist management
        if (subcmd === 'w') {
            const action = args[1];
            const number = args[2];
            if (action === 'add' && number) {
                const jid = number.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                await addToWhitelist(userOrGroupId, jid);
                await sendToChat(sock, remoteJid, { message: `✅ Added to whitelist: ${jid}` });
                return;
            }
            if (action === 'remove' && number) {
                const jid = number.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                await removeFromWhitelist(userOrGroupId, jid);
                await sendToChat(sock, remoteJid, { message: `✅ Removed from whitelist: ${jid}` });
                return;
            }
            if (action === 'clear') {
                const settings = await getDndSettingsCached(userOrGroupId);
                settings.whitelist = [];
                await setDndMode(userOrGroupId, settings.mode); // Save with cleared whitelist
                await sendToChat(sock, remoteJid, { message: `✅ Whitelist cleared.` });
                return;
            }
            // View list
            const settings = await getDndSettingsCached(userOrGroupId);
            await sendToChat(sock, remoteJid, { message: formatDndList(settings.whitelist, 'Whitelist') });
            return;
        }
        if (subcmd === 'b') {
            const action = args[1];
            const number = args[2];
            if (action === 'add' && number) {
                const jid = number.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                await addToBlacklist(userOrGroupId, jid);
                await sendToChat(sock, remoteJid, { message: `✅ Added to blacklist: ${jid}` });
                return;
            }
            if (action === 'remove' && number) {
                const jid = number.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                await removeFromBlacklist(userOrGroupId, jid);
                await sendToChat(sock, remoteJid, { message: `✅ Removed from blacklist: ${jid}` });
                return;
            }
             if (action === 'clear') {
                const settings = await getDndSettingsCached(userOrGroupId);
                settings.blacklist = [];
                await setDndMode(userOrGroupId, settings.mode); // Save with cleared blacklist
                await sendToChat(sock, remoteJid, { message: `✅ Blacklist cleared.` });
                return;
            }
            // View list
            const settings = await getDndSettingsCached(userOrGroupId);
            await sendToChat(sock, remoteJid, { message: formatDndList(settings.blacklist, 'Blacklist') });
            return;
        }

        // Contacts only
        if (subcmd === 'contacts') {
            const option = args[1];
            if (option === 'on') await setContactsOnly(userOrGroupId, true);
            else if (option === 'off') await setContactsOnly(userOrGroupId, false);
            else {
                const settings = await getDndSettingsCached(userOrGroupId);
                await sendToChat(sock, remoteJid, { message: `Contacts only: ${settings.contactsOnly ? 'ON' : 'OFF'}` });
                return;
            }
            await sendToChat(sock, remoteJid, { message: `✅ Contacts-only mode updated.` });
            return;
        }

        await sendToChat(sock, remoteJid, {
            message: '❌ Invalid DND command. Use `.dnd mode`, `.dnd chmod <code>`, `.dnd whitelist add/remove <jid>`, `.dnd blacklist add/remove <jid>`, `.dnd contacts on/off`.',
        });
    } catch (error) {
        console.error('❌ Failed to update DND setting:', error);
        await sendToChat(sock, remoteJid, {
            message: '❌ Failed to update DND setting. Please try again later.',
        });
    }
    break;


        }
    } catch (error) {
        console.error('❌ An error occurred while handling the settings command:', error);
        await sendToChat(sock, remoteJid, {
            message: '❌ An error occurred while processing your request. Please try again later.',
        });
    }
};

module.exports = { handleSettingsCommand };