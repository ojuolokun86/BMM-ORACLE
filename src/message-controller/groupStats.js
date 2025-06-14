const supabase = require('../supabaseClient');
const { getGroupStatsMsg, getActiveMembersMsg, getInactiveMembersMsg } = require('./text');
const { formatResponse } = require('../utils/utils');

const groupStats = {}; // In-memory cache
const groupDailyStats = {}; // { [groupId]: { [YYYY-MM-DD]: count } }

// Load all stats for a group from DB into cache
async function loadGroupStatsFromDB(groupId) {
    const { data, error } = await supabase
        .from('group_stats')
        .select('*')
        .eq('group_id', groupId);
    if (error) return;
    groupStats[groupId] = {};
    for (const row of data) {
        groupStats[groupId][row.user_id] = {
            name: row.name,
            messageCount: row.message_count,
            lastMessageTime: new Date(row.last_message_time).getTime()
        };
    }
}

// Increment stat in cache and DB, and update daily stats
async function incrementGroupUserStat(groupId, userId, name) {
    if (!groupStats[groupId]) await loadGroupStatsFromDB(groupId);
    if (!groupStats[groupId]) groupStats[groupId] = {};
    if (!groupStats[groupId][userId]) groupStats[groupId][userId] = { name, messageCount: 0, lastMessageTime: null };
    groupStats[groupId][userId].messageCount += 1;
    groupStats[groupId][userId].lastMessageTime = Date.now();

    // Upsert to DB
    await supabase.from('group_stats').upsert([{
        group_id: groupId,
        user_id: userId,
        name,
        message_count: groupStats[groupId][userId].messageCount,
        last_message_time: new Date(groupStats[groupId][userId].lastMessageTime).toISOString()
    }]);

    // Daily stats
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (!groupDailyStats[groupId]) groupDailyStats[groupId] = {};
    if (!groupDailyStats[groupId][todayStr]) groupDailyStats[groupId][todayStr] = 0;
    groupDailyStats[groupId][todayStr] += 1;
    await supabase.from('group_daily_stats').upsert([{
        group_id: groupId,
        day: todayStr,
        message_count: groupDailyStats[groupId][todayStr]
    }]);
}

// Get group stats from cache
function getGroupStats(groupId) {
    return groupStats[groupId] || {};
}

// Reset group stats (cache and DB)
async function resetGroupStats(groupId) {
    groupStats[groupId] = {};
    await supabase.from('group_stats').delete().eq('group_id', groupId);
}

