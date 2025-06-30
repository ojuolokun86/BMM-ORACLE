require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
    console.log = function () {};
}
const events = require('events');
events.EventEmitter.defaultMaxListeners = 0;
console.log('🔧 Increased default max listeners to unlimited for EventEmitter');
const express = require('express');

const http = require('http');
const bodyParser = require('body-parser');
const cors = require('cors');
const supabase = require('../supabaseClient');
const { loadAllSessionsFromSupabase } = require('../database/models/supabaseAuthState');
const { deleteAllUsers } = require('../database/userDatabase');

const { router: adminRoutes } = require('./adminRoutes');
const { router: userRoutes } = require('./userRoutes');
const authRoutes = require('./authRoutes');

const validateToken = require('../middlewares/validateToken');
const { initializeSocket, getCorsOptions } = require('./socket');

const createServer = () => {
  const app = express();
  server = http.createServer(app);
  const io = initializeSocket(server);
  global.io = io;
  const corsOptions = getCorsOptions();
  app.use(cors(corsOptions));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.use('/api/admin', adminRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);


  app.get('/api/health', async (req, res) => {
  try {
    console.log('🔍 [health] Checking server health...');
    const SERVER_ID = process.env.SERVER_ID;
    const { count, error } = await supabase
      .from('sessions')
      .select('phoneNumber', { count: 'exact', head: true })
      .eq('server_id', SERVER_ID);

    if (error) {
      return res.status(500).json({ healthy: false, error: error.message });
    }

    res.json({ healthy: true, load: count });
  } catch (err) {
    res.status(500).json({ healthy: false, error: err.message });
  }
});
  // Start a new session
  app.post('/api/start-session', validateToken, async (req, res) => {
    const { phoneNumber, authId, pairingMethod,} = req.body;
    console.log('➡️ [start-session] Received:', { phoneNumber, authId, pairingMethod, });

    if (!phoneNumber || !authId) {
        console.error('❌ [start-session] Missing phoneNumber or authId');
        return res.status(400).json({ error: 'Phone number and auth_id are required.' });
    }

    // Fetch subscription info
    const { data: token, error } = await supabase
        .from('subscription_tokens')
        .select('subscription_level, expiration_date')
        .eq('user_auth_id', authId)
        .single();
    console.log('🔍 [start-session] Subscription token:', { token, error });

    if (error || !token) {
        console.error('❌ [start-session] Invalid or expired token:', error);
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    // Count current bots
    const { data: bots, error: botsError } = await supabase
        .from('users')
        .select('user_id')
        .eq('auth_id', authId);
    console.log('🔢 [start-session] Bots:', { bots, botsError });

    if (botsError) {
        console.error('❌ [start-session] Error fetching bots:', botsError);
        return res.status(500).json({ error: 'Error fetching bots.' });
    }

    const botCount = bots ? bots.length : 0;

    // Set limits
    let maxBots = 1, months = 1, days = 0;
    if (token.subscription_level === 'gold') { maxBots = 3; months = 2; }
    if (token.subscription_level === 'premium') { maxBots = 5; months = 3; }
    if (token.subscription_level === 'trier') { maxBots = 1; months = 0; days = 7; }
    if (token.subscription_level === 'basic') { maxBots = 1; months = 1; }

    if (!token || !token.subscription_level) {
        console.error('❌ [start-session] No valid subscription found.');
        return res.status(403).json({ error: 'No valid subscription found. Please subscribe to use the bot.' });
    }

    if (token.subscription_level === 'free') {
        if (botCount >= 1) {
            console.error('❌ [start-session] Free tier allows only one bot.');
            return res.status(403).json({ error: 'Free tier allows only one bot. Please upgrade your subscription to add more.' });
        }
    }

    if (botCount >= maxBots) {
    const msg = `You have used all your bot slots for your "${token.subscription_level}" subscription (${maxBots} bot${maxBots > 1 ? 's' : ''}). If you want to remove a bot, please contact the developer.`;
    console.error(`❌ [start-session] ${msg}`);
    return res.status(403).json({ error: msg });
  }

    // Continue with registration...
    try {
        console.log('🚦 [start-session] Calling registerUser...');
        const { registerUser,} = require('../users/registrationManager');
        await registerUser(phoneNumber, io, authId, pairingMethod);
        console.log('✅ [start-session] Session started successfully.');
        return res.status(200).json({ message: 'Session started. Please scan the QR code.' });
    } catch (err) {
        console.error('❌ [start-session] Error in registerUser:', err);
        return res.status(500).json({ error: 'Failed to start session.', details: err.message });
    }
});
  // Delete all users
  app.delete('/api/delete-all-users', async (req, res) => {
    try {
      await deleteAllUsers();
      console.log('✅ All users deleted successfully.');
      return res.status(200).json({ message: 'All users deleted successfully.' });
    } catch (error) {
      console.error('❌ Error deleting all users:', error);
      return res.status(500).json({ error: 'Failed to delete all users.' });
    }
  });

  app.post('/api/cancel-deployment', async (req, res) => {
    const { phoneNumber, authId } = req.body;
    if (!phoneNumber || !authId) {
        return res.status(400).json({ error: 'phoneNumber and authId are required.' });
    }
    try {
        const { fullyStopSession } = require('../users/userSession');
        await fullyStopSession(phoneNumber);
        console.log(`🗑️ [API] Deployment cancelled and session stopped for ${phoneNumber}`);
        res.json({ success: true, message: 'Deployment cancelled.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to cancel deployment.' });
    }
});

  app.get('/api/admin/bots', (req, res) => {
  const { botInstances } = require('../utils/globalStore');
  const bots = Object.values(botInstances).map(bot => ({
    phoneNumber: bot.phoneNumber || 'N/A',
    authId: bot.authId || 'N/A',
    status: bot.status || 'Inactive',
    ram: bot.ram || 0,
    rom: bot.rom || 0,
    memoryUsage: bot.memoryUsage || 0,
    server: process.env.SERVER_ID || 'N/A',
  }));
  res.json({ bots });
});


  const { saveSessionToSQLite } = require('../database/models/sqliteAuthState');
  const { loadSessionFromSupabase } = require('../database/models/supabaseAuthState');

app.post('/api/admin/reload-sessions', async (req, res) => {
  try {
    const SERVER_ID = process.env.SERVER_ID;
    // 1. Fetch all sessions assigned to this server
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('phoneNumber, authId')
      .eq('server_id', SERVER_ID);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const { startNewSession } = require('../users/userSession');
    const io = getSocketInstance();
    let started = 0, skipped = 0;

    for (const session of sessions || []) {
      const { botInstances } = require('../utils/globalStore');
      if (botInstances[session.phoneNumber]) {
        skipped++;
        continue;
      }
      try {
        // Load session data from Supabase and save to SQLite before starting
        const sessionData = await loadSessionFromSupabase(session.phoneNumber);
        if (sessionData && sessionData.creds && sessionData.keys) {
          saveSessionToSQLite(session.phoneNumber, sessionData.creds, sessionData.keys, session.authId);
        }
        await startNewSession(session.phoneNumber, io, session.authId);
        started++;
      } catch (err) {
        console.error(`❌ Failed to start session for ${session.phoneNumber}:`, err.message);
      }
    }

    res.json({
      success: true,
      message: `Sessions reloaded from Supabase. Started: ${started}, Skipped (already running): ${skipped}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
};


const { syncSQLiteToSupabase, deleteAllSessionsFromSQLite, cleanupOrphanedSessionsInSQLite } = require('../database/models/sqliteAuthState');

// Graceful shutdown for all signals
function gracefulShutdown() {
    console.log('🛑 Shutting down, syncing SQLite sessions to Supabase...');
    syncSQLiteToSupabase()
        .then(() => {
            deleteAllSessionsFromSQLite();
            console.log('✅ All sessions synced and deleted from SQLite. Exiting.');
            process.exit(0);
        })
        .catch((e) => {
            console.error('❌ Sync on shutdown failed:', e);
            process.exit(1);
        });
}

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, gracefulShutdown);
});
process.on('exit', gracefulShutdown);

// Cleanup orphaned sessions on startup
(async () => {
    await cleanupOrphanedSessionsInSQLite();
    console.log('✅ Orphaned sessions cleanup completed.');
})();

// Optionally, run periodically:
setInterval(cleanupOrphanedSessionsInSQLite, 10 * 60 * 1000); // every 10 minutes

module.exports = { createServer };
