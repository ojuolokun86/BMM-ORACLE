const express = require('express');
const router = express.Router();
require('dotenv').config();
const crypto = require('crypto');
const { listSessionsFromSupabase, deleteSessionFromSupabase } = require('../database/models/supabaseAuthState'); // Import the session management functions    
const { restartUserBot } = require('../bot/restartBot'); // Import the restartBot function
const {getUserTotalROM, getAllSessionsMemoryUsage, listSessionsFromMemory,  getSessionMemoryUsage } = require('../database/models/memory'); // Import the memory usage function
const { getAllUserMetrics, getGlobalMetrics } = require('../database/models/metrics');
const { deleteAllUsers, deleteUserData } = require('../database/userDatabase'); // Import deleteAllUsers function
const supabase = require('../supabaseClient'); // Import Supabase client
const { getAllComplaints } = require('../database/complaint'); // Import the complaints function
const { addNotification } = require('../database/notification'); // Import the notification function
const { getSocketInstance } = require('./socket'); // Import the socket instance
const { syncMemoryToSupabase } = require('../database/models/supabaseAuthState'); // Import at the top
const { botInstances } = require('../utils/globalStore'); // At the top
const { loadSessionFromSupabase } = require('../database/models/supabaseAuthState');
const { startNewSession } = require('../users/userSession');


// Admin login route
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        return res.json({ success: true, message: 'Login successful' });
        
    }
    
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

router.get('/users', async (req, res) => {
    try {
        const users = listSessionsFromMemory();
        // Group by authId
        const usersByAuth = {};
        users.forEach(user => {
            if (!usersByAuth[user.authId]) usersByAuth[user.authId] = [];
            usersByAuth[user.authId].push(user);
        });

        const result = Object.entries(usersByAuth).map(([authId, bots]) => {
            const rom = getUserTotalROM(authId);
            return {
                authId,
                bots: bots.map(bot => ({
                    phoneNumber: bot.phoneNumber,
                    ram: getSessionMemoryUsage(bot.phoneNumber),
                    status: bot.active ? 'Active' : 'Inactive'
                })),
                rom: `${rom} MB`
            };
        });

        res.json({ success: true, users: result });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
    }
});

router.get('/admin/bots', (req, res) => {
    const { botInstances } = require('../utils/globalStore');
    const bots = Object.values(botInstances).map(bot => ({
        phoneNumber: bot.phoneNumber || 'N/A',
        authId: bot.authId || 'N/A',
        status: bot.status || (bot.sock?.ws?.readyState === 1 ? 'Active' : 'Inactive'),
        ram: getSessionMemoryUsage(bot.phoneNumber) || 0,
        rom: getUserTotalROM(bot.authId) || 0,
        memoryUsage: getSessionMemoryUsage(bot.phoneNumber) || 0,
        uptime: getUptime(bot.phoneNumber) || 'N/A',
        lastActive: getLastActive(bot.phoneNumber) || 'N/A',
        version: bot.version || getVersion(),
        server: process.env.SERVER_ID || 'N/A',
    }));
    res.json({ bots });
});

router.delete('/users/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    try {
        console.log(`🗑️ Deleting user: ${phoneNumber}`);
        await deleteUserData(phoneNumber); // Call deleteUserData for the specific user
        res.json({ success: true, message: `User ${phoneNumber} deleted successfully` });
    } catch (error) {
        console.error(`❌ Failed to delete user ${phoneNumber}:`, error.message);
        res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
    }
});

// Route to get all user metrics
router.get('/metrics/users', (req, res) => {
    try {
        const metrics = getAllUserMetrics(); // Fetch all user metrics
        res.json({ success: true, metrics }); // Return metrics as JSON
    } catch (error) {
        console.error('❌ Error fetching user metrics:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch user metrics' });
    }
});

router.delete('/users', async (req, res) => {
    try {
        const users = await listSessionsFromSupabase(); // Fetch all sessions from Supabase
        for (const session of users) {
            const phoneNumber = session.phoneNumber; // Extract phoneNumber
            if (!phoneNumber) {
                console.warn('⚠️ Skipping undefined phone number.');
                continue;
            }
            await deleteAllUsers(phoneNumber); // Pass only the phoneNumber string
        }
        res.json({ success: true, message: 'All users deleted successfully' });
    } catch (error) {
        console.error('❌ Failed to delete all users:', error.message);
        res.status(500).json({ success: false, message: 'Failed to delete all users', error: error.message });
    }
});

