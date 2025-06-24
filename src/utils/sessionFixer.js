const { useHybridAuthState } = require('../database/hybridAuthState');
const { restartUserBot } = require('../bot/restartBot');

async function healAndRestartBot(userId, authId) {
  const jid = `${userId}@s.whatsapp.net`;

  try {
    console.warn(`⚠️ Healing session for ${jid}...`);

    const { state } = await useHybridAuthState(userId, authId);

    // Clear broken Signal session
    await state.keys.set([{ key: `session:${jid}`, value: undefined }]);
    console.log(`🧹 Session deleted for ${jid}`);

    await new Promise(res => setTimeout(res, 500));

    await restartUserBot(userId, jid, authId);
    console.log(`✅ Bot restarted for ${userId}`);
  } catch (err) {
    console.error(`❌ Healing failed for ${userId}:`, err);
  }
}

module.exports = { healAndRestartBot };
