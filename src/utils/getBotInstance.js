const { botInstances } = require('./globalStore');

function getBotInstance(botInstanceId, sock) {
    // Try botInstances by id
    if (botInstances[botInstanceId]) return botInstances[botInstanceId];

    // Try lid from sock
    const lid = sock?.user?.lid?.split(':')[0];
    if (lid && botInstances[lid]) return botInstances[lid];

    // Try id from sock
    const id = sock?.user?.id?.split(':')[0];
    if (id && botInstances[id]) return botInstances[id];

    // Fallback: return an object with id and lid from sock if available
    return {
        id: sock?.user?.id ? sock.user.id.split(':')[0] : botInstanceId,
        lid: sock?.user?.lid ? sock.user.lid.split(':')[0] : undefined
    };
}

module.exports = { getBotInstance };