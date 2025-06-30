const express = require('express');
const router = express.Router();
const { listSessionsFromMemory } = require('../database/models/memory');
const { restartUserBot } = require('../bot/restartBot');
const { deleteUserData } = require('../database/userDatabase');
const supabase = require('../supabaseClient');
const { getUserSessionsMemoryUsage, getSessionMemoryUsage,getUptime, getUserTotalROM, getVersion, getLastActive } = require('../database/models/memory'); // Import memory functions
const { getSocketInstance, userSockets } = require('./socket'); // Import the WebSocket instance getter
const { getAllUserMetrics, getMetricsForAuthId } = require('../database/models/metrics'); // Import metrics functions
const { getNotificationHistory, addNotification, getUserSummary, addUserData, addBotData, userData, getAnalyticsData, getActivityLog, } = require('./info'); // Import userData
const { addComplaint } = require('../database/complaint'); // Import complaint functions
const { getNotifications } = require('../database/notification'); // Import notification functions
const {useSupabaseAuthState } = require('../database/hybridAuthState');
const QRCode = require('qrcode');
const { loadSessionFromSupabase } = require('../database/models/supabaseAuthState');
const { startNewSession } = require('../users/userSession');
// Route: Get User Summary
router.get('/summary', async (req, res) => {
    const { authId } = req.query;

    if (!authId) {
        return res.status(400).json({ success: false, message: 'authId is required.' });
    }

    try {
        const summary = await getUserSummary(authId); // Fetch user summary
        const email = userData[authId]?.email || 'unknown@example.com'; // Retrieve email from userData
        res.status(200).json({ success: true, email, ...summary });
    } catch (error) {
        console.error('❌ Error fetching user summary:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch user summary.' });
    }
});

