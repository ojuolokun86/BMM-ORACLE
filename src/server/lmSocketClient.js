const { io } = require('socket.io-client');
const { lmSocketInstances } = require('../utils/globalStore');

// Use your LM's public URL
//const LM_URL = 'https://load-manager.fly.dev';
const LM_URL = process.env.LM_URL; // For local development
console.log(`Connecting to LM at ${LM_URL}/bot-server`);

function getOrCreateLmSocket(authId) {
  if (!lmSocketInstances[authId]) {
    const lmSocket = io(`${LM_URL}/bot-server`, {
      transports: ['websocket', 'polling'],
    });

    lmSocket.on('connect', () => {
      console.log(`[BOT] Connected to LM WebSocket for authId: ${authId}`);
    });

    lmSocket.on('disconnect', () => {
      console.log(`[BOT] Disconnected from LM WebSocket for authId: ${authId}`);
    });

    lmSocketInstances[authId] = lmSocket;
  }
  return lmSocketInstances[authId];
}

// Export a function to emit QR to LM for a specific user
function sendQrToLm(qrPayload) {
  const { authId } = qrPayload;
  if (!authId) {
    console.warn('sendQrToLm called without authId');
    return;
  }
  const lmSocket = getOrCreateLmSocket(authId);
  lmSocket.emit('qr', qrPayload);
}

function closeLmSocket(authId) {
  if (lmSocketInstances[authId]) {
    lmSocketInstances[authId].disconnect();
    delete lmSocketInstances[authId];
    console.log(`[BOT] Closed LM socket for authId: ${authId}`);
  }
}

module.exports = { sendQrToLm, closeLmSocket };