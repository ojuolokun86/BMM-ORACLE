const supabase = require('../supabaseClient');
const analyticsData = {}; // In-memory storage for analytics data

/**
 * Get analytics data for a user.
 * @param {string} authId - The user's auth ID.
 * @returns {Object} - Analytics data with labels and datasets.
 */
const getAnalyticsData = (authId) => {
    if (!analyticsData[authId]) {
        console.warn(`⚠️ No analytics data found for authId: ${authId}`);
        return { labels: [], commandProcessingTime: [] };
    }

    const userAnalytics = analyticsData[authId];
    return {
        labels: userAnalytics.map((entry) => entry.timestamp),
        commandProcessingTime: userAnalytics.map((entry) => entry.commandProcessingTime),
    };
};

/**
 * Add analytics data for a user.
 * @param {string} authId - The user's auth ID.
 * @param {Object} data - Analytics data to add.
 */
const addAnalyticsData = (authId, data) => {
    console.log(`📊 Adding analytics data for authId: ${authId}`, data);
    if (!analyticsData[authId]) {
        analyticsData[authId] = [];
    }

    analyticsData[authId].push(data);

    // Limit the number of entries to avoid memory overflow
    if (analyticsData[authId].length > 100) {
        analyticsData[authId].shift(); // Remove the oldest entry
    }
};

const notificationHistory = {}; // In-memory storage for notifications

/**
 * Get notification history for a user.
 * @param {string} authId - The user's auth ID.
 * @returns {Array} - Array of notification objects.
 */
const getNotificationHistory = (authId) => {
    if (!notificationHistory[authId]) {
        console.warn(`⚠️ No notification history found for authId: ${authId}`);
        return [];
    }

    return notificationHistory[authId];
};

/**
 * Add a notification for a user.
 * @param {string} authId - The user's auth ID.
 * @param {Object} notification - Notification object to add.
 */
const addNotification = (authId, notification) => {
    if (!notificationHistory[authId]) {
        notificationHistory[authId] = [];
    }

    notificationHistory[authId].push(notification);

    // Limit the number of notifications to avoid memory overflow
    if (notificationHistory[authId].length > 50) {
        notificationHistory[authId].shift(); // Remove the oldest notification
    }
};

const activityLogs = {}; // In-memory storage for activity logs

/**
 * Get activity log for a user.
 * @param {string} authId - The user's auth ID.
 * @returns {Array} - Array of activity log objects.
 */
const getActivityLog = (authId) => {
    if (!activityLogs[authId]) {
        console.warn(`⚠️ No activity log found for authId: ${authId}`);
        return [];
    }

    return activityLogs[authId];
};

/**
 * Add an activity log for a user.
 * @param {string} authId - The user's auth ID.
 * @param {Object} activity - Activity log object to add.
 */
const addActivityLog = (authId, activity) => {
    if (!activityLogs[authId]) {
        activityLogs[authId] = [];
    }

    activityLogs[authId].push(activity);


    // Limit the number of activity logs to avoid memory overflow
    if (activityLogs[authId].length > 10) {
        activityLogs[authId].shift(); // Remove the oldest activity
    }
};

const userData = {}; // In-memory storage for user data
const botData = {}; // In-memory storage for bot data

//const userData = {}; // In-memory storage for user data

/**
 * Get user summary.
 * @param {string} authId - The user's auth ID.
 * @returns {Object} - User summary with username, total bots, and active bots.
 */
const getUserSummary = async (authId) => {
    try {
        // Fetch user email from Supabase
        const { data: user, error: userError } = await supabase
            .from('user_auth') // Replace 'user_auth' with your actual table name
            .select('email')
            .eq('auth_id', authId)
            .single();

        if (userError) {
            console.error('❌ Error fetching user email from Supabase:', userError.message);
            throw new Error('Failed to fetch user email.');
        }

        const email = user?.email || 'unknown@example.com';

        const bots = botData[authId] || [];

        const totalBots = bots.length;
        const activeBots = bots.filter((bot) => bot.status === 'Active').length;

        return { email, totalBots, activeBots };
    } catch (error) {
        console.error('❌ Error in getUserSummary:', error.message);
        throw error;
    }
};
/**
 * Add or update user data.
 * @param {string} authId - The user's auth ID.
 * @param {Object} data - User data to add or update.
 */
const addUserData = (authId, data) => {
    userData[authId] = data;
};

/**
 * Add or update bot data for a user.
 * @param {string} authId - The user's auth ID.
 * @param {Array} bots - Array of bot objects to add or update.
 */
const addBotData = (authId, bots) => {

    botData[authId] = bots;
};

module.exports = {
    getAnalyticsData,
    addAnalyticsData,
    getNotificationHistory,
    addNotification,
    getActivityLog,
    addActivityLog,
    getUserSummary,
    addUserData,
    addBotData,
    userData,
    botData,
};