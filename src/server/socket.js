const { Server } = require('socket.io');
const { getAllUserMetrics } = require('../database/models/metrics');
const cors = require('cors');
const { botInstances, lmSocketInstances, } = require('../utils/globalStore'); // Assuming this is where your bot instances are managed
const { getAnalyticsData } = require('./info'); 
let io;
const userSockets = new Map();

const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://192.168.237.58:8080", // optional: your LAN IP, if needed
  "https://techitoonbmm.netlify.app",
   "https://techitoon.netlify.app" // your production frontend URL

];

const getCorsOptions = () => ({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  credentials: true,
});

const corsOptions = getCorsOptions();

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins, // 👈 use array directly
      methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
      credentials: true,
    },
  });

  
  io.on('connection', (socket) => {
    console.log(`🔗 New WebSocket connection: ${socket.id}`);

    // Catch-all event logger for debugging
    socket.onAny((event, ...args) => {
        console.log(`[BACKEND] Event received from LM: ${event}`, args[0]);
    });

      socket.on('request-new-code', async ({ phoneNumber, authId, pairingMethod }) => {
        console.log(`🔄 [SOCKET] User requested new pairing code for ${phoneNumber}`);
        // Stop any existing session for this user
        if (botInstances[phoneNumber]) {
            try { await botInstances[phoneNumber].sock.ws.close(); } catch {}
            console.log(`🛑 Stopped existing session for phone: ${phoneNumber}`);
            delete botInstances[phoneNumber];
        }
        // Start a new session (this will emit a new pairing code)
        const { registerUser } = require('../users/registrationManager');
        console.log(`📞 Starting new session for phone: ${phoneNumber}, authId: ${authId} pairingMethod: ${pairingMethod}`);
        await registerUser(phoneNumber, io, authId, pairingMethod);
    });
    socket.on('authId', (authId) => {
      authId = String(authId);
      console.log(`😂 Received authId: ${authId} for socket: ${socket.id}`);
      userSockets.set(authId, socket.id);
      socket.join(String(authId)); // Join room for this authId
    });

    socket.on('cancel-deployment', async ({ phoneNumber, authId }) => {
    console.log(`🛑 [SOCKET] Cancel deployment for ${phoneNumber}`);
    const { fullyStopSession } = require('../users/userSession');
    await fullyStopSession(phoneNumber);
    console.log(`🗑️ Deployment cancelled and session stopped for ${phoneNumber}`);
});


// Live metrics for admin (optional, if needed)
const metricsInterval = setInterval(() => {
  const metrics = getAllUserMetrics();
  socket.emit('metrics-update', metrics);
}, 5000);

socket.on('disconnect', () => {
  console.log(`❌ WebSocket disconnected: ${socket.id}`);
  for (const [authId, id] of userSockets.entries()) {
    if (id === socket.id) userSockets.delete(authId);
      }
      clearInterval(metricsInterval);
    });
  });

  return io;
};

function emitAnalyticsUpdate(authId) {
  authId = String(authId);
    const socketId = userSockets.get(authId);
    console.log('📊 emitAnalyticsUpdate called for:', authId, 'socketId:', socketId);
    if (socketId && io) {
        const analytics = getAnalyticsData(authId);
        console.log('📊 Analytics to emit:', analytics);
        io.to(socketId).emit('analytics-update', analytics);
        console.log(`📊 Emitted analytics update for authId: ${authId}`);
    }
}

const getSocketInstance = () => {
  if (!io) {
    throw new Error('Socket.io instance not initialized.');
  }
  return io;
};

module.exports = { initializeSocket, getSocketInstance, userSockets, getCorsOptions, emitAnalyticsUpdate };
