
const { restartUserBot } = require('../bot/restartBot');

async function healAndRestartBot(userId, authId) {
  const jid = `${userId}@s.whatsapp.net`;

  try {
    console.warn(`⚠️ Healing session for ${jid}...`);

  

    // Clear broken Signal session
    // await state.keys.set([{ key: `session:${jid}`, value: undefined }]);
    // console.log(`🧹 Session deleted for ${jid}`);

    await new Promise(res => setTimeout(res, 500));
    
    await restartUserBot(userId, null, authId);
    console.log(`✅ Bot restarted for ${userId}`);
  } catch (err) {
    console.error(`❌ Healing failed for ${userId}:`, err);
  }
}

module.exports = { healAndRestartBot };
