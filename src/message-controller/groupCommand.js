const { generateProfilePicture } = require('@whiskeysockets/baileys'); // Import the function
const { fetchGroupMetadata, getGroupParticipants, getGroupName, getBotOwnerName, getGroupAdmins } = require('../utils/groupData'); // Import group data functions // Import group data functions
const { generateTagAllMessage } = require('../utils/style'); // Import tagall message formatter
const { downloadMediaMessage } = require(`@whiskeysockets/baileys`);
const env = require('../utils/loadEnv');
const { formatResponse } = require('../utils/utils'); // Import the formatResponse function
const { sendToChat } = require('../utils/messageUtils'); // Import the sendToChat function
const { getUserTagFormat } = require('../database/userDatabase'); // Import tagformat function
const { setWelcomeStatus, setWelcomeMessage } = require('../database/welcome'); // Import welcome functions
const { handleAntiLink, getAntiLinkSettings,updateAntiLinkSettings,} = require('./antilink'); // Import Anti-Link functions
const { getUserFromUsersTable } = require('../database/userDatabase'); // Import the function
const { normalizeUserId } = require('../utils/normalizeUserId'); // Import the normalize function
const { botInstances } = require('../utils/globalStore');
const { handleTagAllCommand } = require('./tagall'); // Import the tagall command handler
const { startAnnouncement, stopAnnouncement } = require('./groupAnnouncement'); // Import the announcement functions
const { startPoll, sendPollMessage, endPoll } = require('./poll'); // make sure path is correct
const { getGroupInfoMsg, getAntiLinkStatusMsg, getWarningListMsg, } = require('./text');
const { getGroupOwner } = require('../utils/groupData');
const { handleGroupStatsCommand, handleActiveMembersCommand, handleInactiveMembersCommand } = require('./groupStats');
const { requestKickAllConfirmation, confirmKickAll, cancelKickAll } = require('./kickAll');
const {requestDestroyGroupConfirmation, confirmDestroyGroup, cancelDestroyGroup, } = require('./destroyGroupUtils'); // Import Anti-Link functions
const { requestKickInactiveConfirmation, confirmKickInactive, cancelKickInactive } = require('./kickInactive');


const { 
    warnUser, 
    resetWarnings, 
    getWarnings, 
    getAllWarningsForGroup, 
    getWarningThreshold, 
    setWarningThreshold 
} = require('../database/warning'); // Import functions from warning.js
const { groupMessages } = require('../utils/globalStore'); // Import the groupMessages store
const { isAllowedByGroupMode, isBotAdmin } = require('../utils/permissions'); // Import permission functions



/**
 * Handle group-specific commands.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {object} message - The incoming message object.
 * @param {string} command - The command to execute.
 * @param {string[]} args - The command arguments.
 * @param {string} sender - The sender's ID.
 * @param {string} groupMode - The current group mode ("me", "admin", "all").
 * @param {string} userId - The bot owner's ID.
 * @param {object} botInstance - The bot instance for the current user.
 * @returns {Promise<boolean>} - Whether the command was handled.
 */
