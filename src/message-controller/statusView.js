const { getUserStatusSettingsCached, updateUserStatusSettingsCached } = require('../database/userDatabase'); // Import database functions
const { sendToChat } = require('../utils/messageUtils'); // Import message utility functions

/**
 * Handle status updates.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {object} status - The status update object.
 * @param {string} userId - The bot owner's ID.
 */
const handleStatusUpdate = async (sock, status, userId) => {
    try {
        const { remoteJid } = status.key; // Status poster's ID
        const settings = await getUserStatusSettingsCached(userId); // Fetch the user's status settings

        if (settings.status_seen) {
            console.log(`👀 Viewing status from ${remoteJid}...`);
            await sock.readMessages([status.key]); // Mark the status as seen
        }

        if (settings.status_seen) {
                console.log(`❤️ Reacting to status from ${remoteJid}...`);

                  // Defensive: Ensure status.key is an object
            if (typeof status.key !== 'object' || !status.key.id || !status.key.remoteJid) {
                console.error('❌ Invalid status.key for reaction:', status.key);
                return;
            }
                // Ensure participant is set
                if (!status.key.participant) {
                    status.key.participant = status.key.remoteJid;
                }
                await sock.sendMessage(
                    status.key.remoteJid,
                    {
                        react: {
                            key: status.key,
                            text: '❤️', // Emoji reaction
                        },
                    },
                    {
                        statusJidList: [status.key.participant, sock.user.id],
                    }
                );
            }
    } catch (error) {
        console.error('❌ Failed to handle status update:', error);
    }
};
// await conn.sendMessage(
//   message.key.remoteJid,
//   {
//     react: {
//       key: message.key,
//       text: '❤️', // Emoji reaction
//     },
//   },
//   {
//     statusJidList: [message.key.participant, conn.user.id],
//   }
// );


/**
 * Handle status commands.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} command - The command to execute.
 * @param {string[]} args - The command arguments.
 * @param {string} userId - The bot owner's ID.
 * @param {object} botInstance - The bot instance for the current user.
 */
const handleStatusCommand = async (sock, command, args, userId, botInstance) => {
    try {
        const subCommand = args[0]?.toLowerCase();
        const userJid = `${userId}@s.whatsapp.net`; // Ensure userId is formatted as a WhatsApp JID

        switch (subCommand) {
            case 'on':
                await updateUserStatusSettingsCached(userId, { status_seen: true });
                await sendToChat(botInstance, userJid, { message: '✅ Status viewing enabled.' });
                break;

            case 'off':
                await updateUserStatusSettingsCached(userId, { status_seen: false });
                await sendToChat(botInstance, userJid, { message: '✅ Status viewing disabled.' });
                break;

              default:
                await sendToChat(botInstance, userJid, { message: '❌ Invalid status command.' });
        }
    } catch (error) {
        console.error('❌ Failed to handle status command:', error);
    }
};


/**
 * View all unseen statuses when the bot comes online.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} userId - The bot owner's ID.
 */
const viewUnseenStatuses = async (sock, userId) => {
    try {
        const settings = await getUserStatusSettings(userId); // Fetch user's status settings

        if (!settings.status_seen) {
            console.log('ℹ️ Status viewing is disabled. Skipping unseen statuses.');
            return;
        }

        console.log('🔍 Fetching all statuses...');
        const { statuses } = await sock.fetchStatus(); // Correctly destructure

        if (!statuses || statuses.length === 0) {
            console.log('ℹ️ No statuses found.');
            return;
        }

        for (const [jid, { status }] of Object.entries(statuses)) {
            for (const s of status) {
                const key = {
                    remoteJid: jid,
                    id: s.id,           // Each status ID
                    participant: jid    // Typically the status poster
                };
                console.log(`👀 Viewing status from ${jid}...`);
                await sock.readMessages([key]); // Mark as seen
            }
        }

        console.log('✅ All statuses have been viewed.');
    } catch (error) {
        console.error('❌ Failed to view statuses:', error);
    }
};


module.exports = { handleStatusUpdate, handleStatusCommand, viewUnseenStatuses };