router.post('/load-session/:phoneNumber', async (req, res) => {
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
// Route: Get Analytics Data
router.get('/analytics', (req, res) => {
    const { authId } = req.query;

    console.log(`📥 Received request for analytics with authId: ${authId}`);

    if (!authId) {
        return res.status(400).json({ success: false, message: 'authId is required.' });
    }

    try {
        const analytics = getAnalyticsData(authId); // Fetch analytics data from in-memory storage
        res.status(200).json({ success: true, analytics });
    } catch (error) {
        console.error('❌ Error fetching analytics data:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics data.' });
    }
});

// Route: Get Notification History
router.get('/notifications', async (req, res) => {
    const { authId } = req.query;
    console.log(`📥 Received request for notifications with authId: ${authId}`);

    if (!authId) {
        return res.status(400).json({ success: false, message: 'authId is required.' });
    }

    try {
        const notifications = await getNotifications(authId || null); // Fetch notifications from the database
        res.status(200).json({ success: true, notifications });
    } catch (error) {
        console.error('❌ Error fetching notifications:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
    }
});

router.get('/notifications/:authId', async (req, res) => {
    const { authId } = req.params;

    try {
        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('target_auth_id', authId)
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('❌ Error fetching notifications:', error.message);
            return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
        }

        res.status(200).json({ success: true, notifications });
    } catch (error) {
        console.error('❌ Error fetching notifications:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
    }
});

// Route: Get Activity Log
router.get('/activity-log', (req, res) => {
    const { authId } = req.query;

    console.log(`📥 Received request for activity log with authId: ${authId}`);

    if (!authId) {
        return res.status(400).json({ success: false, message: 'authId is required.' });
    }

    try {
        const activities = getActivityLog(authId); // Fetch activity log from in-memory storage
        res.status(200).json({ success: true, activities });
    } catch (error) {
        console.error('❌ Error fetching activity log:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch activity log.' });
    }
});


router.get('/bot-info', async (req, res) => {
    const { authId } = req.query;
    const { botInstances } = require('../utils/globalStore');

    console.log(`📥 Received request to fetch bot info for authId: ${authId}`); // Debug log

    if (!authId) {
        console.error('❌ authId is missing in the request.');
        return res.status(400).json({ success: false, message: 'authId is required.' });
    }

    try {
        // Step 1: Check if the user exists in the user_auth table
        const { data: userAuth, error: userAuthError } = await supabase
            .from('user_auth')
            .select('*')
            .eq('auth_id', authId);

        if (userAuthError) {
            console.error('❌ Error fetching user from user_auth table:', userAuthError.message);
            return res.status(500).json({ success: false, message: 'Failed to fetch user.' });
        }

        if (!userAuth || userAuth.length === 0) {
            console.log('ℹ️ No user found for this authId.');
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Step 2: Fetch all phone numbers (user_id) associated with the authId from the users table
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('user_id')
            .eq('auth_id', authId);

        if (usersError) {
            console.error('❌ Error fetching users from users table:', usersError.message);
            throw new Error(usersError.message);
        }

        if (!users || users.length === 0) {
            return res.status(200).json({ success: true, message: 'No bots registered yet.', bots: [] });
        }

        const phoneNumbers = users.map((user) => user.user_id);

        // Step 3: Build bot info using Supabase and in-memory botInstances for status
        const totalROM = getUserTotalROM(authId); // Calculate ROM for this user

        const botsWithDetails = phoneNumbers.map((phoneNumber) => {
            const instance = botInstances[phoneNumber];
            const isActive = instance && instance.sock && instance.sock.ws && instance.sock.ws.readyState === 1;
            return {
                phoneNumber,
                authId,
                status: isActive ? 'Active' : 'Inactive',
                rom: `${totalROM} MB`, // ROM for all bots of this user
                uptime: getUptime(phoneNumber),
                lastActive: getLastActive(phoneNumber),
                version: getVersion(),
            };
        });

        addBotData(authId, botsWithDetails); // Store bot data in memory if needed
        console.log(`📊 Fetched ${botsWithDetails.length} bot(s) for authId: ${authId}`); // Debug log

        res.status(200).json({ success: true, bots: botsWithDetails });
    } catch (error) {
        console.error('❌ Error fetching bot info:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch bot info.', error: error.message });
    }
});
// Restart a bot for the logged-in user
router.post('/restart-bot/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    const { authId } = req.body;

    try {
        // Check session in Supabase
        const session = await loadSessionFromSupabase(phoneNumber);
        if (!session || String(session.creds?.authId) !== String(authId)) {
            return res.status(404).json({ success: false, message: 'Bot/session not found for this user.' });
        }

        const success = await restartUserBot(phoneNumber, phoneNumber + '@s.whatsapp.net', authId);
        if (success) {
            res.status(200).json({ success: true, message: `Bot restarted successfully for ${phoneNumber}.` });
        } else {
            res.status(500).json({ success: false, message: 'Failed to restart bot.' });
        }
    } catch (error) {
        console.error('❌ Error restarting bot:', error.message);
        res.status(500).json({ success: false, message: 'Failed to restart bot.', error: error.message });
    }
});

// Delete a bot for the logged-in user
router.delete('/delete-bot/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    const { authId } = req.body;

    try {
        // Check session in Supabase
        const session = await loadSessionFromSupabase(phoneNumber);
        if (!session || String(session.creds?.authId) !== String(authId)) {
            return res.status(404).json({ success: false, message: 'Bot/session not found for this user.' });
        }

        await deleteUserData(phoneNumber);
        res.status(200).json({ success: true, message: `Bot deleted successfully for ${phoneNumber}.` });
    } catch (error) {
        console.error('❌ Error deleting bot:', error.message);
        res.status(500).json({ success: false, message: 'Failed to delete bot.', error: error.message });
    }
});


