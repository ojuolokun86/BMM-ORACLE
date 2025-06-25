const destroyGroupState = {}; // Track pending destroy confirmations
const { sendToChat } = require('../utils/messageUtils');

async function requestDestroyGroupConfirmation(sock, remoteJid, botInstance, userId, message, delayMs = 40000, intervalMs = 2000) {
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const participants = groupMetadata.participants;
    const membersToKick = participants.filter(
        (p) => p.id !== botInstance.user.id
    );

    if (membersToKick.length === 0) {
        await sendToChat(botInstance, remoteJid, {
            message: 'ℹ️ No members to remove in this group.',
            quotedMessage: message
        });
        return;
    }

    const mentions = membersToKick.map(m => m.id);
    await sendToChat(botInstance, remoteJid, {
        message: `⚠️ *DESTROY GROUP OPERATION*\n\nAll members will be removed and the bot will leave the group!\n\n*Type* \`.yesdestroy\` *to confirm or* \`.canceldestroy\` *to abort within 40 seconds.*\n\nAffected members:\n${mentions.map(m => `• @${m.split('@')[0]}`).join('\n')}`,
        mentions,
        quotedMessage: message
    });

    destroyGroupState[remoteJid] = { pending: true, cancel: false, confirmed: false, membersToKick, botInstance, sock, userId, intervalMs };

    setTimeout(async () => {
        if (!destroyGroupState[remoteJid]?.confirmed) {
            await sendToChat(botInstance, remoteJid, {
                message: '❌ Destroy group operation timed out and was cancelled.',
                quotedMessage: message
            });
            delete destroyGroupState[remoteJid];
        }
    }, delayMs);
}

async function confirmDestroyGroup(remoteJid, message) {
    const state = destroyGroupState[remoteJid];
    if (!state || !state.pending) return false;

    state.confirmed = true;
    state.pending = false;

    const { sock, botInstance, intervalMs, userId } = state;

    await sendToChat(botInstance, remoteJid, {
        message: '✅ Confirmation received. Removing all non-admins, demoting all admins, and leaving group...',
        quotedMessage: message
    });

    // 1. Remove all non-admins except the bot
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const nonAdmins = groupMetadata.participants.filter(
        p => !p.admin && p.id !== botInstance.user.id
    );
    for (const member of nonAdmins) {
        if (destroyGroupState[remoteJid]?.cancel) {
            await sendToChat(botInstance, remoteJid, { message: '❌ Destroy group operation cancelled.' });
            break;
        }
        try {
            await sock.groupParticipantsUpdate(remoteJid, [member.id], 'remove');
        } catch (err) {
            await sendToChat(botInstance, remoteJid, { message: `❌ Failed to remove @${member.id.split('@')[0]}. Retrying...`, mentions: [member.id] });
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
                await sock.groupParticipantsUpdate(remoteJid, [member.id], 'remove');
                //await sendToChat(botInstance, remoteJid, { message: `✅ Removed @${member.id.split('@')[0]} (retry)`, mentions: [member.id] });
            } catch {
                await sendToChat(botInstance, remoteJid, { message: `❌ Still failed to remove @${member.id.split('@')[0]}. Skipping.`, mentions: [member.id] });
            }
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    // 2. Demote all admins except the bot
    const updatedGroupMetadata = await sock.groupMetadata(remoteJid);
    const admins = updatedGroupMetadata.participants.filter(p => p.admin && p.id !== botInstance.user.id);
    let failedDemote = false;
    for (const admin of admins) {
        try {
            await sock.groupParticipantsUpdate(remoteJid, [admin.id], 'demote');
            await sendToChat(botInstance, remoteJid, { message: `⬇️ Demoted @${admin.id.split('@')[0]}`, mentions: [admin.id] });
        } catch (err) {
            await sendToChat(botInstance, remoteJid, { message: `❌ Failed to demote @${admin.id.split('@')[0]}. Group can't be destroyed (likely owner). Operation cancelled.`, mentions: [admin.id] });
            failedDemote = true;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    if (failedDemote) {
        delete destroyGroupState[remoteJid];
        return false;
    }

    // 3. Demote the bot itself (if still admin)
    const finalGroupMetadata = await sock.groupMetadata(remoteJid);
    const botParticipant = finalGroupMetadata.participants.find(p => p.id === botInstance.user.id);
    if (botParticipant && botParticipant.admin) {
        try {
            await sock.groupParticipantsUpdate(remoteJid, [botInstance.user.id], 'demote');
            await sendToChat(botInstance, remoteJid, { message: `⬇️ Bot demoted itself.` });
        } catch (err) {
            await sendToChat(botInstance, remoteJid, { message: `⚠️ Bot could not demote itself (maybe already not admin).` });
        }
    }

    // 4. Leave the group
    await sendToChat(botInstance, remoteJid, { message: '✅ All members removed. Leaving group...' });
    await sock.groupLeave(remoteJid);

    // 5. Notify owner
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