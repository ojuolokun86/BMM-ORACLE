
/**
 * Generate a random emoji from a predefined list.
 * @returns {string} - A random emoji.
 */
const getRandomEmoji = () => {
    const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
        '😜', '🤪', '😝', '🤑', '🤡', '🤠', '🥳', '😎', '🤓', '🧐', '😏', '😬', '🤭', '🤫', '😛', '😋', '😺', '😹', '😻',
        '😼', '🙈', '🙉', '🙊', '👻', '💩', '👽', '👾', '🤖', '🎃', '😈', '👹', '👺', '🦄', '🐵', '🐒', '🦍', '🐶', '🐱',
        '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦝', '🦥', '🦦', '🦨', '🦧', '🦩',
        '🦚', '🦜', '🦢', '🦩', '🦦', '🦥', '🦨', '🦧', '🦮', '🐕‍🦺', '🐈‍⬛', '🦴', '🦷', '🦾', '🦿', '🦻', '🧠', '🦷'
    ];
    return emojis[Math.floor(Math.random() * emojis.length)];
};

const generateTagAllMessage = (groupName, sender, botOwnerName, messageContent, mentions, adminList) => {
    mentions = Array.isArray(mentions) ? mentions : [];
    adminList = Array.isArray(adminList) ? adminList : [];
    const totalMembers = mentions.length;
    const adminIds = adminList.map(id => id.split('@')[0]);
    
    let text = `🚀 *Techitoon AI Assistant* 🚀\n\n`;
    text += `📛 *Group:* *${groupName}*\n`;
    text += `🙋 *Requested by:* @${(sender || '').split('@')[0]}\n`;
    text += `👑 *Bot Owner:* *${botOwnerName}*\n`;
    text += `📝 *Message:* *${messageContent || 'No message'}*\n\n`;

    text += `📊 *Stats:*\n`;
    text += `• 👥 Total Members: *${totalMembers}*\n`;
    text += `• 👮 Admins: *${adminList.length}*\n`;
    text += `• 🙎 Non-Admins: *${totalMembers - adminList.length}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Tag everyone, indicating admins
    text += mentions.map(id => {
        const username = id.split('@')[0];
        const isAdmin = adminIds.includes(username);
        const emoji = isAdmin ? '👮' : getRandomEmoji();
        return `${emoji} @${username}`;
    }).join('\n');

    return { text, mentions };
};

module.exports = {
    generateTagAllMessage,
};