router.post('/submit-complaint', async (req, res) => {
    const { authId, message } = req.body;

    if (!authId || !message) {
        return res.status(400).json({ success: false, message: 'Auth ID and message are required.' });
    }

    try {
        await addComplaint(authId, message); // Add the complaint to the database
        res.status(200).json({ success: true, message: 'Complaint submitted successfully.' });
    } catch (error) {
        console.error('❌ Error submitting complaint:', error.message);
        res.status(500).json({ success: false, message: 'Failed to submit complaint.' });
    }
});
router.post('/request-account-deletion', async (req, res) => {
    const { authId } = req.body;

    if (!authId) {
        return res.status(400).json({ success: false, message: 'Auth ID is required.' });
    }

    try {
        // Save the deletion request as a complaint for admin visibility
        await addComplaint(authId, '[Account Deletion Request] User requested account deletion.');

        // Notify the admin via socket (optional, for real-time)
        const io = require('./socket').getSocketInstance();
        io.emit('account-deletion-request', { authId });

        res.status(200).json({ success: true, message: 'Account deletion request submitted successfully.' });
    } catch (error) {
        console.error('❌ Error submitting account deletion request:', error.message);
        res.status(500).json({ success: false, message: 'Failed to submit account deletion request.' });
    }
});

router.get('/rescan-qr/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;

    try {
        const { state } = await useSupabaseAuthState(phoneNumber);

        // Check if QR is available and is a string
        if (!state.creds.qr || typeof state.creds.qr !== 'string') {
            return res.status(400).json({ success: false, message: 'QR code not available. The session may already be authenticated or not initialized yet.' });
        }

        const qrCode = await new Promise((resolve, reject) => {
            QRCode.toDataURL(state.creds.qr, (err, url) => {
                if (err) reject(err);
                resolve(url);
            });
        });

        res.status(200).json({ success: true, qrCode });
    } catch (error) {
        console.error(`❌ Error fetching QR code for ${phoneNumber}:`, error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch QR code.' });
    }
});

router.delete('/notifications/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('❌ Error deleting notification:', error.message);
            return res.status(500).json({ success: false, message: 'Failed to delete notification.' });
        }

        res.status(200).json({ success: true, message: 'Notification deleted successfully.' });
    } catch (error) {
        console.error('❌ Error deleting notification:', error.message);
        res.status(500).json({ success: false, message: 'Failed to delete notification.' });
    }
});

router.get('/subscription', async (req, res) => {
    const { authId } = req.query;
    console.log(`📥 Received request for subscription details with authId: ${authId}`);
    if (!authId) {
        return res.status(400).json({ success: false, message: 'authId is required.' });
    }
    try {
        const { data: token, error } = await supabase
            .from('subscription_tokens')
            .select('subscription_level, expiration_date')
            .eq('user_auth_id', authId)
            .single();

        if (error || !token) {
            return res.status(404).json({ success: false, message: 'No subscription found.' });
        }
      
            
        

        // Calculate days left
        const expiration = new Date(token.expiration_date);
        const now = new Date();
        const daysLeft = Math.max(0, Math.ceil((expiration - now) / (1000 * 60 * 60 * 24)));

        res.status(200).json({
            success: true,
            subscriptionLevel: token.subscription_level,
            daysLeft,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch subscription details.' });
    }
});

router.post('/notifications', async (req, res) => {
    const { message, authId } = req.body;
    if (!message || !authId) {
        return res.status(400).json({ success: false, message: 'Message and authId are required.' });
    }
    try {
        await addNotification(message, authId, 'User');
        res.status(200).json({ success: true, message: 'Notification sent.' });
    } catch (error) {
        console.error('❌ Error sending notification:', error.message);
        res.status(500).json({ success: false, message: 'Failed to send notification.' });
    }
});

router.post('/notifications/:notificationId/mark-read', async (req, res) => {
    const { notificationId } = req.params;
    const { authId } = req.body;

    if (!notificationId || !authId) {
        return res.status(400).json({ success: false, message: 'Notification ID and Auth ID are required.' });
    }

    try {
        // Insert into notification_reads
        const { error } = await supabase
            .from('notification_reads')
            .insert([{ notification_id: notificationId, auth_id: authId }]);

        if (error) {
            throw new Error(error.message);
        }

        res.status(200).json({ success: true, message: 'Notification marked as read.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
    }
});

module.exports = { router };