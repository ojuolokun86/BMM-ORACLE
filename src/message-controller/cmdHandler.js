const { botInstances, antideleteSettings } = require('../utils/globalStore'); // Import the global botInstances object
const { getUserPrefixCached, updateUserPrefix } = require('../database/userPrefix'); // Import prefix functions
const { handleSettingsCommand } = require('./settingsCommad'); // Import the settings command handler
const { handleGeneralCommand } = require('./generalCommand'); // Import general command handler
const { sendReaction } = require('../utils/messageUtils'); // Import the sendReaction function
const { handleGroupCommand } = require('./groupCommand'); // Import group command handler
const { sendToChat } = require('../utils/messageUtils'); // Import message utility functions
const env = require('../utils/loadEnv'); // Load environment variables
const { normalizeUserId } = require('../utils/normalizeUserId'); // Import the normalization function
const { getGroupMode, setGroupMode, getGroupModeCached } = require('../bot/groupModeManager'); // Import setGroupMode
const { updateUserMetrics } = require('../database/models/metrics'); // Import the user metrics functions
const supabase = require('../supabaseClient'); // Import Supabase client
const { handleFunCommand } = require('./funCommand'); // Import fun command handler
const { handleProtectionCommand } = require('./protection'); // Import protection command handler
const { addAnalyticsData } = require('../server/info'); // Import analytics functions
const { emitAnalyticsUpdate } = require('../server/socket');
const { menu } = require('../utils/menu');
const { handleDownloadCommand } = require('./downloadCommand');






const ADMIN_NUMBER = env.ADMIN_NUMBER; // Load the admin number from .env

