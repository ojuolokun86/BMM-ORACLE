const { getUptime, getVersion } = require('../database/models/memory');
const { getMetricsForAuthId } = require('../database/models/metrics');
const sendToChat = require('../utils/sendToChat');

function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds = seconds % (24 * 60 * 60);
    const hours = Math.floor(seconds / (60 * 60));
    seconds = seconds % (60 * 60);
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (seconds > 0 || time === '') time += `${seconds}s`;

    return time.trim();
}

async function handlePing(sock, botInstance, remoteJid, message, userId, authId) {
    try {
        const start = Date.now();

        // Simulate a small async operation to measure response time
        await Promise.resolve();

        const end = Date.now();
        const responseTime = end - start;

        // Get uptime for this user's bot session
        const uptimeRaw = getUptime(userId);
        let uptimeFormatted = uptimeRaw;
        if (typeof uptimeRaw === 'string' && uptimeRaw !== 'N/A') {
            uptimeFormatted = uptimeRaw;
        } else if (typeof uptimeRaw === 'number') {
            uptimeFormatted = formatTime(uptimeRaw);
        }

        // Get version
        const version = getVersion();

        // Get speed/metrics (command processing time, if available)
        let speed = 'N/A';
        if (authId) {
            const metricsArr = getMetricsForAuthId(authId);
            const userMetrics = metricsArr.find(m => m.phoneNumber === userId);
            if (userMetrics && userMetrics.commandProcessingTime) {
                speed = `${userMetrics.commandProcessingTime} ms`;
            }
        }

const info = `
🏓 *Pong!*
⏱️ *Uptime:* ${uptimeFormatted}
🔖 *Version:* ${version}
⚡ *Response Time:* ${speed}
`.trim();

        await sendToChat(botInstance, remoteJid, {
            message: info,
            quotedMessage: message
        });
    } catch (error) {
        console.error('❌ Error in ping command:', error);
        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to get bot status.' });
    }
}

module.exports = handlePing;