// Main group stats command handler
async function handleGroupStatsCommand(sock, remoteJid, botInstance) {
    if (!groupStats[remoteJid]) await loadGroupStatsFromDB(remoteJid);
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const totalMembers = groupMetadata.participants.length;
    const stats = getGroupStats(remoteJid);

    // Top active members
    const statsArr = Object.entries(stats)
        .map(([userId, data]) => ({
            userId,
            jid: groupMetadata.participants.find(p => p.id.split('@')[0] === userId)?.id || userId + '@s.whatsapp.net',
            name: data.name,
            messageCount: data.messageCount
        }))
        .sort((a, b) => b.messageCount - a.messageCount);

    const topN = 5;
    const topActive = statsArr.slice(0, topN);
    const topActiveLines = topActive.length
        ? topActive.map((u, i) => `${i + 1}. @${u.userId} — ${u.messageCount} msgs`).join('\n')
        : 'None';
    const topActiveMentions = topActive.map(u => u.jid);

    // Activity stats for last 30 days
    const now = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        days.push(dayStr);
    }
    const dailyCounts = days.map(day => ({
        day,
        count: (groupDailyStats[remoteJid] && groupDailyStats[remoteJid][day]) || 0
    }));

    // Weekly stats (last 7 days)
    const weekCounts = dailyCounts.slice(-7);
    const totalWeek = weekCounts.reduce((a, b) => a + b.count, 0);
    const peakWeekDay = weekCounts.reduce((a, b) => (b.count > a.count ? b : a));
    const quietWeekDay = weekCounts.reduce((a, b) => (b.count < a.count ? b : a));

    // Monthly stats (current calendar month)
    const thisMonth = now.toISOString().slice(0, 7); // 'YYYY-MM'
    const monthCounts = dailyCounts.filter(d => d.day.startsWith(thisMonth));
    const totalMonth = monthCounts.reduce((a, b) => a + b.count, 0);

    // 30-day stats
    const total30 = dailyCounts.reduce((a, b) => a + b.count, 0);

    // Format summaries
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeklySummary =
        `- Total: ${totalWeek}
- Peak: ${dayNames[new Date(peakWeekDay.day).getDay()]} (${peakWeekDay.count} msgs)
- Quietest: ${dayNames[new Date(quietWeekDay.day).getDay()]} (${quietWeekDay.count} msgs)`;
    const monthlySummary = `- Total: ${totalMonth}`;
    const thirtyDaySummary = `- Total: ${total30}`;

    // Active/inactive members
    const nowMs = Date.now();
    const activeThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    const activeMembers = [];
    const inactiveMembers = [];
    for (const participant of groupMetadata.participants) {
        const userId = participant.id.split('@')[0];
        const stat = stats[userId];
        if (stat && nowMs - stat.lastMessageTime <= activeThreshold) {
            activeMembers.push(participant.id); // full JID for mention
        } else {
            inactiveMembers.push(participant.id); // full JID for mention
        }
    }

    // Find group admin (owner)
    const ownerId = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin')?.id || groupMetadata.participants[0].id;

    // Build and send message
    const msg = getGroupStatsMsg({
        groupName: groupMetadata.subject,
        groupId: remoteJid,
        groupAdmin: ownerId,
        totalMembers,
        activeMembers: activeMembers.length,
        inactiveMembers: inactiveMembers.length,
        activeList: activeMembers,
        inactiveList: inactiveMembers,
        topActiveLines,
        topActiveMentions,
        weeklySummary,
        monthlySummary,
        thirtyDaySummary
    });

    const formattedText = await formatResponse(botInstance, msg.text);
    await botInstance.sendMessage(remoteJid, { ...msg, text: formattedText });
}

// List only active members
async function handleActiveMembersCommand(sock, remoteJid, botInstance) {
    if (!groupStats[remoteJid]) await loadGroupStatsFromDB(remoteJid);
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const stats = getGroupStats(remoteJid);

    const now = Date.now();
    const activeThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    const activeMembers = [];
    for (const participant of groupMetadata.participants) {
        const userId = participant.id.split('@')[0];
        const stat = stats[userId];
        if (stat && now - stat.lastMessageTime <= activeThreshold) {
            activeMembers.push(participant.id); // full JID
        }
    }

    // Find group admin (owner)
    const ownerId = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin')?.id || groupMetadata.participants[0].id;

    const msg = getActiveMembersMsg({
        groupName: groupMetadata.subject,
        groupId: remoteJid,
        groupAdmin: ownerId,
        activeList: activeMembers
    });

    const formattedText = await formatResponse(botInstance, msg.text);
    await botInstance.sendMessage(remoteJid, { ...msg, text: formattedText });
}

// List only inactive members
async function handleInactiveMembersCommand(sock, remoteJid, botInstance) {
    if (!groupStats[remoteJid]) await loadGroupStatsFromDB(remoteJid);
    const groupMetadata = await sock.groupMetadata(remoteJid);
    const stats = getGroupStats(remoteJid);

    const now = Date.now();
    const activeThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    const inactiveMembers = [];
    for (const participant of groupMetadata.participants) {
        const userId = participant.id.split('@')[0];
        const stat = stats[userId];
        if (!stat || now - stat.lastMessageTime > activeThreshold) {
            inactiveMembers.push(participant.id); // full JID for mention
        }
    }

    // Find group admin (owner)
    const ownerId = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin')?.id || groupMetadata.participants[0].id;

    const msg = getInactiveMembersMsg({
        groupName: groupMetadata.subject,
        groupId: remoteJid,
        groupAdmin: ownerId,
        inactiveList: inactiveMembers
    });
    const formattedText = await formatResponse(botInstance, msg.text);
    await botInstance.sendMessage(remoteJid, { ...msg, text: formattedText });
}

module.exports = {
    incrementGroupUserStat,
    getGroupStats,
    resetGroupStats,
    handleGroupStatsCommand,
    loadGroupStatsFromDB,
    handleActiveMembersCommand,
    handleInactiveMembersCommand
};