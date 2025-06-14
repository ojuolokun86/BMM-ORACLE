const { getSocketInstance } = require('./socket');
const { listSessionsFromMemory, getUserTotalROM, getSessionMemoryUsage, getUptime, getLastActive, getVersion } = require('../database/models/memory');
const { getActivityLog, getAnalyticsData } = require('./info');

function emitUserBotInfo(authId) {
    const io = getSocketInstance();
    if (!io) return;
    const bots = listSessionsFromMemory().filter(bot => bot.authId === authId);
    const botsWithDetails = bots.map(bot => ({
        phoneNumber: bot.phoneNumber,
        authId: bot.authId,
        status: bot.active ? 'Active' : 'Inactive',
        ram: getSessionMemoryUsage(bot.phoneNumber),
        rom: `${getUserTotalROM(authId)} MB`,
        uptime: getUptime(bot.phoneNumber),
        lastActive: getLastActive(bot.phoneNumber),
        version: bot.version || getVersion(),
    }));
    io.to(String(authId)).emit('bot-info', { bots: botsWithDetails });
    io.to(String(authId)).emit('activity-log', getActivityLog(authId));
    io.to(String(authId)).emit('analytics', getAnalyticsData(authId));
}

module.exports = { emitUserBotInfo };