const { getUserStatusSettingsCached, updateUserStatusSettingsCached, getUserStatusSettings } = require('../database/userDatabase');
const { sendToChat } = require('../utils/messageUtils');

// A temporary queue to store live statuses if multiple arrive too fast
const liveStatusQueue = new Map();

/**
 * Handle a single status update: mark as seen + react.
 */
const handleStatusUpdate = async (sock, status, userId) => {
    try {
        const { remoteJid } = status.key;
        const settings = await getUserStatusSettingsCached(userId);
        if (!settings?.status_seen) return;

        console.log(`👀 Viewing live status from ${remoteJid}`);
        await sock.readMessages([status.key]);

        // Ensure participant is set
        if (!status.key.participant) {
            status.key.participant = status.key.remoteJid;
        }

        await sock.sendMessage(
            status.key.remoteJid,
            {
                react: {
                    key: status.key,
                    text: '❤️',
                },
            },
            {
                statusJidList: [status.key.participant, sock.user.id],
            }
        );
    } catch (error) {
        console.error('❌ Failed to handle status update:', error);
    }
};

/**
 * Queue and batch process multiple live statuses (to avoid dropping).
 */
const handleLiveStatus = (sock, status, userId) => {
    const queueKey = `${userId}`;

    if (!liveStatusQueue.has(queueKey)) {
        liveStatusQueue.set(queueKey, []);
        // Start batch processor for this user
        setTimeout(async () => {
            const statuses = liveStatusQueue.get(queueKey);
            liveStatusQueue.delete(queueKey);

            for (const s of statuses) {
                await handleStatusUpdate(sock, s, userId);
            }
        }, 1000); // Process every 1s
    }

    liveStatusQueue.get(queueKey).push(status);
};

/**
 * React to all unseen statuses when bot starts or reconnects.
 */
const viewUnseenStatuses = async (sock, userId) => {
    try {
        const settings = await getUserStatusSettings(userId);
        if (!settings?.status_seen) {
            console.log('ℹ️ Status viewing is disabled.');
            return;
        }

        console.log('🔍 Fetching all unseen statuses...');
        const { statuses } = await sock.fetchStatus();

        if (!statuses || Object.keys(statuses).length === 0) {
            console.log('ℹ️ No unseen statuses found.');
            return;
        }

        for (const [jid, { status }] of Object.entries(statuses)) {
            for (const s of status) {
                const key = {
                    remoteJid: jid,
                    id: s.id,
                    participant: jid
                };
                console.log(`👀 Viewing unseen status from ${jid}`);
                await sock.readMessages([key]);
                await sock.sendMessage(
                    jid,
                    {
                        react: {
                            key,
                            text: '❤️',
                        },
                    },
                    {
                        statusJidList: [jid, sock.user.id],
                    }
                );
            }
        }

        console.log('✅ Finished viewing unseen statuses.');
    } catch (error) {
        console.error('❌ Failed to view unseen statuses:', error);
    }
};

/**
 * Toggle status viewer from user DM commands.
 */
const handleStatusCommand = async (sock, command, args, userId, botInstance) => {
    try {
        const sub = args[0]?.toLowerCase();
        const jid = `${userId}@s.whatsapp.net`;

        if (sub === 'on') {
            await updateUserStatusSettingsCached(userId, { status_seen: true });
            await sendToChat(botInstance, jid, { message: '✅ Status viewing enabled.' });
        } else if (sub === 'off') {
            await updateUserStatusSettingsCached(userId, { status_seen: false });
            await sendToChat(botInstance, jid, { message: '✅ Status viewing disabled.' });
        } else {
            await sendToChat(botInstance, jid, { message: '❌ Invalid status command.' });
        }
    } catch (error) {
        console.error('❌ Failed to handle status command:', error);
    }
};

module.exports = {
    handleStatusUpdate,
    handleLiveStatus,
    viewUnseenStatuses,
    handleStatusCommand
};