const handleGroupCommand = async (sock, userId, message, command, args, sender, groupMode, botInstance, useFormattedTagAll) => {
    if (!message || !message.key || !message.key.remoteJid) {
        console.error('❌ Invalid message object passed to handleGroupCommand:', message);
        return false; // Command not handled
    }
    const remoteJid = message.key.remoteJid; // Initialize remoteJid
    const isGroup = remoteJid.endsWith('@g.us'); // Check if the message is from a group
    const botLid =  sock.user?.lid.split(':')[0].split('@')[0]; // Fetch and normalize bot's LID
    const normalizedUserId = normalizeUserId(userId); // Normalize userId

    console.log(`🔍 Group Mode: ${groupMode}, Sender: ${sender}`);
    console.log(`🔍 Is Group: ${isGroup}, Remote JID: ${remoteJid}`);

    if (!isGroup) {
        console.log(`❌ Command "${command}" can only be used in groups.`);
        await sendToChat(botInstance, remoteJid, { 
            message: '❌ This command can only be used in groups.', 
            quotedMessage: message 
        });
        return true; // Command handled
    }
     // Check if the sender is allowed based on group mode
     const isAllowed = await isAllowedByGroupMode(sock, remoteJid, sender, botLid);
     if (!isAllowed) {
        return true; // Command handled
     }

     const botIsAdmin = await isBotAdmin(sock, remoteJid, botLid, botInstance); // Check if the bot is an admin
     console.log(`🔍 Bot Admin Status: ${botIsAdmin}`);
 // Handle specific group commands
    switch (command) {
                    case 'poll':
                console.log(`🔍 Entering "poll" command handler`);
                console.log(`🔍 Command arguments:`, args);

                if (!isGroup) {
                    console.log(`❌ Command "poll" can only be used in groups.`);
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ This command can only be used in groups.',
                    });
                    return true;
                }

                if (!botIsAdmin) {
                    console.log(`❌ Bot is not an admin in group ${remoteJid}.`);
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ I need to be an admin in this group to create a poll.',
                    });
                    return true;
                }

                const pollInput = args.join(' ').trim();

                // Smart splitting: support newlines or single-line with question mark
                let lines = pollInput.split('\n').map(l => l.trim()).filter(Boolean);

                if (lines.length < 2 && pollInput.includes('?')) {
                    const questionMarkIndex = pollInput.indexOf('?');
                    const question = pollInput.slice(0, questionMarkIndex + 1).trim();
                    const optionsRaw = pollInput.slice(questionMarkIndex + 1).trim();
                    const options = optionsRaw.split(/\s+/).filter(Boolean);
                    lines = [question, ...options];
                }

                if (lines.length < 3) {
                    console.log(`❌ Poll must include a question and at least two options.`);
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ Invalid format. Please provide a poll question followed by at least two options.\n\nExample:\n.poll Who should be the admin?\nFaith\nGedion\nTolu',
                    });
                    return true;
                }

                const question = lines[0];
                const options = lines.slice(1);

                console.log(`📊 Creating poll: "${question}" with options: ${options.join(', ')}`);

                // ✅ Pass userId to make poll instance-specific
                startPoll(userId, question, options);
                await sendPollMessage(botInstance, remoteJid, userId);

                return true;



            case 'endpoll':
                console.log('🛑 Ending current poll...');
            
                // ✅ Pass userId to fetch the right poll
                const results = endPoll(userId);
            
                if (!results) {
                    await sendToChat(botInstance, remoteJid, { message: '⚠️ No active poll to end.' });
                } else {
                    await sendToChat(botInstance, remoteJid, { message: results });
                }
            
                return true;
            


        case 'announce':
            if (args[0] === 'stop') {
                console.log(`🛑 Stopping announcement for group ${remoteJid} by bot instance ${userId}...`);
                await stopAnnouncement(remoteJid, userId);
                await sendToChat(botInstance, remoteJid, { message: '✅ Announcements have been stopped.' });
            } else {
                const interval = args[0]; // e.g., "h1 m30 s0"
                const message = args.slice(1).join(' '); // The rest of the arguments as the message
                if (!interval || !message) {
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ Invalid usage. Example: `.announce h1 m30 s0 This is an announcement.`',
                    });
                    return true; // Exit the function
                }
    
                console.log(`📢 Starting announcement for group ${remoteJid} by bot instance ${userId} with interval "${interval}" and message: "${message}"`);
                await startAnnouncement(sock, remoteJid, userId, interval, message);
                await sendToChat(botInstance, remoteJid, { message: '✅ Announcement started successfully.' });
            }
            return true; // Exit the function, no need for a break
    
    

        case 'tagall':
            if (!isGroup) {
                await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                return true;
            }
        
            try {
                console.log(`🔍 Executing "tagall" command in group ${remoteJid}...`);
        
                // Fetch the user's tagformat setting
                const useFormattedTagAll = await getUserTagFormat(userId);
        
                // Call the handleTagAllCommand function from tagall.js
                const handled = await handleTagAllCommand(sock, message, remoteJid, userId, useFormattedTagAll, args);
        
                if (handled) {
                    console.log('✅ "tagall" command successfully handled.');
                } else {
                    console.log('❌ "tagall" command failed to execute.');
                }
            } catch (error) {
                console.error(`❌ Failed to execute "tagall" command in group ${remoteJid}:`, error);
                await sendToChat(botInstance, remoteJid, { message: '❌ Failed to execute the tagall command. Please try again later.' });
            }
            return true;
                   
         

                

                    case 'delete':
                        console.log('🗑️ Executing "delete" command...');
                        if (!botIsAdmin) {
                            console.log(`❌ Bot is not an admin in group ${remoteJid}.`);
                            await sendToChat(botInstance, remoteJid, {
                                message: '❌ I need to be an admin in this group to delete message.',
                            });
                            return true;
                        }
                        try {
                            // Check if the message is a reply
                            const quotedMessageId = message.message?.extendedTextMessage?.contextInfo?.stanzaId;
                            const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;
                    
                            if (!quotedMessageId || !quotedParticipant) {
                                console.log('❌ No message was replied to for deletion.');
                                await sendToChat(botInstance, remoteJid, { message: '❌ Please reply to the message you want to delete.' });
                                return true; // Command handled
                            }
                            // Attempt to delete the message
                            await sock.sendMessage(remoteJid, {
                                delete: {
                                    remoteJid: remoteJid,
                                    id: quotedMessageId,
                                    participant: quotedParticipant,
                                },
                            });

                            // Mark this message as deleted by the bot so antidelete won't restore it
                            const { deletedMessagesByBot } = require('../utils/globalStore');
                            if (!deletedMessagesByBot[userId]) {
                                deletedMessagesByBot[userId] = new Set();
                            }
                            deletedMessagesByBot[userId].add(quotedMessageId);
                    
                            console.log('✅ Message deleted successfully.');
                        } catch (error) {
                            console.error('❌ Failed to execute "delete" command:', error);
                            await sendToChat(botInstance, remoteJid, { message: '❌ Failed to delete the message. Please try again later.' });
                        }
                        return true; // Command handled

                        case 'add':
                            console.log('➕ Executing "add" command...');
                            try {
                                if (!remoteJid.endsWith('@g.us')) {
                                    await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                                    return true; // Command handled
                                }

                                // Check if the bot is an admin
                                if (!botIsAdmin) {
                                    console.log('❌ Command "add" denied: The bot is not an admin in this group.');
                                    await sendToChat(botInstance, remoteJid, { message: '❌ I need to be a group admin to add members or generate an invite link.' });
                                    return true; // Command handled
                                }

                                // Extract the phone number from the arguments
                                const phoneNumber = args[0];
                                if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
                                    console.log('❌ Invalid phone number provided.');
                                    await sendToChat(botInstance, remoteJid, { message: '❌ Please provide a valid phone number to add.' });
                                    return true; // Command handled
                                }

                                const userJid = `${phoneNumber}@s.whatsapp.net`;

                                // Check if the user is already in the group
                                const groupMetadata = await sock.groupMetadata(remoteJid); // Fetch group metadata
                                const isAlreadyMember = groupMetadata.participants.some((participant) => participant.id === userJid);

                                if (isAlreadyMember) {
                                    console.log(`❌ User ${phoneNumber} is already a member of the group.`);
                                    await sendToChat(botInstance, remoteJid, { message: `❌ User ${phoneNumber} is already a member of the group.` });
                                    return true; // Command handled
                                }

                                // Generate the group invite link
                                console.log('🔗 Generating group invite link...');
                                const inviteCode = await sock.groupInviteCode(remoteJid);
                                const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
                                console.log(`✅ Group invite link generated: ${inviteLink}`);

                                // Send the invite link to the user via direct message
                                console.log(`📩 Sending invite link to ${phoneNumber} via direct message...`);
                                await sendToChat(botInstance, userJid, {
                                    message: `Hello! You have been invited to join the group "${groupMetadata.subject}". Click the link below to join:\n\n${inviteLink}`,
                                });

                                // Notify the group that the invite link has been sent
                                await sendToChat(botInstance, remoteJid, { message: `✅ Invite link sent to ${phoneNumber} via direct message.` });
                            } catch (error) {
                                console.error('❌ Failed to execute "add" command:', error);

                                // Handle specific errors
                                if (error.message.includes('not-authorized')) {
                                    await sendToChat(botInstance, remoteJid, { message: '❌ I do not have permission to generate an invite link for this group.' });
                                } else if (error.message.includes('invalid-jid')) {
                                    await sendToChat(botInstance, remoteJid, { message: '❌ The phone number provided is invalid or not registered on WhatsApp.' });
                                } else {
                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to send the invite link. Please try again later.' });
                                }
                            }
                            return true; // Command handled

                            case 'kick':
                            console.log('🚪 Executing "kick" command...');
                            try {
                                if (!remoteJid.endsWith('@g.us')) {
                                    await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                                    return true; // Command handled
                                }

                                // Check if the bot is an admin
                                if (!botIsAdmin) {
                                    console.log('❌ Command "kick" denied: The bot is not an admin in this group.');
                                    await sendToChat(botInstance, remoteJid, { message: '❌ I need to be a group admin to remove members.' });
                                    return true; // Command handled
                                }

                                let userJid;

                                // Check if the command is used with a mention
                                if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                                    userJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                                }

                                // Check if the command is used as a reply
                                if (!userJid && message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                    userJid = message.message.extendedTextMessage.contextInfo.participant;
                                }

                                if (!userJid) {
                                    console.log('❌ No user mentioned or replied to for removal.');
                                    await botInstance.sendMessage(remoteJid, { text: '❌ Please mention a user or reply to their message to remove them.' });
                                    return true; // Command handled
                                }

                                // Prevent kicking the bot itself
                                const botJid = botInstance.user.id.split(':')[0] + '@s.whatsapp.net';
                                if (userJid === botJid) {
                                    console.log('❌ Attempt to kick the bot itself.');
                                     await sendToChat(botInstance, remoteJid, { message: '❌ I cannot remove myself from the group.' });
                                    return true; // Command handled
                                }

                                // Attempt to remove the user from the group
                                console.log(`🚪 Attempting to remove ${userJid} from the group...`);
                                await sock.groupParticipantsUpdate(remoteJid, [userJid], 'remove');
                                console.log(`✅ Successfully removed ${userJid} from the group.`);
                                await sendToChat(botInstance, remoteJid, { message: `✅ Successfully removed <@${userJid.split('@')[0]}> from the group.`, mentions: [userJid] });
                            } catch (error) {
                                console.error('❌ Failed to execute "kick" command:', error);

                                // Handle specific errors
                                if (error.message.includes('not-authorized')) {
                                    await sendToChat(botInstance, remoteJid, { message: '❌ I do not have permission to remove members from this group.' });
                                } else if (error.message.includes('invalid-jid')) {
                                    await sendToChat(botInstance, remoteJid, { message: '❌ The user mentioned or replied to is invalid or not in the group.' });
                                } else {
                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to remove the member. Please try again later.' });
                                }
                            }
                            return true; // Command handled
                            case 'promote':
                                console.log('⬆️ Executing "promote" command...');
                                try {
                                    if (!remoteJid.endsWith('@g.us')) {
                                        await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                                        return true; // Command handled
                                    }
                            
                                    if (!botIsAdmin) {
                                        console.log('❌ Command "promote" denied: The bot is not an admin in this group.');
                                        await sendToChat(botInstance, remoteJid, { message: '❌ I need to be a group admin to promote members.' });
                                        return true; // Command handled
                                    }
                            
                                    // if (!await isAdminOrOwner(sock, remoteJid, normalizedSender, normalizedUserId)) {
                                    //     console.log('❌ Command "promote" denied: Only admins or the bot owner can use this command.');
                                    //     await sendToChat(botInstance, remoteJid, { message: '❌ Only admins or the bot owner can promote members to admin.' });
                                    //     return true; // Command handled
                                    // }
                            
                                    let userJid;
                            
                                    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                                        userJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                                    }
                            
                                    if (!userJid && message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                        userJid = message.message.extendedTextMessage.contextInfo.participant;
                                    }
                            
                                    if (!userJid) {
                                        console.log('❌ No user mentioned or replied to for promotion.');
                                        await sendToChat(botInstance, remoteJid, { message: '❌ Please mention a user or reply to their message to promote them.' });
                                        return true; // Command handled
                                    }
                            
                                    console.log(`⬆️ Attempting to promote ${userJid} to admin...`);
                                    await sock.groupParticipantsUpdate(remoteJid, [userJid], 'promote');
                                    console.log(`✅ Successfully promoted ${userJid} to admin.`);
                                    await sendToChat(botInstance, remoteJid, { message: `✅ Successfully promoted <@${userJid.split('@')[0]}> to admin.`, mentions: [userJid] });
                                } catch (error) {
                                    console.error('❌ Failed to execute "promote" command:', error);
                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to promote the member. Please try again later.' });
                                }
                                return true; // Command handled
                            
                            case 'demote':
                                console.log('⬇️ Executing "demote" command...');
                                try {
                                    if (!remoteJid.endsWith('@g.us')) {
                                        await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                                        return true; // Command handled
                                    }
                            
                                    if (!botIsAdmin) {
                                        console.log('❌ Command "demote" denied: The bot is not an admin in this group.');
                                        await sendToChat(botInstance, remoteJid, { message: '❌ I need to be a group admin to demote members.' });
                                        return true; // Command handled
                                    }
                            
                                    // if (!await isAdminOrOwner(sock, remoteJid, normalizedSender, normalizedUserId)) {
                                    //     console.log('❌ Command "demote" denied: Only admins or the bot owner can use this command.');
                                    //     await sendToChat(botInstance, remoteJid, { message: '❌ Only admins or the bot owner can demote members from admin.' });
                                    //     return true; // Command handled
                                    // }
                            
                                    let userJid;
                            
                                    if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                                        userJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                                    }
                            
                                    if (!userJid && message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                        userJid = message.message.extendedTextMessage.contextInfo.participant;
                                    }
                            
                                    if (!userJid) {
                                        console.log('❌ No user mentioned or replied to for demotion.');
                                        await sendToChat(botInstance, remoteJid, { message: '❌ Please mention a user or reply to their message to demote them.' });
                                        return true; // Command handled
                                    }
                            
                                    console.log(`⬇️ Attempting to demote ${userJid} from admin...`);
                                    await sock.groupParticipantsUpdate(remoteJid, [userJid], 'demote');
                                    console.log(`✅ Successfully demoted ${userJid} from admin.`);
                                    await sendToChat(botInstance, remoteJid, { message: `✅ Successfully demoted <@${userJid.split('@')[0]}> from admin.`, mentions: [userJid] });
                                } catch (error) {
                                    console.error('❌ Failed to execute "demote" command:', error);
                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to demote the member. Please try again later.' });
                                }
                                return true; // Command handled
                                case 'warn':
                                    console.log('⚠️ Executing "warn" command...');
                                    try {

                                        
                                        if (!botIsAdmin) {
                                            console.log('❌ The bot must be an admin to reset warnings.');
                                            await sendToChat(botInstance, remoteJid, { message: '❌ I must be an admin to reset warnings.' });
                                            return true; // Command handled
                                        }
                                        let userJid;
                                        const reason = args.slice(1).join(' ') || 'No reason provided';
                                
                                        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                                            userJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                                        }
                                
                                        if (!userJid && message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                            userJid = message.message.extendedTextMessage.contextInfo.participant;
                                        }
                                
                                        if (!userJid) {
                                            await sendToChat(botInstance, remoteJid, { message: '❌ Please mention a user or reply to their message to warn them.' });
                                            return true;
                                        }
                                
                                        const warningCount = await warnUser(remoteJid, userJid, reason, botInstance.user.id);
                                        await sendToChat(botInstance, remoteJid, {
                                            message: `⚠️ User <@${userJid.split('@')[0]}> has been warned. Total warnings: ${warningCount}. Reason: ${reason}`,
                                            mentions: [userJid],
                                        });
                                    } catch (error) {
                                        console.error('❌ Failed to execute "warn" command:', error);
                                        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to warn the user. Please try again later.' });
                                    }
                                    return true;
                                
                                    case 'resetwarn':
                                        console.log('🔄 Executing "resetwarn" command...');
                                        try {
                                            // Check if the bot is an admin
                                            if (!botIsAdmin) {
                                                console.log('❌ The bot must be an admin to reset warnings.');
                                                await sendToChat(botInstance, remoteJid, { message: '❌ I must be an admin to reset warnings.' });
                                                return true; // Command handled
                                            }
                                    
                                            let userJid;
                                    
                                            // Check if the user is mentioned
                                            if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                                                userJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                                            }
                                    
                                            // Check if the command is a reply to a user's message
                                            if (!userJid && message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                                userJid = message.message.extendedTextMessage.contextInfo.participant;
                                            }
                                    
                                            // If no user is mentioned or replied to, send an error message
                                            if (!userJid) {
                                                console.log('❌ No user mentioned or replied to for resetwarn.');
                                                await sendToChat(botInstance, remoteJid, { message: '❌ Please mention a user or reply to their message to reset warnings.' });
                                                return true;
                                            }
                                    
                                            console.log(`🔍 Resetting warnings for user: ${userJid}`);
                                    
                                            // Reset warnings for the user
                                            await resetWarnings(remoteJid, userJid, botInstance.user.id);
                                    
                                            // Send confirmation message
                                            await sendToChat(botInstance, remoteJid, {
                                                message: `✅ Warnings for <@${userJid.split('@')[0]}> have been reset.`,
                                                mentions: [userJid],
                                            });
                                    
                                            console.log(`✅ Warnings successfully reset for user: ${userJid}`);
                                        } catch (error) {
                                            console.error('❌ Failed to execute "resetwarn" command:', error);
                                            await sendToChat(botInstance, remoteJid, { message: '❌ Failed to reset warnings. Please try again later.' });
                                        }
                                        return true;
                                
                                case 'listwarn':
                                    console.log('🔍 Executing "listwarn" command...');
                                    try {
                                        const warnings = await getAllWarningsForGroup(remoteJid, botInstance.user.id);

                                        const groupName = await getGroupName(sock, remoteJid);
                                        const groupAdmin = await getGroupOwner(sock, remoteJid); // Should return JID of owner/admin
                                        const { text, mentions } = getWarningListMsg(warnings, { groupName, groupAdmin, groupId: remoteJid });
                                        await sendToChat(botInstance, remoteJid, { message: text, mentions });
                                    } catch (error) {
                                        console.error('❌ Failed to fetch warnings:', error);
                                        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to fetch warnings. Please try again later.' });
                                    }
                                    return true;
                                                                
                                case 'warncount':
                                    console.log('🔄 Executing "warncount" command...');
                                    try {
                                        const warnCount = parseInt(args[0], 10);
                                        if (isNaN(warnCount) || warnCount < 0) {
                                            await sendToChat(botInstance, remoteJid, { message: '❌ Invalid warning count. Please provide a valid number.' });
                                            return true;
                                        }
                                
                                        await setWarningThreshold(remoteJid, botInstance.user.id, warnCount);
                                        await sendToChat(botInstance, remoteJid, { message: `✅ Warning threshold set to ${warnCount} for this group.` });
                                    } catch (error) {
                                        console.error('❌ Failed to execute "warncount" command:', error);
                                        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to set warning threshold. Please try again later.' });
                                    }
                                    return true;

                                   

                                    case 'welcome':
                                        console.log('⚙️ Executing "welcome" command...');
                                        try {
                                            if (!remoteJid.endsWith('@g.us')) {
                                                await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                                                return true; // Command handled
                                            }
                                    
                                            if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase())) {
                                                await sendToChat(botInstance, remoteJid, { message: '❌ Invalid usage. Use `.welcome on` or `.welcome off`.' });
                                                return true; // Command handled
                                            }
                                    
                                            const isEnabled = args[0].toLowerCase() === 'on';
                                            await setWelcomeStatus(remoteJid, botInstance.user.id, isEnabled);
                                            await sendToChat(botInstance, remoteJid, { message: `✅ Welcome messages have been ${isEnabled ? 'enabled' : 'disabled'} for this group.` });
                                        } catch (error) {
                                            console.error('❌ Failed to execute "welcome" command:', error);
                                            await sendToChat(botInstance, remoteJid, { message: '❌ Failed to update welcome status. Please try again later.' });
                                        }
                                        return true; // Command handled
                                    
                                    case 'setwelcome':
                                        console.log('⚙️ Executing "setwelcome" command...');
                                        try {
                                            if (!remoteJid.endsWith('@g.us')) {
                                                await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                                                return true; // Command handled
                                            }
                                    
                                            const message = args.join(' ');
                                            if (!message) {
                                                await sendToChat(botInstance, remoteJid, { message: '❌ Please provide a welcome message. Usage: `.setwelcome <message>`.' });
                                                return true; // Command handled
                                            }
                                    
                                            await setWelcomeMessage(remoteJid, botInstance.user.id, message);
                                            await sendToChat(botInstance, remoteJid, { message: `✅ Welcome message has been set to:\n"${message}"` });
                                        } catch (error) {
                                            console.error('❌ Failed to execute "setwelcome" command:', error);
                                            await sendToChat(botInstance, remoteJid, { message: '❌ Failed to set welcome message. Please try again later.' });
                                        }
                                        return true; // Command handled

                                        case 'group':
                                            console.log('⚙️ Executing "group" command...');
                                            if (!remoteJid.endsWith('@g.us')) {
                                                await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                                                return true; // Command handled
                                            }

                                        
                                            // Subcommands for `.group`
                                            const subCommand = args[0]?.toLowerCase();
                                            const subCommandArgs = args.slice(1).join(' ');
                                        
                                            switch (subCommand) {

                                                case 'info':
                                                        console.log('ℹ️ Executing "group info" command...');
                                                        try {
                                                            const groupMetadata = await sock.groupMetadata(remoteJid);
                                                            const groupName = groupMetadata.subject;
                                                            const groupDesc = groupMetadata.desc || 'No description set.';
                                                            const memberCount = groupMetadata.participants.length;
                                                            const admins = groupMetadata.participants.filter(p => p.admin);
                                                            const adminCount = admins.length;
                                                            const owner = groupMetadata.owner || admins.find(a => a.admin === 'superadmin')?.id || 'Unknown';

                                                            let adminList = admins.map(a => `• @${a.id.split('@')[0]}`).join('\n');
                                                            if (!adminList) adminList = 'None';

                                                            const infoMsg = getGroupInfoMsg({
                                                                    groupName,
                                                                    remoteJid,
                                                                    owner,
                                                                    memberCount,
                                                                    adminCount,
                                                                    groupDesc,
                                                                    adminList,
                                                                });

                                                            await sendToChat(botInstance, remoteJid, { message: infoMsg, mentions: [owner, ...admins.map(a => a.id)], quotedMessage: message });
                                                            console.log('✅ Group info sent.');
                                                        } catch (error) {
                                                            console.error('❌ Failed to fetch group info:', error);
                                                            await sendToChat(botInstance, remoteJid, { message: '❌ Failed to fetch group info. Please try again later.' });
                                                        }
                                                        return true; 
                                                case 'description':
                                                    console.log('ℹ️ Executing "group description" subcommand...');
                                                    try {
                                                        if (!botIsAdmin) {
                                                                console.log(`❌ Command "group ${subCommand}" denied: The bot is not an admin in this group.`);
                                                                await sendToChat(botInstance, remoteJid, { message: '❌ The bot must be an admin to execute this command.' });
                                                                return true;
                                                            }
                                                        await sock.groupUpdateDescription(remoteJid, subCommandArgs);
                                                        await sendToChat(botInstance, remoteJid, { message: `✅ Group description updated to:\n${subCommandArgs}` });
                                                        console.log('✅ Group description updated.');
                                                    } catch (error) {
                                                        console.error('❌ Failed to update group description:', error);
                                                        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to update group description. Please try again later.' });
                                                    }
                                                    break;

                                                    
                                        
                                                case 'name':
                                                    console.log('✏️ Executing "group name" subcommand...');
                                                    try {
                                                        if (!botIsAdmin) {
                                                                console.log(`❌ Command "group ${subCommand}" denied: The bot is not an admin in this group.`);
                                                                await sendToChat(botInstance, remoteJid, { message: '❌ The bot must be an admin to execute this command.' });
                                                                return true;
                                                            }
                                                        await sock.groupUpdateSubject(remoteJid, subCommandArgs);
                                                        await sendToChat(botInstance, remoteJid, { message: `✅ Group name updated to: ${subCommandArgs}` });
                                                        console.log('✅ Group name updated.');
                                                    } catch (error) {
                                                        console.error('❌ Failed to update group name:', error);
                                                        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to update group name. Please try again later.' });
                                                    }
                                                    break;

                                                     case 'revoke':
                                                        console.log('🔄 Executing "group revoke" subcommand...');
                                                        if (!botIsAdmin) {
                                                            console.log('❌ Command denied: Bot is not an admin in the group.');
                                                            await sendToChat(botInstance, remoteJid, {
                                                                message: '❌ I need to be an admin to reset the group link.',
                                                            });
                                                            return true; // Command handled
                                                        }

                                                        try {
                                                            // Revoke the group invite link
                                                            const metadata = await sock.groupMetadata(remoteJid);
                                                            const newInviteCode = await sock.groupRevokeInvite(metadata.id);
                                                            console.log(`✅ Group invite link reset. New invite code: ${newInviteCode}`);

                                                            // Send the new invite link to the group
                                                            await sendToChat(botInstance, remoteJid, {
                                                                message: `🔗 Group invite link has been reset.\nHere is the new link: https://chat.whatsapp.com/${newInviteCode}`,
                                                            });
                                                        } catch (error) {
                                                            console.error('❌ Failed to reset group invite link:', error);
                                                            await sendToChat(botInstance, remoteJid, {
                                                                message: '❌ Failed to reset the group invite link. Please try again later.',
                                                            });
                                                        }
                                                        break;
                                        
                                                case 'pic':
                                                    console.log('🖼️ Executing "group pic" subcommand...');
                                                    try {
                                                        if (!botIsAdmin) {
                                                                console.log(`❌ Command "group ${subCommand}" denied: The bot is not an admin in this group.`);
                                                                await sendToChat(botInstance, remoteJid, { message: '❌ The bot must be an admin to execute this command.' });
                                                                return true;
                                                            }
                                                        // Check if the message is a reply to an image
                                                        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                                                        console.log('🔍 Debugging quotedMessage:', quotedMessage);
                                        
                                                        const imageMessage = quotedMessage?.imageMessage;
                                        
                                                        if (!imageMessage) {
                                                            await sendToChat(botInstance, remoteJid, { message: '❌ Please reply to an image to set it as the group profile picture.' });
                                                            return true;
                                                        }
                                        
                                                        // Download the image
                                                        const buffer = await downloadMediaMessage(
                                                            {
                                                                key: {
                                                                    remoteJid: remoteJid,
                                                                    id: message.message.extendedTextMessage.contextInfo.stanzaId,
                                                                    participant: message.key.participant,
                                                                },
                                                                message: quotedMessage, // Pass the full quotedMessage object
                                                            },
                                                            'buffer',
                                                            { logger: console }
                                                        );
                                        
                                                        if (!buffer) {
                                                            console.error('❌ Failed to download the image. Buffer is empty.');
                                                            await sendToChat(botInstance, remoteJid, { message: '❌ Failed to download the image. Please try again later.' });
                                                            return true;
                                                        }
                                        
                                                        // Generate the profile picture using the downloaded buffer
                                                        const { img } = await generateProfilePicture(buffer);
                                        
                                                        // Set the group profile picture
                                                        await sock.updateProfilePicture(remoteJid, img);
                                                        await sendToChat(botInstance, remoteJid, { message: '✅ Group profile picture updated successfully.' });
                                                        console.log('✅ Group profile picture updated.');
                                                    } catch (error) {
                                                        console.error('❌ Failed to update group profile picture:', error);
                                                        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to update group profile picture. Please try again later.' });
                                                    }
                                                    break;

                                                    case 'link':
                                                        console.log('🔗 Executing "group link" subcommand...');
                                                        try {
                                                            if (!botIsAdmin) {
                                                                console.log(`❌ Command "group ${subCommand}" denied: The bot is not an admin in this group.`);
                                                                await sendToChat(botInstance, remoteJid, { message: '❌ The bot must be an admin to execute this command.' });
                                                                return true;
                                                            }
                                                            // Fetch the group invite link
                                                            const groupInviteCode = await sock.groupInviteCode(remoteJid);
                                                            const groupLink = `https://chat.whatsapp.com/${groupInviteCode}`;
                                                            console.log(`✅ Group link fetched: ${groupLink}`);
                                                    
                                                            // Fetch the group profile picture
                                                            let groupPicBuffer = null;
                                                            try {
                                                                const groupPicUrl = await sock.profilePictureUrl(remoteJid, 'image');
                                                                if (groupPicUrl) {
                                                                    const response = await fetch(groupPicUrl);
                                                                    if (!response.ok) {
                                                                        throw new Error(`Failed to fetch group profile picture. Status: ${response.status}`);
                                                                    }
                                                                    groupPicBuffer = await response.arrayBuffer(); // Correctly handle the response as a buffer
                                                                    console.log('✅ Group profile picture fetched successfully.');
                                                                } else {
                                                                    console.log('⚠️ No group profile picture found. Skipping image.');
                                                                }
                                                            } catch (error) {
                                                                console.error('⚠️ Failed to fetch group profile picture. Using default image.', error);
                                                            }
                                                    
                                                            // Send the group link with the group picture using the bot instance number
                                                            const botJid = `${userId}@s.whatsapp.net`; // Bot instance number
                                                            if (groupLink) {
                                                                if (groupPicBuffer) {
                                                                    await sock.sendMessage(remoteJid, {
                                                                        image: Buffer.from(groupPicBuffer), // Convert ArrayBuffer to Buffer
                                                                        caption: `🔗 Group Link:\n${groupLink}`,
                                                                        mentions: [botJid], // Mention the bot instance number
                                                                    });
                                                                    console.log('✅ Group link sent with group profile picture.');
                                                                } else {
                                                                    // Fallback: Send the link as a text message if the picture is unavailable
                                                                    await sock.sendMessage(remoteJid, {
                                                                        text: `🔗 Group Link:\n${groupLink}`,
                                                                        mentions: [botJid], // Mention the bot instance number
                                                                    });
                                                                    console.log('✅ Group link sent as text (no profile picture).');
                                                                }
                                                            } else {
                                                                console.error('❌ Group link is undefined. Cannot send the link.');
                                                                await sendToChat(botInstance, remoteJid, { message: '❌ Failed to fetch group link. Please try again later.' });
                                                            }
                                                        } catch (error) {
                                                            console.error('❌ Failed to fetch or send group link:', error);
                                                            await sendToChat(botInstance, remoteJid, { message: '❌ Failed to fetch group link. Please try again later.' });
                                                        }
                                                        break;

                                                    return true; // Command handled
                                                }
                                                break;
                                            case 'clear':
                                                console.log('🧹 Executing "clear" command...');
                                                const clearSubCommand = args[0]?.toLowerCase(); // Get the subcommand (e.g., "chat" or "media")
                                            
                                                if (!clearSubCommand || !['chat', 'media'].includes(clearSubCommand)) {
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ Invalid subcommand. Use `.clear chat` or `.clear media`.' });
                                                    return true; // Command handled
                                                }
                                            
                                                try {
                                                    // Ensure the groupMessages store is initialized for the group
                                                    if (!groupMessages[remoteJid]) {
                                                        console.log(`ℹ️ No messages found in memory for group ${remoteJid}. Initializing empty message store.`);
                                                        groupMessages[remoteJid] = []; // Initialize as an empty array
                                                    }
                                            
                                                    // Get messages for the group from the in-memory store
                                                    const messages = groupMessages[remoteJid];
                                                    console.log(`🔍 Found ${messages.length} messages in memory for group ${remoteJid}.`);
                                            
                                                    if (messages.length === 0) {
                                                        await sendToChat(botInstance, remoteJid, { message: 'ℹ️ No messages to clear in this group.' });
                                                        return true; // Command handled
                                                    }
                                            
                                                    // Add a delay between each deletion to avoid rate limits
                                                    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
                                            
                                                    if (clearSubCommand === 'chat') {
                                                        console.log('🧹 Clearing all text messages...');
                                                        for (const msg of messages) {
                                                            const messageType = Object.keys(msg.message || {})[0];
                                                            if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
                                                                try {
                                                                    await sock.sendMessage(remoteJid, { delete: msg.key }); // Delete the text message
                                                                    console.log(`✅ Deleted text message: ${msg.key.id}`);
                                                                    await delay(1000); // 1-second delay between deletions
                                                                } catch (error) {
                                                                    console.error(`❌ Failed to delete text message: ${msg.key.id}`, error);
                                                                }
                                                            }
                                                        }
                                                        await sendToChat(botInstance, remoteJid, { message: '✅ All text messages have been cleared.' });
                                                    } else if (clearSubCommand === 'media') {
                                                        console.log('🧹 Clearing all media messages...');
                                                        for (const msg of messages) {
                                                            const messageType = Object.keys(msg.message || {})[0];
                                                            if (['imageMessage', 'videoMessage', 'documentMessage'].includes(messageType)) {
                                                                try {
                                                                    await sock.sendMessage(remoteJid, { delete: msg.key }); // Delete the media message
                                                                    console.log(`✅ Deleted media message: ${msg.key.id}`);
                                                                    await delay(1000); // 1-second delay between deletions
                                                                } catch (error) {
                                                                    console.error(`❌ Failed to delete media message: ${msg.key.id}`, error);
                                                                }
                                                            }
                                                        }
                                                        await sendToChat(botInstance, remoteJid, { message: '✅ All media messages have been cleared.' });
                                                    }
                                            
                                                    // Clear the in-memory store for the group
                                                    groupMessages[remoteJid] = messages.filter((msg) => {
                                                        const messageType = Object.keys(msg.message || {})[0];
                                                        if (clearSubCommand === 'chat') {
                                                            return !(messageType === 'conversation' || messageType === 'extendedTextMessage');
                                                        } else if (clearSubCommand === 'media') {
                                                            return !['imageMessage', 'videoMessage', 'documentMessage'].includes(messageType);
                                                        }
                                                        return true;
                                                    });
                                            
                                                    console.log(`✅ Successfully cleared ${clearSubCommand} messages for group ${remoteJid}.`);
                                                } catch (error) {
                                                    console.error(`❌ Failed to clear messages in group ${remoteJid}:`, error);
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to clear messages. Please try again later.' });
                                                }
                                                return true; // Command handled
                                            
                                            case 'mute':
                                                console.log('🔒 Executing "mute" subcommand...');
                                                try {
                                                    // Lock the group chat by setting "sendMessages" to false
                                                    await sock.groupSettingUpdate(remoteJid, 'announcement');
                                                    await sendToChat(botInstance, remoteJid, { message: '🔒 Group chat has been muted. Only admins can send messages.' });
                                                    console.log('✅ Group chat muted successfully.');
                                                } catch (error) {
                                                    console.error('❌ Failed to mute group chat:', error);
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to mute group chat. Please try again later.' });
                                                }
                                                return true; // Command handled
                                            
                                            case 'unmute':
                                                console.log('🔓 Executing "unmute" subcommand...');
                                                try {
                                                    // Unlock the group chat by setting "sendMessages" to true
                                                    await sock.groupSettingUpdate(remoteJid, 'not_announcement');
                                                    await sendToChat(botInstance, remoteJid, { message: '🔓 Group chat has been unmuted. All members can send messages.' });
                                                    console.log('✅ Group chat unmuted successfully.');
                                                } catch (error) {
                                                    console.error('❌ Failed to unmute group chat:', error);
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to unmute group chat. Please try again later.' });
                                                }
                                                return true; // Command handled


                                                    case 'kickall':
                                                        if (!botIsAdmin) {
                                                            await sendToChat(botInstance, remoteJid, { message: '❌ The bot must be an admin to execute this command.' });
                                                            return true;
                                                        }
                                                        await requestKickAllConfirmation(sock, remoteJid, botInstance, userId);
                                                        return true;
                                                    case 'yeskick':
                                                        await confirmKickAll(remoteJid);
                                                        return true;

                                                    case 'cancelkick':
                                                        cancelKickAll(remoteJid);
                                                        await sendToChat(botInstance, remoteJid, { message: '⏹️ Kick all operation cancellation requested.' });
                                                        return true;

                                        case 'antilink':
                                            console.log('⚙️ Executing "antilink" command...');
                                            const antilinkSubCommand = args[0]?.toLowerCase();
                                        
                                            if (!antilinkSubCommand) {
                                                await sendToChat(botInstance, remoteJid, { message: 'Usage: antilink <on/off/warncount/bypassadmin/dbadmin/bypass/db/list>' });
                                                return true;
                                            }
                                        
                                              // Fetch the user_id from the users table for non-admin instances
                                                    const userIdFromDatabase = await getUserFromUsersTable(normalizedUserId);
                                                    if (!userIdFromDatabase) {
                                                        console.error(`❌ User ID not found for bot instance: ${normalizedUserId}`);
                                                        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to execute Anti-Link command. User ID not found.' });
                                                        return true;
                                                    }
                                        
                                            switch (antilinkSubCommand) {
                                                case 'on':
                                                case 'off':
                                                    const isEnabled = antilinkSubCommand === 'on';
                                                    console.log(`🔄 Setting Anti-Link to ${isEnabled ? 'enabled' : 'disabled'} for group ${remoteJid}.`);
                                                    await updateAntiLinkSettings(remoteJid, userIdFromDatabase.user_id, { antilink_enabled: isEnabled });
                                                    await sendToChat(botInstance, remoteJid, { message: `✅ Anti-Link has been ${isEnabled ? 'enabled' : 'disabled'} for this group.` });
                                                    break;
                                        
                                                case 'warncount':
                                                    const warnCount = parseInt(args[1], 10);
                                                    if (isNaN(warnCount) || warnCount < 0) {
                                                        await sendToChat(botInstance, remoteJid, { message: '❌ Invalid warning count. Please provide a valid number (e.g., 0, 1, 2, etc.).' });
                                                        return true;
                                                    }
                                        
                                                    console.log(`🔄 Setting Anti-Link warning count to ${warnCount} for group ${remoteJid}.`);
                                                    await updateAntiLinkSettings(remoteJid, userIdFromDatabase.user_id, { warning_count: warnCount });
                                                    await sendToChat(botInstance, remoteJid, { message: `✅ Anti-Link warning count set to ${warnCount} for this group.` });
                                                    break;
                                        
                                                case 'bypassadmin':
                                                    console.log(`🔄 Enabling bypass for group admins in group ${remoteJid}.`);
                                                    await updateAntiLinkSettings(remoteJid, userIdFromDatabase.user_id, { bypass_admin: true });
                                                    await sendToChat(botInstance, remoteJid, { message: '✅ Group admins will now be bypassed for Anti-Link.' });
                                                    break;
                                        
                                                case 'dbadmin':
                                                    console.log(`🔄 Disabling bypass for group admins in group ${remoteJid}.`);
                                                    await updateAntiLinkSettings(remoteJid, userIdFromDatabase.user_id, { bypass_admin: false });
                                                    await sendToChat(botInstance, remoteJid, { message: '✅ Group admins will no longer be bypassed for Anti-Link.' });
                                                    break;
                                        
                                             case 'bypass': {
                                                        let userJid;

                                                        // Prefer mention
                                                        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                                                            userJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                                                        }

                                                        // Fallback to reply
                                                        if (!userJid && message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                                            userJid = message.message.extendedTextMessage.contextInfo.participant;
                                                        }

                                                        // Fallback to argument (digits only)
                                                        if (!userJid && args[1]) {
                                                            const num = args[1].replace(/\D/g, '');
                                                            if (num.length > 5) userJid = `${num}@s.whatsapp.net`;
                                                        }

                                                        if (!userJid) {
                                                            await sendToChat(botInstance, remoteJid, { message: '❌ Please mention a user or reply to their message to bypass.' });
                                                            return true;
                                                        }

                                                        // Add user to bypass list logic (your existing code)
                                                        const groupSettings = await getAntiLinkSettings(remoteJid, userIdFromDatabase.user_id);
                                                        const updatedBypassUsers = [...new Set([...(groupSettings.bypass_users || []), userJid])];
                                                        await updateAntiLinkSettings(remoteJid, userIdFromDatabase.user_id, { bypass_users: updatedBypassUsers });

                                                        // Send confirmation with WhatsApp-style mention
                                                        await sendToChat(botInstance, remoteJid, {
                                                            message: `✅ User <@${userJid.split('@')[0]}> has been added to the bypass list.`,
                                                            mentions: [userJid],
                                                        });

                                                        return true;
                                                    }


                                                                                            
                                               case 'db':
                                                            let dbUserJid;
                                                            if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
                                                                dbUserJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
                                                            }
                                                            if (!dbUserJid && message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                                                dbUserJid = message.message.extendedTextMessage.contextInfo.participant;
                                                            }
                                                            if (!dbUserJid && args[1]) {
                                                                const num = args[1].replace(/\D/g, '');
                                                                if (num.length > 5) dbUserJid = `${num}@s.whatsapp.net`;
                                                            }
                                                            if (!dbUserJid) {
                                                                await sendToChat(botInstance, remoteJid, { message: '❌ Please mention a user to remove from the bypass list.' });
                                                                return true;
                                                            }

                                                            console.log(`🔄 Removing ${dbUserJid} from bypass list for group ${remoteJid}.`);
                                                            const currentSettings = await getAntiLinkSettings(remoteJid, userIdFromDatabase.user_id);
                                                            const filteredBypassUsers = (currentSettings.bypass_users || []).filter((user) => user !== dbUserJid);

                                                            await updateAntiLinkSettings(remoteJid, userIdFromDatabase.user_id, { bypass_users: filteredBypassUsers });
                                                            await sendToChat(botInstance, remoteJid, {
                                                                message: `✅ User @${dbUserJid.replace(/\D/g, '')} has been removed from the bypass list.`,
                                                                mentions: [dbUserJid],
                                                            });
                                                            break;
                                        
                                               case 'list':
                                                        console.log(`🔄 Fetching Anti-Link settings for group ${remoteJid}.`);
                                                        const settings = await getAntiLinkSettings(remoteJid, userIdFromDatabase.user_id);
                                                        const bypassUsers = settings.bypass_users || [];
                                                        let mentions = [];
                                                        let bypassUsersList = '   None';

                                                        if (bypassUsers.length) {
                                                            bypassUsersList = bypassUsers.map(user => {
                                                                mentions.push(user);
                                                                return `   ◦ @${user.replace(/\D/g, '')}`;
                                                            }).join('\n');
                                                        }

                                                        // Fetch group metadata for name and ID
                                                      let groupName = 'Unknown';
                                                        try {
                                                            groupName = await getGroupName(sock, remoteJid);
                                                            if (!groupName) groupName = 'Unknown';
                                                        } catch (e) {
                                                            console.error('❌ Failed to fetch group name:', e);
                                                        }

                                                        const statusMessage = getAntiLinkStatusMsg({
                                                            settings,
                                                            bypassUsersList,
                                                            groupName,
                                                            groupId: remoteJid
                                                        });
                                                        await sendToChat(botInstance, remoteJid, { message: statusMessage, mentions });
                                                        break;
                                                    }
                                                    return true;
                                                case 'admin':
                                                 console.log('📢 Executing "admin" command...');
                                                 if (!remoteJid.endsWith('@g.us')) {
                                                   await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                                              return true; // Command handled
                                             }

                                        try {
                                            // Fetch group metadata
                                            const groupName = await getGroupName(sock, remoteJid); // Get the group name
                                            const botOwnerName = await getBotOwnerName(userId); // Get the bot owner's name
                                            const admins = await getGroupAdmins(sock, remoteJid); // Fetch group admins

                                            if (admins.length === 0) {
                                                console.log(`❌ No admins found in group ${remoteJid}.`);
                                                await sendToChat(botInstance, remoteJid, { message: '❌ No admins found in this group.' });
                                                return true; // Command handled
                                            }

                                            // Get the sender's name
                                            const senderName = message.pushName || 'Unknown';

                                            // Get the additional message content
                                            const additionalMessage = args.join(' ') || '';

                                            // Generate the formatted message
                                            const { text, mentions } = generateTagAllMessage(
                                                groupName,
                                                sender,
                                                botOwnerName,
                                                additionalMessage,
                                                admins
                                            );

                                            // Send the message with mentions
                                            await sendToChat(botInstance, remoteJid, { message: text, mentions });

                                            console.log(`✅ Admins tagged in group ${remoteJid}.`);
                                        } catch (error) {
                                            console.error(`❌ Failed to execute "admin" command in group ${remoteJid}:`, error);
                                            await sendToChat(botInstance, remoteJid, { message: '❌ Failed to tag admins. Please try again later.' });
                                        }
                                        return true; // Command handled
                                                            
                                        case 'create':
                                            if (args[0] === 'group') {
                                                // Create a new group in the current community
                                                const groupName = args.slice(1).join(' ');
                                                if (!groupName) {
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ Please provide a name for the group.' });
                                                    return true;
                                                }
                                        
                                                try {
                                                    console.log(`🔍 Checking if the bot is a community admin...`);
                                                    const groupMetadata = await sock.groupMetadata(remoteJid); // Fetch group metadata
                                                    const botIsAdmin = groupMetadata.participants.some(
                                                        (participant) => participant.id === `${userId}@s.whatsapp.net` && participant.admin === 'superadmin'
                                                    );
                                        
                                                    if (!botIsAdmin) {
                                                        console.log(`❌ Bot is not a community admin. Cannot create group in the community.`);
                                                        await sendToChat(botInstance, remoteJid, {
                                                            message: '❌ The bot must be a community admin to create a group in this community.',
                                                        });
                                                        return true;
                                                    }
                                        
                                                    console.log(`✅ Bot is a community admin. Proceeding to create group "${groupName}"...`);
                                                    const result = await sock.groupCreate(groupName, []);
                                                    console.log(`✅ Group created: ${result.gid}`);
                                                    await sendToChat(botInstance, remoteJid, { message: `✅ Group "${groupName}" created successfully in the current community.` });
                                                } catch (error) {
                                                    console.error(`❌ Failed to create group in the community:`, error);
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to create group in the community. Please try again later.' });
                                                }
                                                return true;
                                            } else if (args[0] === 'NG') {
                                                // Create a new group outside any community
                                                const groupName = args.slice(1).join(' ');
                                                if (!groupName) {
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ Please provide a name for the new group.' });
                                                    return true;
                                                }
                                        
                                                try {
                                                    console.log(`🔄 Creating new group "${groupName}" outside any community...`);
                                                    const result = await sock.groupCreate(groupName, []);
                                                    console.log(`✅ New group created: ${result.gid}`);
                                                    await sendToChat(botInstance, remoteJid, { message: `✅ New group "${groupName}" created successfully outside any community.` });
                                                } catch (error) {
                                                    console.error(`❌ Failed to create new group:`, error);
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to create new group. Please try again later.' });
                                                }
                                                return true;
                                            }
                                            break;

                                           case 'destroy':
                                                    if (args[0] === 'group') {
                                                        if (!isGroup) {
                                                            await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in a group.' });
                                                            return true;
                                                        }
                                                        if (!botIsAdmin) {
                                                            await sendToChat(botInstance, remoteJid, { message: '❌ The bot must be an admin to destroy the group.' });
                                                            return true;
                                                        }
                                                        await requestDestroyGroupConfirmation(sock, remoteJid, botInstance, userId);
                                                        return true;
                                                    }
                                                    break;

                                                case 'yesdestroy':
                                                    await confirmDestroyGroup(remoteJid);
                                                    return true;

                                                case 'canceldestroy':
                                                    cancelDestroyGroup(remoteJid);
                                                    await sendToChat(botInstance, remoteJid, { message: '⏹️ Destroy group operation cancellation requested.' });
                                                    return true;
                                                   
                                            case 'stats':
                                                try {
                                                    console.log('📊 Executing "stats" command...');
                                                    await handleGroupStatsCommand (sock, remoteJid, botInstance);
                                                    console.log('✅ Group stats command executed successfully.');
                                                    return true; // Command handled
                                                } catch (error) {
                                                    console.error('❌ Failed to execute "stats" command:', error);
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ Failed to retrieve group stats. Please try again later.' });
                                                    return true; // Command handled
                                                }
                                                   
                                                case 'active':
                                                    try {
                                                        await handleActiveMembersCommand(sock, remoteJid, botInstance);
                                                        return true;
                                                    } catch (error) {
                                                        console.error('❌ Failed to execute "active" command:', error);
                                                        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to retrieve active members. Please try again later.' });
                                                        return true;
                                                    }

                                                case 'inactive':
                                                    try {
                                                        await handleInactiveMembersCommand(sock, remoteJid, botInstance);
                                                        return true;
                                                    } catch (error) {
                                                        console.error('❌ Failed to execute "inactive" command:', error);
                                                        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to retrieve inactive members. Please try again later.' });
                                                        return true;
                                                    }
                                                    case 'kickinactive':
                                                        if (!botIsAdmin) {
                                                            await sendToChat(botInstance, remoteJid, { message: '❌ The bot must be an admin to execute this command.' });
                                                            return true;
                                                        }
                                                        await requestKickInactiveConfirmation(sock, remoteJid, botInstance, userId);
                                                        return true;
                                                    case 'confirm':
                                                        await confirmKickInactive(remoteJid);
                                                        return true;
                                                    case 'cancelk':
                                                        cancelKickInactive(remoteJid);
                                                        await sendToChat(botInstance, remoteJid, { message: '⏹️ Kick inactive operation cancellation requested.' });
                                                        return true;
                                                    
                                        case 'leave':
                                            console.log('🚪 Executing "leave" command...');
                                            try {
                                                if (!isGroup) {
                                                    await sendToChat(botInstance, remoteJid, { message: '❌ This command can only be used in groups.' });
                                                    return true; // Command handled
                                                }

                                                // Ensure the bot is an admin or has permission to leave
                                                console.log(`🔄 Leaving group: ${remoteJid}`);
                                                await sock.groupLeave(remoteJid); // Leave the group
                                                console.log(`✅ Successfully left the group: ${remoteJid}`);
                                            } catch (error) {
                                                console.error('❌ Failed to execute "leave" command:', error);
                                                await sendToChat(botInstance, remoteJid, { message: '❌ Failed to leave the group. Please try again later.' });
                                            }
                                            return true; // Command handled

                                            

                                                
                default:
                    console.log(`❌ Command "${command}" not recognized.`);
                    return false; // Command not handled
            }};

        

module.exports = { handleGroupCommand };