//console.log = function () {};
const path = require('path');
const fs = require('fs');
const express = require('express');
const { fetchWhatsAppWebVersion } = require('./utils/AppWebVersion');
const { botInstances } = require('./utils/globalStore');
const { createServer } = require('./server/server'); // Import the server creation function
require('dotenv').config(); // Ensure dotenv is configured at the top of the file
const { startNewSession, loadAllSessions, loadAllLocalSessions } = require('./users/userSession'); // Import the function to load sessions
const { platform } = require('os');
console.log("Starting app...");
console.log("PORT =", process.env.PORT);
const { getUserPlatform} = require('./database/userDatabase') // Get the user's platform}




const MAX_RETRIES = 3; // Maximum number of retries for operations
const RETRY_DELAY = 5000; // Delay between retries in milliseconds

// Helper function to retry an async operation
const retryOperation = async (operation, description, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔄 Attempting: ${description} (Attempt ${attempt}/${retries})`);
            return await operation();
        } catch (error) {
            console.error(`❌ Error during: ${description} (Attempt ${attempt}/${retries})`, error);

            if (attempt < retries) {
                console.log(`⏳ Retrying in 5 seconds...`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            } else {
                console.error(`❌ Maximum retries reached for: ${description}`);
                throw error;
            }
        }
    }
};

process.on('unhandledRejection', async (err) => {
    console.error('❌ Unhandled Promise Rejection:', err);
    
    await healSessionForError(err, 'global trap');
});

process.on('uncaughtException', async (err) => {
    console.error('🔥 Uncaught Exception:', err);

    await healSessionForError(err, 'uncaught exception');
});

async function healSessionForError(err, context = 'global') {
    const msg = err?.message || '';
    if (!msg.includes('SessionError: No open session')) return;

    const userId = extractUserIdFromError(err);
    console.log(`[${context}] Extracted userId:`, userId);
    

    if (userId) {
        try {
            const { getUserCached } = require('./database/userDatabase');
            const user = await getUserCached(userId);
            const authId = user?.auth_id;
            if (authId) {
                const { healAndRestartBot } = require('./utils/sessionFixer');
                console.warn(`⚠️ Healing session for ${userId} via ${context}`);
                await healAndRestartBot(userId, authId);
            } else {
                console.warn(`⚠️ No authId found for user ${userId}`);
            }
        } catch (e) {
            console.error(`❌ Failed to heal session for ${userId}:`, e);
        }
    } else {
        console.warn(`[${context}] Could not extract userId from SessionError`);
    }
}

function extractUserIdFromError(err) {
    const msg = err?.message || '';
    const stack = err?.stack || '';
    // Try to extract userId robustly
    const jidMatch = stack.match(/(\d+)@s\.whatsapp\.net/) || msg.match(/(\d+)@s\.whatsapp\.net/);
    return jidMatch ? jidMatch[1] : null;
}

(async () => {
    try {
        // Start the server first
        console.log('🚀 Starting the server...');
        createServer(); // Call the server creation function
        console.log('✅ Server started successfully.');

        // Fetch the latest WhatsApp Web version
        const version = await fetchWhatsAppWebVersion('whiskeysockets');
        console.log(`✅ Using WhatsApp Web version: ${version}`);

        // Load existing user sessions
        const sessions = await retryOperation(async () => {
            const loadedSessions = await loadAllSessions(); // Ensure this is awaited
            return loadedSessions;
        }, 'Loading user sessions');

        console.log(`✅ All user sessions initialized.`);
    } catch (error) {
        console.error('❌ Fatal error during bot initialization:', error);
        process.exit(1); // Exit the process if initialization fails
    }
})();