const fs = require('fs');
const path = require('path');
const supabase = require('../supabaseClient'); // Import Supabase client
const BOT_NUMBERS_DIR = path.join(__dirname, '..', '..', 'bot_number'); // Path to bot_number folder
const { pendingUsernameRequests, botInstances } = require('../utils/globalStore'); // Import pending requests
const env = require('../utils/loadEnv'); // Import environment variables
const ADMIN_NUMBER = env.ADMIN_NUMBER; // Load the admin number from .env



/**
 * Handles user replies to the bot.
 * @param {object} sock - The bot instance for the user.
 * @param {object} message - The incoming message object.
 */
const handleUserReply = async (sock, message) => {
    const userId = message.key.remoteJid.split('@')[0]; // Extract the user's ID
    const messageType = Object.keys(message.message || {})[0]; // Get the message type
    console.log(`🔍 Entering handleUserReply for user ${userId} with message type: "${messageType}"`);

    // Extract the user's reply from either `conversation` or `extendedTextMessage`
    const userReply =
        message.message?.conversation?.trim() ||
        message.message?.extendedTextMessage?.text?.trim();
    console.log(`🔍 User reply for user ${userId}: "${userReply}"`);


    // Retrieve the admin socket instance
    const adminSock = botInstances[ADMIN_NUMBER];
    if (!adminSock) {
        console.error(`❌ Admin socket instance not found. Cannot handle reply for user ${userId}.`);
        return;
    }

    if (!userReply) {
        console.log(`⚠️ No reply received from user ${userId}.`);
        return;
    }


    // Check if the user is in the pending username requests
    if (!pendingUsernameRequests.has(userId)) {
        console.log(`ℹ️ Ignoring reply from user ${userId} as no username request is pending.`);
        return;
    }

    console.log(`✅ Received username from user ${userId}: ${userReply}`);

    // Path to the user's file in the bot_number folder
    const userFilePath = path.join(BOT_NUMBERS_DIR, `${userId}.txt`);

    // Check if the user's file exists
    if (!fs.existsSync(userFilePath)) {
        console.error(`❌ User file not found for user ${userId}.`);
        await adminSock.sendMessage(`${userId}@s.whatsapp.net`, {
            text: `❌ Your user file is missing. Please contact support.`,
        });
        return;
    }

    // Read the user's file
    const fileContent = fs.readFileSync(userFilePath, 'utf-8');
    console.log(`📄 Current file content for user ${userId}:\n${fileContent}`);

    // Check if the username already exists in the file
    if (fileContent.includes('Username:')) {
        console.log(`ℹ️ Username already exists for user ${userId}. Skipping update.`);
        await adminSock.sendMessage(`${userId}@s.whatsapp.net`, {
            text: `ℹ️ Your username is already set. No changes were made.`,
        });
        pendingUsernameRequests.delete(userId); // Remove the user from pending requests
        return;
    }

    // Append the username to the file
    const updatedContent = `${fileContent.trim()}\nUsername: ${userReply}\n`;
    fs.writeFileSync(userFilePath, updatedContent);
    console.log(`✅ Username for user ${userId} added to file: ${userFilePath}`);

    // Update the username in Supabase
    try {
        await supabase
            .from('users')
            .update({ username: userReply })
            .eq('user_id', userId);
        console.log(`✅ Username for user ${userId} updated in Supabase.`);
    } catch (error) {
        console.error(`❌ Failed to update username for user ${userId} in Supabase. Rolling back local changes.`, error);

        // Rollback: Remove the username from the local file
        fs.writeFileSync(userFilePath, fileContent);
        console.log(`🔄 Rolled back local changes for user ${userId}.`);
        await adminSock.sendMessage(`${userId}@s.whatsapp.net`, {
            text: `❌ Failed to save your username. Please try again later.`,
        });
        return;
    }

    // Send a confirmation message to the user
    await adminSock.sendMessage(`${userId}@s.whatsapp.net`, {
        text: `Thank you, ${userReply}! Your username has been saved.`,
    });

    // Remove the user from the pending username requests
    pendingUsernameRequests.delete(userId);
    console.log(`✅ User ${userId} removed from pending username requests.`);
};

/**
 * Add a user to the pending username requests.
 * @param {string} userId - The user's ID.
 */
const addPendingUsernameRequest = (userId) => {
    pendingUsernameRequests.add(userId);
    console.log(`✅ User ${userId} added to pending username requests.`);
};

module.exports = { handleUserReply, addPendingUsernameRequest, pendingUsernameRequests };