const handleCommand = async (sock, message, userId, authId, messageContent, subscriptionLevel) => {
    const startTime = Date.now(); // Start timing the command
    try {
        const remoteJid = message.key.remoteJid; // Chat ID
        const isGroup = remoteJid.endsWith('@g.us'); // Check if the message is from a group
        const sender = message.key.participant || remoteJid; // Sender's ID
        const normalizedSender = normalizeUserId(sender); // Normalize sender's number
        const normalizedUserId = normalizeUserId(userId); // Normalize bot owner's ID
        const botLid = sock.user?.lid ? sock.user.lid.split(':')[0].split('@')[0] : null; // Fetch and normalize bot's LID
        const botOwnerIds = [normalizedUserId || botLid]; // Include both `id` and `lid`
        if (!botLid) {
            console.error('❌ Bot LID is undefined. Cannot proceed with command handling.');
            return;
        }
        // Correctly identify the real sender
        const realSender = isGroup ? normalizedSender : (message.key.fromMe ? userId : normalizedSender);

        console.log(`🔍 Normalized Sender: ${normalizedSender}, Real Sender: ${realSender}`);
        console.log(`🔍 Bot Owner IDs: ${botOwnerIds}`);

        // Retrieve the correct bot instance
        const botInstance = botInstances[userId];

        if (!botInstance || typeof botInstance.sendMessage !== 'function') {
            console.error(`❌ Invalid botInstance for user: ${userId}. Expected a valid WhatsApp socket instance.`);
            return;
        }

        // Fetch the user's prefix from Supabase
        const userPrefix = await getUserPrefixCached(userId); // Ensure this is initialized before use
        console.log(`🔍 Current prefix for user ${userId}: "${userPrefix}"`);

        // Extract the command and arguments
        const args = messageContent.slice(userPrefix.length).trim().split(/\s+/); // Split command and arguments
        const command = args.shift().toLowerCase(); // Extract the command
        
        console.log(`⚙️ Command received:
            - Command: ${command}
            - Arguments: ${args.join(' ')}
            - Sender: ${realSender}
            - Receiver (Bot Instance): ${normalizedUserId}
            - Content: ${messageContent}
            - Group: ${isGroup ? remoteJid : 'Direct Message'}
        `);

        // Send a reaction for the command
        await sendReaction(sock, remoteJid, message.key.id, command);
        console.log(`✅ Reaction sent for command "${command}" in ${remoteJid}`);
                        // Restrict all commands to the bot owner
    const groupCommands = [
    'poll','endpoll','announce','tagall','admin','add','kick','promote','demote','kickall','group','antilink','welcome','setwelcome','warn','resetwarn','listwarn','warncount','clear','mute','unmute','create','destroy','delete','leave','description'
];

if (
    groupCommands.includes(command)
    && isGroup
) {
    // Check group mode
    const groupMode = await getGroupModeCached(remoteJid);
    if (groupMode === 'admin') {
        // Allow if sender is group admin or bot owner
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const isSenderAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);
        if (!(realSender === normalizedUserId || realSender === botLid || isSenderAdmin)) {
            console.log(`❌ Only group admins or bot owner can use this command in admin mode.`);
            await sendToChat(botInstance, remoteJid, { message: '❌ Only group admins or the bot owner can use this command in admin mode.' });
            return;
        }
    } else {
        // In "me" mode, only bot owner can use
        if (realSender !== normalizedUserId && realSender !== botLid) {
            console.log(`🤖 not your bot instance`);
            return;
        }
    }
} else {
    // For non-group commands, only bot owner can use
    if (realSender !== normalizedUserId && realSender !== botLid) {
        console.log(`🤖 not your bot instance`);
        return;
    }
}
    // Handle specific commands
    switch (command) {

       case 'menu':
        case 'help':
            // Get the bot owner name from sock.user (if available)
            const ownerName = (sock.user && (sock.user.name || sock.user.pushName)) || 'lash man';
            await menu(sock, remoteJid, message, userPrefix, ownerName);
            return;
        case 'poll':
            case 'endpoll':
            case 'announce':
            case 'tagall':
            case 'admin':
            case 'add':
            case 'kick':
            case 'promote':
            case 'demote':
            case 'kickall':
            case 'group':
            case 'antilink':
            case 'welcome':
            case 'setwelcome':
            case 'warn':
            case 'resetwarn':
            case 'listwarn':
            case 'warncount':
            case 'clear':
            case 'mute':
            case 'unmute':
            case 'create':
            case 'destroy':
            case 'delete':
            case 'leave':
            case 'description':
            case 'stats':
            case 'active':
            case 'inactive':
            case 'cancelkick':
            case 'yeskick':
            case 'canceldestroy':
            case 'yesdestroy':
            case 'kickinactive':
            case 'confirm':
            case 'cancelk':
                console.log(`📢 Routing "${command}" to groupCommand.js...`);
                const handled = await handleGroupCommand(sock, userId, message, command, args, sender, null, botInstance, true);
                if (handled) {
                    return; // Exit if the command was handled
                } else {
                    console.log(`❌ Command "${command}" was not handled by groupCommand.js.`);
                }
                break;
           // Handle general commands
            case 'ping':
                case 'menu':
                case 'info':
                case 'about':
                case 'prefix':
                case 'restart':
                case 'tagformat':
                case 'setmode':
                case 'antidelete':
                case 'status':
                case 'view':
                case 'deleteit':
                case 'time':
                case 'listgroup':
                case 'listgroups':
                case 'remove':
                case 'leavegroup':
                case 'ai':
                    console.log(`📜 Routing "${command}" to generalCommand.js...`);
                    const generalHandled = await handleGeneralCommand(sock, message, command, args, userId, remoteJid, botInstance, realSender, botOwnerIds, normalizedUserId, botLid, authId, );
                    if (generalHandled) {
                        return; // Exit if the command was handled
                    } else {
                        console.log(`❌ Command "${command}" was not handled by generalCommand.js.`);
                    }
                    break;
            // Handle settings commands
                        case 'imagine':
                        case 'sticker':
                        case 'emoji':
                        case 'baka':
                        case 'bite':
                        case 'blush':
                        case 'bored':
                        case 'cry':
                        case 'cuddle':
                        case 'dance':
                        case 'facepalm':
                        case 'feed':
                        case 'happy':
                        case 'highfive':
                        case 'hug':
                        case 'kick':
                        case 'kill':
                        case 'kiss':
                        case 'laugh':
                        case 'lick':
                        case 'pat':
                        case 'poke':
                        case 'pout':
                        case 'shoot':
                        case 'shrug':
                        case 'slap':
                        case 'smile':
                        case 'smug':
                        case 'stare':
                        case 'think':
                        case 'thumbsup':
                        case 'tickle':
                        case 'wave':
                        case 'wink':
                        case 'yeet':
                        case 'quote':
                        case 'joke':
                         case 'fun':
                         case 'translate': 
                            console.log(`🎉 Routing "${command}" to funCommand.js...`);
                            const funHandled = await handleFunCommand(sock, message, command, args, userId, remoteJid, botInstance);
                            if (funHandled) {
                                return; // Exit if the command was handled
                            } else {
                                console.log(`❌ Command "${command}" was not handled by funCommand.js.`);
                            }
                            break;

          case 'protect':
            case 'bug':
                console.log(`🛡️ Routing "${command}" to protection.js...`);
                const protectionHandled = await handleProtectionCommand({
                    sock,
                    message,
                    userId,
                    authId,
                    command,
                    args,
                    botInstance,
                    realSender,
                    normalizedUserId,
                    botLid,
                    subscriptionLevel,
                    remoteJid
                });
                if (protectionHandled) {
                    return; // Exit if the command was handled
                } else {
                    console.log(`❌ Command "${command}" was not handled by protection.js.`);
                }
                break;

                case 'download':
                await handleDownloadCommand(sock, botInstance, remoteJid, args);
                return;

                // ...inside your main switch(command)...
                // case 'upload':
                // if (!['gold', 'premium'].includes(subscriptionLevel)) {
                //     await sendToChat(botInstance, remoteJid, {
                //         message: '❌ Only gold and premium users can use this command.',
                //     });
                //     return;
                // }
                // console.log(`⬆️ Routing "${command}" to advanceCmd.js...`);
                // const advanceHandled = await handleAdvanceCommand(sock, message, command, args, userId, remoteJid, botInstance);
                // if (advanceHandled) {
                //     return; // Exit if the command was handled
                // } else {
                //     console.log(`❌ Command "${command}" was not handled by advanceCmd.js.`);
                // }
                // break;

            case 'settings':
            case 'setpic': // Route specific settings commands to settingsCommand.js
            case 'setname':
            case 'presence':
            case 'setstatus':
            case 'seen':
            case 'block':
            case 'unblock':
            case 'logout':
            case 'formatrespond':
            //case 'privacy':.
            case 'dnd':
        console.log(`⚙️ Routing "${command}" to settingsCommand.js...`);
        await handleSettingsCommand(sock, message, remoteJid, userId, command, args, botInstance, realSender, normalizedUserId, subscriptionLevel, botLid);
        return; // Exit after handling settings commands
          default:
            const unknownMessages = [
                `😂 I don’t speak gibberish, boss! *${command}* is not in my dictionary!`,
                `🧬 ERROR 404: Command *${command}* not found in universe.\nTry *.help* before the system collapses.`,
                `🤖 I didn’t get that command: *${command}*.\nType *.help* to see what I understand!`,
                `🛑 Invalid command detected: *${command}*.\nAre you trying to break me or just showing off? 😏`,
                `🧊 Yo, *${command}* isn’t a valid move.\nTry *.help* to see my power.`,
                `⚠️ Beep-boop... Command *${command}* is unknown.\nInitiate *.help* to restore logic.`,
                `😑 *${command}?* Seriously? I don’t even know what that means.\nType *.help* jare.`,
                `🎮 Cheat code *${command}* is invalid! Try *.help* to unlock real commands.`
            ];

            // Pick one message at random
            const randomResponse = unknownMessages[Math.floor(Math.random() * unknownMessages.length)];

            console.log(`❓ Unknown command: "${command}". Sending random response.`);
            await sendToChat(botInstance, remoteJid, {
                 message: randomResponse,
                quotedMessage: message 
             });
            return;

}

        } catch (error) {
            console.error(`❌ Error handling command for user ${userId}:`, error);
        } finally {
            const endTime = Date.now(); // End timing the command
            const timeTaken = endTime - startTime;
    
            console.log(`⏱️ Calculated command processing time for user ${userId}: ${timeTaken}ms.`); // Debug log
    
            // Save the time delay for the user
            updateUserMetrics(userId, authId, { commandProcessingTime: timeTaken });
    
            console.log(`⏱️ Command handling for user ${userId} took ${timeTaken}ms.`); // Debug log

            addAnalyticsData(authId, {
                timestamp: new Date().toISOString(),
                commandProcessingTime: endTime - startTime,
            });
            console.log('📊 Calling emitAnalyticsUpdate with:', authId);
            emitAnalyticsUpdate(authId);
        }
    };

module.exports = { handleCommand };