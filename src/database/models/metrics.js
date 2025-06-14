const userMetrics = new Map(); // In-memory store for user metrics
const globalMetrics = {}; // In-memory store for global metrics (e.g., restart time)

/**
 * Update metrics for a specific user.
 * @param {string} userId - The user ID.
 * @param {Object} metrics - The metrics to update.
 * @param {string} authId - The authentication ID.
 */
const updateUserMetrics = (userId, authId, metrics) => {
    console.log(`Updating metrics for userId: ${userId}, authId: ${authId}, metrics:`, metrics);

    if (!authId) {
        console.error(`❌ authId is missing. Cannot update metrics for userId: ${userId}`);
        return;
    }

    if (!userMetrics.has(authId)) {
        userMetrics.set(authId, {}); // Initialize metrics for the authId
    }

    const userMetric = userMetrics.get(authId);
    userMetric[userId] = userMetric[userId] || {}; // Ensure metrics for the userId exist
    Object.assign(userMetric[userId], metrics); // Update metrics for the userId
    userMetrics.set(authId, userMetric);

    console.log(`✅ Metrics updated for authId: ${authId}, userId: ${userId}`);
};
/**
 * Get metrics for a specific authId.
 * @param {string} authId - The authentication ID.
 * @returns {Array} - An array of metrics for the specified authId.
 */
const getMetricsForAuthId = (authId) => {
    if (!userMetrics.has(authId)) {
        console.log(`⚠️ No metrics found for authId: ${authId}`);
        return [];
    }

    const metrics = userMetrics.get(authId);
    return Object.entries(metrics).map(([userId, userMetric]) => ({
        phoneNumber: userId, // Use userId (phone number) as the identifier
        ...userMetric,
    }));
};


/**
 * Update global metrics.
 * @param {Object} metrics - The global metrics to update.
 */
const updateGlobalMetrics = (metrics) => {
    Object.assign(globalMetrics, metrics);
};

/**
 * Get all user metrics.
 * @returns {Array} - An array of user metrics.
 */
/**
 * Get all user metrics.
 * @returns {Array} - An array of user metrics.
 */
const getAllUserMetrics = () => {
    return Array.from(userMetrics.entries()).flatMap(([authId, userMetricsMap]) => {
        return Object.entries(userMetricsMap).map(([userId, metrics]) => ({
            authId, // Include the authId
            phoneNumber: userId, // Use userId (phone number) as the identifier
            messageProcessingTime: metrics.messageProcessingTime || 'N/A',
            queueProcessingTime: metrics.queueProcessingTime || 'N/A',
            commandProcessingTime: metrics.commandProcessingTime || 'N/A',
        }));
    });
};

/**
 * Get global metrics.
 * @returns {Object} - The global metrics.
 */
const getGlobalMetrics = () => globalMetrics;


/**
 * Delete metrics for a specific user.
 * @param {string} userId - The user ID.
 */
const deleteUserMetrics = (authId) => {
    if (userMetrics.has(authId)) {
        userMetrics.delete(authId); // Remove the user's metrics from memory
        console.log(`✅ Metrics deleted for authId: ${authId}`);
    } else {
        console.log(`⚠️ No metrics found for authId: ${authId}`);
    }
};


module.exports = {
    updateUserMetrics,
    updateGlobalMetrics,
    getAllUserMetrics,
    getGlobalMetrics,
    deleteUserMetrics,
    getMetricsForAuthId,
};