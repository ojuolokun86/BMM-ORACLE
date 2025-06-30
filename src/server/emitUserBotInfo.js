const { getSocketInstance } = require('./socket');
const { getUserTotalROM, getUptime, getLastActive, getVersion } = require('../database/models/memory');
const { getActivityLog, getAnalyticsData } = require('./info');
const supabase = require('../supabaseClient');
const { botInstances } = require('../utils/globalStore');

async function emitUserBotInfo(authId) {
    const io = getSocketInstance();
    if (!io) return;

    // Fetch bots for this user from Supabase
    const { data: bots, error } = await supabase
        .from('users')
        .select('user_id, auth_id')
        .eq('auth_id', authId);

    if (error) {
        console.error('❌ Failed to fetch bots from Supabase:', error.message);
        return;
    }

    const botsWithDetails = (bots || []).map(bot => {
        // Check if bot is active in memory
        const instance = botInstances[bot.user_id];
        const isActive = instance && instance.sock && instance.sock.ws && instance.sock.ws.readyState === 1;
        return {
            phoneNumber: bot.user_id,
            authId: bot.auth_id,
            status: isActive ? 'Active' : 'Inactive',
            rom: `${getUserTotalROM(bot.auth_id)} MB`,
            uptime: getUptime(bot.user_id),
            lastActive: getLastActive(bot.user_id),
            version: getVersion(), // Or use a global version if needed
        };
    });

    io.to(String(authId)).emit('bot-info', { bots: botsWithDetails });
    io.to(String(authId)).emit('activity-log', getActivityLog(authId));
    io.to(String(authId)).emit('analytics', getAnalyticsData(authId));
}

module.exports = { emitUserBotInfo };