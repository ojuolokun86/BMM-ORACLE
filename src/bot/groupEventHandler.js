const { updateGroupModeOnAction } = require('../bot/groupModeManager'); // Import the function

module.exports = async (sock, groupId, userId) => {
    if (!groupId) {
        console.error(`❌ Group ID is undefined. Cannot update group mode for user ${userId}.`);
        return;
    }

    try {
        // Update the group mode when a user joins a new group
        await updateGroupModeOnAction(userId, groupId);
        console.log(`✅ Group mode for user ${userId} in group ${groupId} updated to "me".`);
    } catch (error) {
        console.error(`❌ Failed to update group mode for user ${userId} in group ${groupId}:`, error);
    }
};