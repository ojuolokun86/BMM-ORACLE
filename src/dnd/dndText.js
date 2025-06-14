function formatDndList(list, type = 'Whitelist', { ownerName = '', ownerJid = '', botName = 'BMM BOT' } = {}) {
    let header = `🤖 *${botName}* DND ${type}\n━━━━━━━━━━━━━━━━━━`;
    let ownerInfo = ownerName
        ? `👑 *Owner:* @${ownerJid ? ownerJid.split('@')[0] : ownerName}\n`
        : '';
    if (!list || list.length === 0) {
        return `${header}\n${ownerInfo}📃 *${type} is empty.*\n━━━━━━━━━━━━━━━━━━`;
    }
    return (
        `${header}\n${ownerInfo}📃 *${type}:*\n` +
        list.map((jid, i) => `${i + 1}. @${jid.split('@')[0]}`).join('\n') +
        `\n━━━━━━━━━━━━━━━━━━`
    );
}

module.exports = { formatDndList };