const { groupKickAllState } = require('../utils/globalStore');
const sendToChat = require('../utils/sendToChat');

/**
 * Initiate the kick all confirmation process.
 */
async function requestKickAllConfirmation(sock, remoteJid, botInstance, userId, delayMs = 40000, intervalMs = 2000) { // 40 seconds
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const participants = groupMetadata.participants;
    const membersToKick = participants.filter(
        (p) => !p.admin && p.id !== botInstance.user.id
    );

    if (membersToKick.length === 0) {
        await sendToChat(botInstance, remoteJid, { message: 'ℹ️ No members to kick in this group.' });
        return;
    }

    const mentions = membersToKick.map(m => m.id);
    await sendToChat(botInstance, remoteJid, {
        message: `⚠️ *KICK ALL OPERATION*\n\nAll non-admin members will be kicked!\n\n*Type* \`.yeskick\` *to confirm or* \`.cancelkick\` *to abort within 40 seconds.*\n\nAffected members:\n${mentions.map(m => `• @${m.split('@')[0]}`).join('\n')}`,
        mentions
    });

    // Set pending confirmation state
    groupKickAllState[remoteJid] = { pending: true, cancel: false, confirmed: false, membersToKick, botInstance, sock, userId, intervalMs };

    // Wait for confirmation or cancel
    setTimeout(async () => {
        if (!groupKickAllState[remoteJid]?.confirmed) {
            await sendToChat(botInstance, remoteJid, { message: '❌ Kick all operation timed out and was cancelled.' });
            delete groupKickAllState[remoteJid];
        }
    }, delayMs);
}

/**
 * Confirm and start the kick all operation.
 */
async function confirmKickAll(remoteJid) {
    const state = groupKickAllState[remoteJid];
    if (!state || !state.pending) return false;

    state.confirmed = true;
    state.pending = false;

    const { sock, botInstance, membersToKick, intervalMs } = state;

    await sendToChat(botInstance, remoteJid, { message: '✅ Confirmation received. Kicking all non-admin members now...' });

    for (const member of membersToKick) {
        if (groupKickAllState[remoteJid]?.cancel) {
            await sendToChat(botInstance, remoteJid, { message: '❌ Kick all operation cancelled.' });
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

    delete groupKickAllState[remoteJid];
    await sendToChat(botInstance, remoteJid, { message: '✅ Kick all operation completed.' });
    return true;
}

/**
 * Cancel the kick all operation for a group.
 */
function cancelKickAll(remoteJid) {
    if (groupKickAllState[remoteJid]) {
        groupKickAllState[remoteJid].cancel = true;
        groupKickAllState[remoteJid].pending = false;
    }
}

module.exports = { requestKickAllConfirmation, confirmKickAll, cancelKickAll };