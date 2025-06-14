function getGroupInfoMsg({ groupName, remoteJid, owner, memberCount, adminCount, groupDesc, adminList }) {
    return `📋 *Group Info*
━━━━━━━━━━━━━━━━━━
📛 *Name:* ${groupName}
🆔 *ID:* ${remoteJid}
👑 *Owner:* @${owner.split('@')[0]}
👥 *Members:* ${memberCount}
🛡️ *Admins:* ${adminCount}

📝 *Description:*
${groupDesc}

📃 *Admin List:*
${adminList}
━━━━━━━━━━━━━━━━━━`;
}

function getAntiLinkStatusMsg({ settings, bypassUsersList, groupName, groupId }) {
    return `🛡️ *Anti-Link Settings*
━━━━━━━━━━━━━━━━━━━━
📛 *Group Name:* ${groupName || 'Unknown'}
🆔 *Group ID:* ${groupId || 'Unknown'}
✅ *Enabled:* ${settings.antilink_enabled ? 'Yes' : 'No'}
⚠️ *Warning Count:* ${typeof settings.warning_count === 'number' ? settings.warning_count : 3}
👮 *Bypass Admin:* ${settings.bypass_admin ? 'Yes' : 'No'}

🙅 *Bypass Users:*
${bypassUsersList}
━━━━━━━━━━━━━━━━━━━━`;
}

function getWarningListMsg(warnings, { groupName = 'Unknown', groupAdmin = 'Unknown', groupId = 'Unknown' } = {}) {
    if (!warnings || warnings.length === 0) {
        return { text: 'ℹ️ No warnings found for this group.', mentions: [] };
    }
    const mentions = [];
    const lines = warnings.map((warning, index) => {
        const userJid = warning.user_id;
        mentions.push(userJid);
        const userTag = `@${userJid.split('@')[0]}`;
        return `${index + 1}. ${userTag} - ${warning.warning_count} warning${warning.warning_count !== 1 ? 's' : ''} (${warning.reason || 'No reason provided'})`;
    });
    return {
        text:
`*⚠️ Warning List for Group:*
━━━━━━━━━━━━━━━━━━━━
📛 *Group Name:* ${groupName}
👑 *Group Admin:* @${groupAdmin.split('@')[0]}
🆔 *Group ID:* ${groupId}

${lines.join('\n')}
━━━━━━━━━━━━━━━━━━━━`,
        mentions
    };
}

function formatMentionTag(jid) {
    return `@${jid.split('@')[0]}`;
}

function getActiveMembersMsg({ groupName, groupId, groupAdmin, activeList }) {
    // activeList should be an array of JIDs (e.g., 23481...@s.whatsapp.net)
    const mentions = [groupAdmin, ...activeList];
    const activeLines = activeList.length
        ? activeList.map(jid => formatMentionTag(jid)).join('\n')
        : 'None';
    return {
        text:
`🟢 *Active Members (last 7 days)*
━━━━━━━━━━━━━━━━━━
📛 *Name:* ${groupName}
🆔 *ID:* ${groupId}
👑 *Admin:* ${formatMentionTag(groupAdmin)}

${activeLines}
━━━━━━━━━━━━━━━━━━`,
        mentions
    };
}

function getInactiveMembersMsg({ groupName, groupId, groupAdmin, inactiveList }) {
    const mentions = [groupAdmin, ...inactiveList];
    const inactiveLines = inactiveList.length
        ? inactiveList.map(jid => formatMentionTag(jid)).join('\n')
        : 'None';
    return {
        text:
`🔴 *Inactive Members (last 7 days)*
━━━━━━━━━━━━━━━━━━
📛 *Name:* ${groupName}
🆔 *ID:* ${groupId}
👑 *Admin:* ${formatMentionTag(groupAdmin)}

${inactiveLines}
━━━━━━━━━━━━━━━━━━`,
        mentions
    };
}

function getGroupStatsMsg({
    groupName,
    groupId,
    groupAdmin,
    totalMembers,
    activeMembers,
    inactiveMembers,
    activeList,
    inactiveList,
    topActiveLines,
    topActiveMentions = [],
    weeklySummary,
    monthlySummary,
    thirtyDaySummary
}) {
    return {
        text:
`📊 *Group Stats*
━━━━━━━━━━━━━━━━━━
📛 *Name:* ${groupName}
🆔 *ID:* ${groupId}
👑 *Admin:* @${groupAdmin.split('@')[0]}
👥 *Members:* ${totalMembers}

🟢 *Active (7d):* ${activeMembers}
🔴 *Inactive:* ${inactiveMembers}

${topActiveLines ? `🥇 *Most Active:*\n${topActiveLines}` : ''}
${activeList.length ? `\n🟢 *Active Members:*\n${activeList.map(jid => '@' + jid.split('@')[0]).join('\n')}` : ''}
${inactiveList.length ? `\n\n🔴 *Inactive Members:*\n${inactiveList.map(jid => '@' + jid.split('@')[0]).join('\n')}` : ''}

${weeklySummary ? `\n📅 *This Week:*\n${weeklySummary}` : ''}
${monthlySummary ? `\n🗓️ *This Month:*\n${monthlySummary}` : ''}
${thirtyDaySummary ? `\n📆 *Last 30 Days:*\n${thirtyDaySummary}` : ''}
━━━━━━━━━━━━━━━━━━`,
        mentions: [
            groupAdmin,
            ...activeList,
            ...inactiveList,
            ...topActiveMentions
        ]
    };
}

module.exports = {
    getGroupInfoMsg,
    getAntiLinkStatusMsg,
    getWarningListMsg,
    getActiveMembersMsg,
    getInactiveMembersMsg,
    getGroupStatsMsg
};
