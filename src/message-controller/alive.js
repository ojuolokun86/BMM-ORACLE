const sendToChat = require('../utils/sendToChat');
const { getAllSettings } = require('../utils/settingsAggregator');



async function aliveCommand(sock, remoteJid, message, userId, botInstance) {
    try {
        // Gather all settings for this user/group/bot
       const settings = await getAllSettings({
            userId,
            groupId: remoteJid,
            botInstanceId: botInstance.user.id // or botInstance.id if that's your convention
        });
        const isGroup = remoteJid.endsWith('@g.us');
        // Mode: public/private/admin
        let mode = 'Private'; // Default to Private
        const groupMode = settings.groupMode?.toLowerCase?.() || settings.groupMode?.toLowerCase() || 'me';
        if (groupMode === 'admin') mode = 'Admin';
        else if (groupMode === 'public') mode = 'Public';
        // If groupMode is 'me' or falsy, keep as 'Private'

        // Antilink
        const antilinkStatus = settings.antilink?.antilink_enabled ? '🟢 On' : '🔴 Off';

        // Status Seen/React
        const statusSeen = settings.statusSettings?.status_seen ? '🟢 On' : '🔴 Off';
        const statusReact = settings.statusSettings?.status_seen ? '🟢 On' : '🔴 Off';

        // Prefix, DND, Subscription Level
        const prefix = settings.prefix || '.';
        const dndStatus = settings.dnd?.enabled ? '🟢 On' : '🔴 Off';
        const subscriptionLevel = settings.subscriptionLevel || 'free';

        // Compose message
      const aliveMsg = `
╭━━━〔 *🤖 ${settings.botName || 'BMM'} Bot is Online* 〕━━━╮

📦 *Version:* ${settings.botVersion}
⚙️ *Mode:* ${mode}
📡 *Status:* 🟢 Alive

🔑 *Prefix:* ${prefix}
⏰ *DND:* ${dndStatus}
💎 *Subscription:* ${subscriptionLevel}

📋 *Security*
🚫 *Antilink:* ${antilinkStatus}
👀 *Status Seen:* ${statusSeen}
😄 *Status React:* ${statusReact}

🧩 *Core Features*
• Group Tools & Moderation
• Antilink & Antidelete
• Fun & Utility Commands
• Welcome & Warning System
• Auto Status Reaction

💬 _Type_ *.menu* _for all commands_

╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
`;



        await sendToChat(botInstance, remoteJid, {
                   message: aliveMsg,
                   quotedMessage: message
               });
    } catch (err) {
        await sendToChat(botInstance, remoteJid, {
            message: '❌ Error fetching bot status.',
            quotedMessage: message
        });
        console.error('Alive command error:', err);
    }
}

module.exports = aliveCommand;