router.post('/restart-bot/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    const { authId } = req.body; // Get authId from body
    try {
        await restartUserBot(phoneNumber, null, authId); // Call the restartBot function
        console.log(`Restarting bot for user: ${phoneNumber}, authId: ${authId}`);
        res.json({ success: true, message: `Bot for ${phoneNumber} restarted successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to restart bot', error: error.message });
    }
});

// Route to get memory usage for all sessions
router.get('/users/memory-usage', (req, res) => {
    try {
        const memoryUsage = getAllSessionsMemoryUsage();
        console.log('Memory usage data:', memoryUsage); // Debug log
        res.json({ success: true, memoryUsage });
    } catch (error) {
        console.error('Error fetching memory usage:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch memory usage', error: error.message });
    }
});

router.post('/stop-bot/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    try {
        if (botInstances[phoneNumber] && botInstances[phoneNumber].sock && botInstances[phoneNumber].sock.ws) {
            await botInstances[phoneNumber].sock.ws.close();
            delete botInstances[phoneNumber];
            res.json({ success: true, message: `Bot for ${phoneNumber} stopped.` });
        } else {
            res.status(404).json({ success: false, message: 'Bot instance not found or already stopped.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to stop bot.' });
    }
});


router.post('/start-bot/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    const { authId } = req.body;
    try {
        const { restartUserBot } = require('../bot/restartBot');
        await restartUserBot(phoneNumber, null, authId);
        res.json({ success: true, message: `Bot for ${phoneNumber} started.` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to start bot.' });
    }
});



const emitLiveMetricsToAdmin = () => {
    const io = getSocketInstance(); // Get the WebSocket instance

    setInterval(() => {
        try {
            const metrics = getAllUserMetrics(); // Fetch all user metrics

            // Flatten the metrics structure for easier processing in the frontend
            const formattedMetrics = metrics.map((metric) => ({
                authId: metric.authId,
                phoneNumber: metric.phoneNumber,
                messageProcessingTime: metric.messageProcessingTime || 'N/A',
                queueProcessingTime: metric.queueProcessingTime || 'N/A',
                commandProcessingTime: metric.commandProcessingTime || 'N/A',
            }));

            io.emit('metrics-update', formattedMetrics); // Emit formatted metrics to all connected clients
        } catch (error) {
            console.error('❌ Error emitting live metrics:', error.message);
        }
    }, 5000); // Emit every 5 seconds
};

router.put('/users/:phoneNumber/memory-limits', async (req, res) => {
    const { phoneNumber } = req.params;
    const { maxRam, maxRom } = req.body;

    try {
        // Update the limits in the database
        const { error } = await supabase
            .from('users')
            .update({ max_ram: maxRam, max_rom: maxRom })
            .eq('user_id', phoneNumber);

        if (error) throw new Error(error.message);

        // Fetch the updated user data
        const { data: updatedUser, error: fetchError } = await supabase
            .from('users')
            .select('user_id, max_ram, max_rom, auth_id')
            .eq('user_id', phoneNumber)
            .single();

        if (fetchError) throw new Error(fetchError.message);

        // Get current RAM and ROM usage
        const ram = getSessionMemoryUsage(phoneNumber);
        const rom = updatedUser.auth_id ? getUserTotalROM(updatedUser.auth_id) : null;

        res.json({
            success: true,
            user: {
                phoneNumber: updatedUser.user_id,
                max_ram: updatedUser.max_ram,
                max_rom: updatedUser.max_rom,
                ram,
                rom: rom !== null ? `${rom} MB` : 'N/A',
                memory_usage: ram // You can also use ram here for "Memory Usage"
            }
        });
    } catch (error) {
        console.error(`❌ Failed to update memory limits for user ${phoneNumber}:`, error.message);
        res.status(500).json({ success: false, message: 'Failed to update memory limits', error: error.message });
    }
});

router.post('/load-session/:phoneNumber', async (req, res) => {
    console.log('Loading session for phone number:', req.params.phoneNumber);
    const { phoneNumber } = req.params;
    const { authId } = req.body;
    try {
        // Try to load session from Supabase
        const session = await loadSessionFromSupabase(phoneNumber);
        if (!session) {
            return res.status(404).json({ success: false, message: 'No session found in Supabase for this user.' });
        }
        // Start the bot session
        const io = getSocketInstance();
        await startNewSession(phoneNumber, io, authId);
        res.status(200).json({ success: true, message: 'Session loaded and bot started.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load/start session.', error: error.message });
    }
});
// Endpoint to fetch all users
router.get('/users-info', async (req, res) => {
    console.log('Fetching all users from Supabase...'); // Debug log
    try {
        // Fetch all users
        const { data: users, error } = await supabase
            .from('user_auth')
            .select('email, auth_id, subscription_status');

        if (error) {
            console.error('❌ Error fetching users:', error.message);
            return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
        }

        // Fetch all tokens (subscription info)
        const { data: tokens, error: tokenError } = await supabase
            .from('subscription_tokens')
            .select('user_auth_id, expiration_date, subscription_level');

        if (tokenError) {
            console.error('❌ Error fetching tokens:', tokenError.message);
            return res.status(500).json({ success: false, message: 'Failed to fetch tokens.' });
        }

        // Map tokens by auth_id for quick lookup
        const tokenMap = {};
        tokens.forEach(token => {
            tokenMap[token.user_auth_id] = token;
        });

        // Attach daysLeft and subscription_level to each user
        const usersWithSubscription = users.map(user => {
            const token = tokenMap[user.auth_id];
            let daysLeft = 'N/A';
            let subscriptionLevel = user.subscription_status || 'N/A';
            if (token && token.expiration_date) {
                const expiration = new Date(token.expiration_date);
                const now = new Date();
                daysLeft = Math.max(0, Math.ceil((expiration - now) / (1000 * 60 * 60 * 24)));
                subscriptionLevel = token.subscription_level;
            }
            return {
                ...user,
                subscription_level: subscriptionLevel,
                days_left: daysLeft
            };
        });

        res.status(200).json({ success: true, users: usersWithSubscription });
    } catch (err) {
        console.error('❌ Unexpected error fetching users:', err.message);
        res.status(500).json({ success: false, message: 'Unexpected error occurred.' });
    }
});

router.post('/send-notification', async (req, res) => {
    const { message, targetAuthId } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, message: 'Notification message is required.' });
    }

    try {
        // Add the notification to the database with sender as 'Admin'
        await addNotification(message, targetAuthId || null, 'Admin');

        // Broadcast the notification to all connected users via WebSocket
        const io = require('./socket').getSocketInstance();
        io.emit('admin-notification', { message, targetAuthId, sender: 'Admin' });

        res.status(200).json({ success: true, message: 'Notification sent successfully.' });
    } catch (error) {
        console.error('❌ Error sending notification:', error.message);
        res.status(500).json({ success: false, message: 'Failed to send notification.' });
    }
});


router.get('/complaints', async (req, res) => {
    try {
        const complaints = await getAllComplaints(); // Fetch complaints from the database
        res.status(200).json({ success: true, complaints });
    } catch (error) {
        console.error('❌ Error fetching complaints:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch complaints.' });
    }
});

router.delete('/delete-user', async (req, res) => {
    const { authId } = req.body;

    if (!authId) {
        return res.status(400).json({ success: false, message: 'Auth ID is required.' });
    }

    try {
        console.log(`🗑️ Deleting user with Auth ID: ${authId}`);

        // Step 1: Delete the user from the `user_auth` table
        const { error: authError } = await supabase
            .from('user_auth')
            .delete()
            .eq('auth_id', authId);

        if (authError) {
            console.error(`❌ Error deleting user from user_auth table:`, authError.message);
            throw new Error(authError.message);
        }
        console.log(`✅ Deleted user from user_auth table with Auth ID: ${authId}`);

        // Step 2: Fetch all users associated with the `auth_id` from the `users` table
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('user_id')
            .eq('auth_id', authId);

        if (usersError) {
            console.error(`❌ Error fetching users from users table:`, usersError.message);
            throw new Error(usersError.message);
        }

        if (!users || users.length === 0) {
            console.log(`ℹ️ No users found for Auth ID: ${authId}`);
        } else {
            // Step 3: Delete all users and their bots
            for (const user of users) {
                const phoneNumber = user.user_id;
                console.log(`🗑️ Deleting data for user: ${phoneNumber}`);
                await deleteUserData(phoneNumber); // Delete user data and bots
            }
        }

        res.status(200).json({ success: true, message: `User with Auth ID ${authId} and all associated data deleted successfully.` });
    } catch (error) {
        console.error(`❌ Error deleting user with Auth ID ${authId}:`, error.message);
        res.status(500).json({ success: false, message: 'Failed to delete user.', error: error.message });
    }
});

router.get('/all-bots', async (req, res) => {
    try {
        const bots = listSessionsFromMemory(); // Fetch all bots from memory

        // Group bots by authId to calculate ROM per user
        const botsByAuth = {};
        bots.forEach(bot => {
            if (!botsByAuth[bot.authId]) botsByAuth[bot.authId] = [];
            botsByAuth[bot.authId].push(bot);
        });

        // Map the bots to include RAM and ROM
        const botData = [];
        for (const [authId, userBots] of Object.entries(botsByAuth)) {
            const rom = getUserTotalROM(authId);
            userBots.forEach(bot => {
                botData.push({
                    authId: bot.authId || 'N/A',
                    phoneNumber: bot.phoneNumber || 'N/A',
                    status: bot.active ? 'Active' : 'Inactive',
                    ram: getSessionMemoryUsage(bot.phoneNumber), // RAM per bot
                    rom: `${rom} MB` // ROM for all bots of this user
                });
            });
        }

        res.json({ success: true, bots: botData });
    } catch (error) {
        console.error('❌ Error fetching bots:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch bots.' });
    }
});

router.post('/send-user-notification', async (req, res) => {
    const { authId, message } = req.body;

    if (!authId || !message) {
        return res.status(400).json({ success: false, message: 'Auth ID and message are required.' });
    }

    try {
        await addNotification(message, authId, 'Admin')
        const io = require('./socket').getSocketInstance();
        console.log(`📤 Sending notification to authId: ${authId}, message: ${message}`);
        io.to(authId).emit('user-notification', { message }); // Emit to the specific authId

        res.status(200).json({ success: true, message: 'Notification sent successfully.' });
    } catch (error) {
        console.error('❌ Error sending notification:', error.message);
        res.status(500).json({ success: false, message: 'Failed to send notification.' });
    }
});

// Mark complaint as read (delete)
router.delete('/complaints/:timestamp', async (req, res) => {
    const { timestamp } = req.params;
    try {
        const { error } = await supabase
            .from('complaints')
            .delete()
            .eq('timestamp', timestamp);
        if (error) throw new Error(error.message);
        res.status(200).json({ success: true, message: 'Complaint deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete complaint.' });
    }
});



// Generate or renew a token for a user
router.post('/generate-token', async (req, res) => {
    const { authId, subscriptionLevel } = req.body;

    if (!authId || !subscriptionLevel) {
        return res.status(400).json({ success: false, message: 'Auth ID and subscription level are required.' });
    }

    try {
        // Check if the user exists with the given six-digit authId
        const { data: user, error: userError } = await supabase
            .from('user_auth')
            .select('email')
            .eq('auth_id', authId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ success: false, message: 'User with this Auth ID does not exist.' });
        }

        // Check for existing token and get its expiration date
        const { data: existingToken } = await supabase
            .from('subscription_tokens')
            .select('expiration_date')
            .eq('user_auth_id', authId)
            .single();

         let baseDate = new Date();
        if (existingToken && new Date(existingToken.expiration_date) > baseDate) {
            baseDate = new Date(existingToken.expiration_date);
        }

        let months = 1;
        let days = 0;
        if (subscriptionLevel === 'gold') months = 2;
        if (subscriptionLevel === 'premium') months = 3;
        if (subscriptionLevel === 'trier') {
            months = 0;
            days = 7; // 1 week
        }
        if (subscriptionLevel === 'basic') months = 1;

        const expirationDate = new Date(baseDate);
        if (months > 0) expirationDate.setMonth(expirationDate.getMonth() + months);
        if (days > 0) expirationDate.setDate(expirationDate.getDate() + days);

        // Generate a unique token ID
        const tokenId = crypto.randomBytes(16).toString('hex');

        // Insert or update the token in the database
        const { error: tokenError } = await supabase
            .from('subscription_tokens')
            .upsert({
                token_id: tokenId,
                user_auth_id: authId,
                subscription_level: subscriptionLevel,
                expiration_date: expirationDate.toISOString(),
                bot_limit: subscriptionLevel === 'trier' ? 1 : null // Add bot_limit for trier
            }, { onConflict: ['user_auth_id'] });

        if (tokenError) {
            throw new Error(tokenError.message);
        }

        // Update the user's subscription status
        const { error: updateError } = await supabase
            .from('user_auth')
            .update({ subscription_status: subscriptionLevel })
            .eq('auth_id', authId);

        if (updateError) {
            throw new Error(updateError.message);
        }

        // Send the token to the user's notifications
        await addNotification(
            `Your new subscription token: ${tokenId}. Expires on ${expirationDate.toISOString()}`,
            authId,
            'Admin'
        );
        console.log(`🔔 Notification sent to user ${authId} about new token.`);

        res.status(200).json({ success: true, message: 'Token generated successfully.', tokenId, expirationDate: expirationDate.toISOString() });
    } catch (error) {
        console.error('❌ Error generating token:', error.message);
        res.status(500).json({ success: false, message: 'Failed to generate token.' });
    }
});
const validateToken = async (req, res, next) => {
    const { authId, tokenId } = req.body;

    if (!authId || !tokenId) {
        return res.status(400).json({ success: false, message: 'Auth ID and token ID are required.' });
    }

    try {
        const { data: token, error } = await supabase
            .from('subscription_tokens')
            .select('*')
            .eq('user_auth_id', authId)
            .eq('token_id', tokenId)
            .single();

        if (error || !token) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
        }

        const now = new Date();
        if (new Date(token.expiration_date) < now) {
            return res.status(401).json({ success: false, message: 'Token has expired.' });
        }

        next();
    } catch (error) {
        console.error('❌ Error validating token:', error.message);
        res.status(500).json({ success: false, message: 'Failed to validate token.' });
    }
};

const deleteExpiredBots = async () => {
    try {
        const now = new Date().toISOString();

        // Fetch expired tokens
        const { data: expiredTokens, error } = await supabase
            .from('subscription_tokens')
            .select('user_auth_id')
            .lt('expiration_date', now);

        if (error) {
            throw new Error(error.message);
        }

        for (const token of expiredTokens) {
            const { user_auth_id: authId } = token;

            // Delete bots associated with the expired token
            const { data: users } = await supabase
                .from('users')
                .select('user_id')
                .eq('auth_id', authId);

            for (const user of users) {
                await deleteUserData(user.user_id);
            }

            console.log(`🗑️ Deleted bots for expired token: ${authId}`);
        }
    } catch (error) {
        console.error('❌ Error deleting expired bots:', error.message);
    }
};


router.post('/sync-memory', async (req, res) => {
    try {
        await syncMemoryToSupabase();
        res.status(200).json({ success: true, message: 'Memory synced to Supabase.' });
    } catch (error) {
        console.error('❌ Error syncing memory to Supabase:', error.message);
        res.status(500).json({ success: false, message: 'Failed to sync memory.' });
    }
});

// Endpoint to fetch all bots/users with phoneNumber and authI


const deleteOldNotifications = async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
        .from('notifications')
        .delete()
        .lt('timestamp', threeDaysAgo);
};
// Run daily
setInterval(deleteOldNotifications, 24 * 60 * 60 * 1000);
// Schedule the task to run daily
setInterval(deleteExpiredBots, 24 * 60 * 60 * 1000); // Every 24 hours

module.exports = { router,  emitLiveMetricsToAdmin };