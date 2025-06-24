const sendToChat = require('../utils/sendToChat');

/**
 * Helper to detect if a group is a community.
 * Baileys v6+ marks communities with groupMetadata.community === true
 * or you can check for group id pattern if needed.
 */
function isCommunity(group) {
    if (group?.community === true) return true;
    if (group?.parent) return true;
    if (group?.id && group.id.startsWith('2-')) return true;
    if (group?.announce === true && group?.id && group.id.startsWith('2-')) return true;
    return false;
}

async function handleListGroups(sock, botInstance, targetJid) {
    try {
        // Fetch all groups the bot is participating in
        const groupsObj = await sock.groupFetchAllParticipating();
        const groups = Object.values(groupsObj);

        if (!groups.length) {
            await sendToChat(botInstance, targetJid, { message: '🤖 You are not in any groups or communities.' });
            return;
        }

        // Separate groups and communities
        const communities = groups.filter(isCommunity);
        const normalGroups = groups.filter(g => !isCommunity(g));

        // Format group list
        const groupList = normalGroups.length
            ? `*Groups (${normalGroups.length}):*\n` +
              normalGroups.map(
                  (g, i) => `${i + 1}. *${g.subject || 'Unnamed Group'}*\nID: \`${g.id}\`\n👥 Members: ${g.participants?.length || '?'}`
              ).join('\n\n')
            : 'No regular groups found.';

        // Format community list
        const communityList = communities.length
            ? `*Communities (${communities.length}):*\n` +
              communities.map(
                  (g, i) => `${i + 1}. *${g.subject || 'Unnamed Community'}*\nID: \`${g.id}\`\n👥 Members: ${g.participants?.length || '?'}`
              ).join('\n\n')
            : 'No communities found.';

        // Compose the final message
        const totalGroups = normalGroups.length;
        const totalCommunities = communities.length;
        const total = groups.length;

        const message =
            `📋 *Groups & Communities I'm in:*\n\n` +
            `*Total:* ${total}\n*Groups:* ${totalGroups}\n*Communities:* ${totalCommunities}\n\n` +
            `${groupList}\n\n${communityList}`;

        await sendToChat(botInstance, targetJid, { message });
    } catch (err) {
        await sendToChat(botInstance, targetJid, { message: '❌ Failed to fetch group/community list.' });
        console.error('Failed to list groups/communities:', err);
    }
}

module.exports = handleListGroups;