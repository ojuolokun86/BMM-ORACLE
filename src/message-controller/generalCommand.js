const { sendToChat } = require('../utils/messageUtils');
const { getInfo, getAboutMe } = require('../utils/about');
const { restartUserBot } = require('../bot/restartBot');
const { setChatAntidelete, setGlobalAntideleteForDMs } = require('./antidelete'); // Import the setChatAntidelete function
const { getUserTagFormat, updateUserTagFormat } = require('../database/userDatabase')
const { getGroupMode, setGroupMode } = require('../bot/groupModeManager'); // Import setGroupMode
const { repostViewOnceMedia, detectViewOnceMedia } = require('./viewonce'); // Adjust path if needed
const { getUserPrefix, updateUserPrefix } = require('../database/userPrefix'); // Import prefix functions


const { handleStatusCommand } = require('./statusView'); // Import the status command handler


const handleGeneralCommand = async (sock, message, command, args, userId, remoteJid, botInstance, realSender, botOwnerIds, normalizedUserId, botLid, authId) => {
    const phoneNumber = userId; // Use userId as phoneNumber
    try {
        const isGroup = remoteJid.endsWith('@g.us');
                   // Restrict all commands to the bot owner
            if (realSender !== normalizedUserId && realSender !== botLid) {
                await sendToChat(botInstance, remoteJid, {
                    message: `❌ Only the bot owner can use this command.`,
                });
                return;
            }

        switch (command) {

          case 'ping':
            console.log('🏓 Executing "ping" command...');
            await sendToChat(botInstance, remoteJid, {
                message: 'pong',
                quotedMessage: message
            });
            console.log('✅ Reply sent: "pong"');
            break;
         case 'view':
                console.log('🔄 Executing ".view" command...');

                try {
                    // Extract quoted message from the command message (the reply)
                    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

                    if (!quotedMessage) {
                        console.log('❌ No quoted message found. Please reply to a view-once media message.');
                        await sendToChat(botInstance, remoteJid, {
                            message: '❌ Please reply to a valid view-once message.',
                            quotedMessage: message
                        });
                        return;
                    }

                    // Wrap quotedMessage with key info so detectViewOnceMedia can handle it properly
                    const detectedMedia = detectViewOnceMedia({
                        message: quotedMessage,
                        key: {
                            id: message.message.extendedTextMessage.contextInfo.stanzaId,
                            remoteJid: message.key.remoteJid,
                            participant: message.message.extendedTextMessage.contextInfo.participant || message.key.participant
                        }
                    });

                    if (!detectedMedia) {
                        console.log('❌ No view-once media detected in the quoted message.');
                        await sendToChat(botInstance, remoteJid, {
                            message: '❌ No view-once media found in the quoted message. Please reply to a valid view-once message.',
                            quotedMessage: message
                        });
                        return;
                    }

                    // ✅ If it's a reply to stored view-once (iPhone-safe)
                    if (detectedMedia.stored) {
                        const { stored } = detectedMedia;

                        await sock.sendMessage(remoteJid, {
                            [stored.mediaType.replace('Message', '')]: stored.mediaBuffer,
                            caption: `🔁 Reposted view-once from @${stored.senderJid.split('@')[0]}\n\n📄 ${stored.caption}`,
                            mentions: [stored.senderJid],
                        }, { quoted: message });

                        console.log(`✅ View-once media reposted from storage for iPhone-compatible reply by ${userId}`);
                    } 
                    // ✅ Otherwise, repost it using original method
                    else {
                        await repostViewOnceMedia(sock, detectedMedia, userId);
                        console.log(`✅ View-once media reposted live by bot instance: ${userId}`);
                    }

                } catch (error) {
                    console.error(`❌ Failed to repost view-once media by bot instance: ${userId}`, error);
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ Failed to repost the view-once media. Please try again later.',
                        quotedMessage: message
                    });
                }

                break;

        case 'info':
            console.log('ℹ️ Executing "info" command...');
            const info = getInfo();
            await sendToChat(botInstance, remoteJid, { message: info, quotedMessage: message });
            console.log('✅ Info sent.');
            break;

        case 'about':
            console.log('📖 Executing "about" command...');
            const about = getAboutMe();
            await sendToChat(botInstance, remoteJid, { message: about, quotedMessage: message });
            console.log('✅ About sent.');
            break;

            case 'prefix':
                console.log('🔤 Executing "prefix" command...');
                const newPrefix = args[0]; // Extract the new prefix from the arguments
            
                if (!newPrefix || newPrefix.length > 3) {
                    // Validate the new prefix (e.g., non-empty and max length of 3 characters)
                    await sendToChat(botInstance, remoteJid, {
                        message: `❌ Invalid prefix. Please provide a valid prefix (1-3 characters). Usage: ${userPrefix}prefix <new_prefix>`,
                        quotedMessage: message
                    });
                    return;
                }
            
                try {
                    // Update the prefix in the database
                    await updateUserPrefix(userId, newPrefix);
                    await sendToChat(botInstance, remoteJid, {
                        message: `✅ Prefix updated to "${newPrefix}".`,
                        quotedMessage: message
                    });
                    console.log(`✅ Prefix for user ${normalizedUserId} updated to "${newPrefix}".`);
                } catch (error) {
                    console.error(`❌ Failed to update prefix for user ${normalizedUserId}:`, error);
                    await sendToChat(botInstance, remoteJid, {
                        message: `❌ Failed to update prefix. Please try again later.`,
                        quotedMessage: message
                    });
                }
                break;

                case 'restart':
                    console.log('🔄 Executing "restart" command...');
                    try {
                     // Notify the user that the bot is restarting
                        await sendToChat(botInstance, remoteJid, {
                            message: '🔄 Restarting the bot. Please wait...',
                        });
            
                        // Restart the bot
                        const restartSuccess = await restartUserBot(userId, remoteJid, authId);
                        if (restartSuccess) {
                            console.log(`✅ Bot restarted successfully for user: ${userId}`);
                        } else {
                            console.error(`❌ Failed to restart bot for user: ${userId}`);
                            await sendToChat(botInstance, remoteJid, {
                                message: '❌ Failed to restart the bot. Please try again later.',
                            });
                        }
                    } catch (error) {
                        console.error(`❌ Failed to execute "restart" command for user: ${userId}`, error);
                        await sendToChat(botInstance, remoteJid, {
                            message: '❌ An error occurred while restarting the bot. Please try again later.',
                        });
                    }
                    break;
            case 'tagformat':
                console.log('⚙️ Executing "tagformat" command...');
                try {
                    // Toggle the tagformat setting
                    const currentTagFormat = await getUserTagFormat(userId); // Fetch the current setting
                    const newTagFormat = !currentTagFormat; // Toggle the setting
            
                    // Save the new setting to Supabase
                    await updateUserTagFormat(userId, newTagFormat);
            
                    await sendToChat(botInstance, remoteJid, {
                        message: `✅ Tagall format switched to ${newTagFormat ? 'formatted' : 'plain'} mode.`,
                    });
                    console.log(`✅ Tagall format for user ${ normalizedUserId} switched to ${newTagFormat ? 'formatted' : 'plain'} mode.`);
                } catch (error) {
                    console.error('❌ Failed to toggle tagformat setting:', error);
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ Failed to toggle tagall format. Please try again later.',
                    });
                }
                break;

            case 'setmode':
                try {
                    console.log('⚙️ Executing "setmode" command...');
                    if (!isGroup) {
                        await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                        return;
                    }
                
                    const newMode = args[0]?.toLowerCase(); // Get the mode argument
                
                    // Validate the mode argument
                    if (!newMode) {
                        console.error(`❌ Missing mode argument for group ${remoteJid}`);
                        await sendToChat(botInstance, remoteJid, {
                            message: '❌ Missing mode argument. Please use "setmode me" or "setmode admin".',
                        });
                        return;
                    }
                
                    // Allow only "me" and "admin" as valid modes
                    if (!['me', 'admin'].includes(newMode)) {
                        console.error(`❌ Invalid mode "${newMode}" for group ${remoteJid}`);
                        await sendToChat(botInstance, remoteJid, {
                            message: '❌ Invalid mode. Please use one of the following: "me", "admin".',
                        });
                        return;
                    }
                
                    // Check if the sender is either the bot owner (ID or LID matches)
                    if (realSender !== userId && realSender !== botLid) {
                        console.log(`👹 Bot owner ID: ${userId}, Bot owner LID: ${botLid}`);
                        console.log(`❌ Command denied: Sender ${realSender} is not authorized to control this bot instance.`);
                        await sendToChat(botInstance, remoteJid, {
                            message: `❌ You are not authorized to control this bot instance.`,
                        });
                        return;
                    }
                
                    // Update the group mode in the database
                    await setGroupMode(userId, remoteJid, newMode);
                    await sendToChat(botInstance, remoteJid, {
                        message: `✅ Group mode has been set to "${newMode}".`,
                    });
                    console.log(`✅ Group mode for ${remoteJid} set to "${newMode}".`);
                } catch (error) {
                    console.error(`❌ Failed to set group mode for ${remoteJid}:`, error);
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ Failed to set group mode. Please try again later.',
                    });
                }
                break;
                                    case 'antidelete':
                        console.log('⚙️ Executing "antidelete" command...');
                        const combinedArg = args[0]?.toLowerCase(); // Get the combined argument (e.g., chaton, chatoff, on, off)

                        // Validate the combined argument
                        if (!['chaton', 'chatoff', 'on', 'off'].includes(combinedArg)) {
                            await sendToChat(botInstance, remoteJid, {
                                message: `❌ Invalid argument. Usage:\n- ${userPrefix}antidelete chaton\n- ${userPrefix}antidelete chatoff\n- ${userPrefix}antidelete on\n- ${userPrefix}antidelete off`,
                            });
                            return;
                        }

                        if (combinedArg.startsWith('chat')) {
                            // Handle global antidelete for DMs
                            if (isGroup) {
                                await sendToChat(botInstance, remoteJid, {
                                    message: '❌ Global antidelete can only be applied to DMs, not groups.',
                                });
                                return;
                            }

                            try {
                                const isEnabled = combinedArg === 'chaton';
                                await setGlobalAntideleteForDMs(userId, isEnabled); // Enable or disable global DM antidelete
                                await sendToChat(botInstance, remoteJid, {
                                    message: `✅ Global antidelete for DMs has been ${isEnabled ? 'enabled' : 'disabled'}.`,
                                });
                                console.log(`✅ Global antidelete for DMs set to ${isEnabled ? 'enabled' : 'disabled'} by ${realSender}.`);
                            } catch (error) {
                                console.error(`❌ Failed to update global antidelete for DMs:`, error);
                                await sendToChat(botInstance, remoteJid, {
                                    message: '❌ Failed to update global antidelete for DMs. Please try again later.',
                                });
                            }
                        } else {
                            // Handle per-chat antidelete
                            try {
                                const isEnabled = combinedArg === 'on';
                                await setChatAntidelete(remoteJid, userId, isEnabled); // Enable or disable antidelete for the specific chat
                                await sendToChat(botInstance, remoteJid, {
                                    message: `✅ Antidelete has been ${isEnabled ? 'enabled' : 'disabled'} for this chat.`,
                                });
                                console.log(`✅ Antidelete for chat ${remoteJid} set to ${isEnabled ? 'enabled' : 'disabled'} by ${realSender}.`);
                            } catch (error) {
                                console.error(`❌ Failed to update antidelete for chat ${remoteJid}:`, error);
                                await sendToChat(botInstance, remoteJid, {
                                    message: '❌ Failed to update antidelete for this chat. Please try again later.',
                                });
                            }
                    }
                    break;


                    case 'status':
                        console.log('📜 Executing "status" command...');
                        await handleStatusCommand(sock, command, args, userId, botInstance);
                        break;

                        case 'deleteit':
                            try {
                                // Only allow in DMs
                                if (remoteJid.endsWith('@s.whatsapp.net')) {
                                    console.log('🗑️ Executing "deleteit" command...');
                                    // Delete the command message
                                    await sock.sendMessage(remoteJid, { delete: message.key });
                                } else {
                                    await sendToChat(botInstance, remoteJid, {
                                        message: '❌ This command can only be used in direct messages.',
                                        quotedMessage: message
                                    });
                                }
                            } catch (error) {
                                await sendToChat(botInstance, remoteJid, {
                                    message: '❌ Failed to delete the message.',
                                    quotedMessage: message
                                });
                            }
                            break;

                        default:
                            return false; // Command not handled
                    }
            
                    return true; // Command handled
                } catch (error) {
                    console.error(`❌ An error occurred while handling the general command "${command}":`, error);
                    return true; // Command handled (with error)
                }
            };
 module.exports = { handleGeneralCommand };