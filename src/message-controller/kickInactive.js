const { groupKickInactiveState } = require('../utils/globalStore');
const sendToChat = require('../utils/sendToChat');
const { getInactiveMembersMsg } = require('./text');
const { handleInactiveMembersCommand } = require('./groupStats');

/**
 * Initiate the kick inactive confirmation process.
 */
async function requestKickInactiveConfirmation(sock, remoteJid, botInstance, userId, delayMs = 90000, intervalMs = 2000) { // 90 seconds
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const participants = groupMetadata.participants;

    // Get inactive members using your groupStats logic
    const statsModule = require('./groupStats');
    if (!statsModule.groupStats[remoteJid]) await statsModule.loadGroupStatsFromDB(remoteJid);
    const stats = statsModule.getGroupStats(remoteJid);

    const now = Date.now();
    const activeThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    const inactiveMembers = participants.filter(participant => {
        const userId = participant.id.split('@')[0];
        const stat = stats[userId];
        return !stat || now - stat.lastMessageTime > activeThreshold;
    }).filter(p => !p.admin && p.id !== botInstance.user.id);

    if (inactiveMembers.length === 0) {
        await sendToChat(botInstance, remoteJid, { message: 'ℹ️ No inactive members to kick in this group.' });
        return;
    }

    const mentions = inactiveMembers.map(m => m.id);
    await sendToChat(botInstance, remoteJid, {
        message: `⚠️ *KICK INACTIVE OPERATION*\n\nAll inactive (7d+) non-admin members will be kicked!\n\n*Type* \`.confirm\` *to confirm or* \`.cancelk\` *to abort within 90 seconds.*\n\nAffected members:\n${mentions.map(m => `• @${m.split('@')[0]}`).join('\n')}`,
        mentions
    });

    // Set pending confirmation state
    groupKickInactiveState[remoteJid] = { pending: true, cancel: false, confirmed: false, inactiveMembers, botInstance, sock, userId, intervalMs };

    // Wait for confirmation or cancel
    setTimeout(async () => {
        if (!groupKickInactiveState[remoteJid]?.confirmed) {
            await sendToChat(botInstance, remoteJid, { message: '❌ Kick inactive operation timed out and was cancelled.' });
            delete groupKickInactiveState[remoteJid];
        }
    }, delayMs);
}

/**
 * Confirm and start the kick inactive operation.
 */
async function confirmKickInactive(remoteJid) {
    const state = groupKickInactiveState[remoteJid];
    if (!state || !state.pending) return false;

    state.confirmed = true;
    state.pending = false;

    const { sock, botInstance, inactiveMembers, intervalMs } = state;

    await sendToChat(botInstance, remoteJid, { message: '✅ Confirmation received. Kicking all inactive members now...' });

    for (const member of inactiveMembers) {
        if (groupKickInactiveState[remoteJid]?.cancel) {
            await sendToChat(botInstance, remoteJid, { message: '❌ Kick inactive operation cancelled.' });
            break;
        }
        try {
            await sock.groupParticipantsUpdate(remoteJid, [member.id], 'remove');
            await sendToChat(botInstance, remoteJid, { message: `✅ Kicked @${member.id.split('@')[0]}`, mentions: [member.id] });
        } catch (err) {
            await sendToChat(botInstance, remoteJid, { message: `❌ Failed to kick @${member.id.split('@')[0]}. Retrying...`, mentions: [member.id] });
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
                await sock.groupParticipantsUpdate(remoteJid, [member.id], 'remove');
                await sendToChat(botInstance, remoteJid, { message: `✅ Kicked @${member.id.split('@')[0]} (retry)`, mentions: [member.id] });
            } catch {
                await sendToChat(botInstance, remoteJid, { message: `❌ Still failed to kick @${member.id.split('@')[0]}. Skipping.`, mentions: [member.id] });
            }
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    delete groupKickInactiveState[remoteJid];
    await sendToChat(botInstance, remoteJid, { message: '✅ Kick inactive operation completed.' });
    return true;
}

/**
 * Cancel the kick inactive operation for a group.
 */
function cancelKickInactive(remoteJid) {
    if (groupKickInactiveState[remoteJid]) {
        groupKickInactiveState[remoteJid].cancel = true;
        groupKickInactiveState[remoteJid].pending = false;
    }
}

module.exports = { requestKickInactiveConfirmation, confirmKickInactive, cancelKickInactive };