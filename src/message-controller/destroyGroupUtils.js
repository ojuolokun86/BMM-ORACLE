const destroyGroupState = {}; // Track pending destroy confirmations
const { sendToChat } = require('../utils/messageUtils');

async function requestDestroyGroupConfirmation(sock, remoteJid, botInstance, userId, delayMs = 40000, intervalMs = 2000) {
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const participants = groupMetadata.participants;
    const membersToKick = participants.filter(
        (p) => p.id !== botInstance.user.id
    );

    if (membersToKick.length === 0) {
        await sendToChat(botInstance, remoteJid, { message: 'ℹ️ No members to remove in this group.' });
        return;
    }

    const mentions = membersToKick.map(m => m.id);
    await sendToChat(botInstance, remoteJid, {
        message: `⚠️ *DESTROY GROUP OPERATION*\n\nAll members will be removed and the bot will leave the group!\n\n*Type* \`.yesdestroy\` *to confirm or* \`.canceldestroy\` *to abort within 40 seconds.*\n\nAffected members:\n${mentions.map(m => `• @${m.split('@')[0]}`).join('\n')}`,
        mentions
    });

    destroyGroupState[remoteJid] = { pending: true, cancel: false, confirmed: false, membersToKick, botInstance, sock, userId, intervalMs };

    setTimeout(async () => {
        if (!destroyGroupState[remoteJid]?.confirmed) {
            await sendToChat(botInstance, remoteJid, { message: '❌ Destroy group operation timed out and was cancelled.' });
            delete destroyGroupState[remoteJid];
        }
    }, delayMs);
}

async function confirmDestroyGroup(remoteJid) {
    const state = destroyGroupState[remoteJid];
    if (!state || !state.pending) return false;

    state.confirmed = true;
    state.pending = false;

    const { sock, botInstance, membersToKick, intervalMs, userId } = state;

    await sendToChat(botInstance, remoteJid, { message: '✅ Confirmation received. Demoting all admins, removing all members, and leaving group...' });

    // 1. Demote all admins except the bot
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const admins = groupMetadata.participants.filter(p => p.admin && p.id !== botInstance.user.id);
    for (const admin of admins) {
        try {
            await sock.groupParticipantsUpdate(remoteJid, [admin.id], 'demote');
            await sendToChat(botInstance, remoteJid, { message: `⬇️ Demoted @${admin.id.split('@')[0]}`, mentions: [admin.id] });
        } catch (err) {
            await sendToChat(botInstance, remoteJid, { message: `❌ Failed to demote @${admin.id.split('@')[0]}. Skipping.`, mentions: [admin.id] });
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    // 2. Remove all members except the bot
    for (const member of membersToKick) {
        if (destroyGroupState[remoteJid]?.cancel) {
            await sendToChat(botInstance, remoteJid, { message: '❌ Destroy group operation cancelled.' });
            break;
        }
        try {
            await sock.groupParticipantsUpdate(remoteJid, [member.id], 'remove');
            await sendToChat(botInstance, remoteJid, { message: `✅ Removed @${member.id.split('@')[0]}`, mentions: [member.id] });
        } catch (err) {
            await sendToChat(botInstance, remoteJid, { message: `❌ Failed to remove @${member.id.split('@')[0]}. Retrying...`, mentions: [member.id] });
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
                await sock.groupParticipantsUpdate(remoteJid, [member.id], 'remove');
                await sendToChat(botInstance, remoteJid, { message: `✅ Removed @${member.id.split('@')[0]} (retry)`, mentions: [member.id] });
            } catch {
                await sendToChat(botInstance, remoteJid, { message: `❌ Still failed to remove @${member.id.split('@')[0]}. Skipping.`, mentions: [member.id] });
            }
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    // 3. Leave the group
    await sendToChat(botInstance, remoteJid, { message: '✅ All members removed. Leaving group...' });
    await sock.groupLeave(remoteJid);

    // 4. Notify owner
    const ownerJid = `${userId}@s.whatsapp.net`;
    await sendToChat(botInstance, ownerJid, {
        message: `✅ Group was successfully destroyed and left by the bot.`,
    });

    delete destroyGroupState[remoteJid];
    return true;
}

function cancelDestroyGroup(remoteJid) {
    if (destroyGroupState[remoteJid]) {
        destroyGroupState[remoteJid].cancel = true;
        destroyGroupState[remoteJid].pending = false;
    }
}

module.exports = {
    requestDestroyGroupConfirmation,
    confirmDestroyGroup,
    cancelDestroyGroup,
    destroyGroupState
};