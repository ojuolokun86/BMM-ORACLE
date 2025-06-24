
// Global object to store bot instances
const botInstances = {}; // Store bot instances
const antideleteSettings = {}; // Store antidelete settings for each chat
const groupMessages = {}; // In-memory store for group messages
const pendingUsernameRequests = new Set(); // Store pending username requests
const viewOnceMediaStore = {}; // Store view-once media messages
const mediaStore = new Map(); // Key: message ID, Value: media data
const deletedMessagesByBot = {}; 
const activePolls = new Map(); // Store active polls
const announcementIntervals = {}; // Store announcement intervals
const restartQueue = {}; // Queue to store restart requests
let globalPresenceType = null; // Changed from const to let
const presenceSettings = {};
const intentionalRestarts = new Set();
const antideleteStore = new Map(); // { chatId: { messageId: { content, timestamp } } }
const readReceiptSettings = {}; // Store read receipt settings for each chat
const lmSocketInstances = {}; // Store LM socket instances
const dndSettings = {};
const groupKickAllState = {}; 
const groupKickInactiveState = {};



function saveAntideleteMessage(chatId, messageId, content) {
    if (!antideleteStore.has(chatId)) antideleteStore.set(chatId, {});
    antideleteStore.get(chatId)[messageId] = { content, timestamp: Date.now() };
}

function getAntideleteMessage(chatId, messageId) {
    return antideleteStore.has(chatId) ? antideleteStore.get(chatId)[messageId] : null;
}

function deleteAntideleteMessage(chatId, messageId) {
    if (antideleteStore.has(chatId)) delete antideleteStore.get(chatId)[messageId];
}

// Cleanup messages older than 3 minutes (180000 ms)
setInterval(() => {
    const now = Date.now();
    for (const [chatId, messages] of antideleteStore.entries()) {
        for (const [msgId, { timestamp }] of Object.entries(messages)) {
            if (now - timestamp > 3 * 60 * 1000) {
                delete messages[msgId];
            }
        }
        // Remove chat if empty
        if (Object.keys(messages).length === 0) antideleteStore.delete(chatId);
    }
}, 60 * 1000); // Run every minute



// Cleanup logic for mediaStore
const MAX_MEDIA_FILES = 100; // Maximum number of files in memory
const MEDIA_EXPIRATION_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

const cleanupMediaStore = () => {
    const now = Date.now();
    let removedCount = 0;

    // Remove expired files
    for (const [messageId, mediaData] of mediaStore.entries()) {
        if (now - mediaData.timestamp > MEDIA_EXPIRATION_TIME) {
            mediaStore.delete(messageId);
            removedCount++;
        }
    }

    // If the store exceeds the maximum limit, remove the oldest files
    if (mediaStore.size > MAX_MEDIA_FILES) {
        const excessCount = mediaStore.size - MAX_MEDIA_FILES;
        const keysToRemove = Array.from(mediaStore.keys()).slice(0, excessCount);

        for (const key of keysToRemove) {
            mediaStore.delete(key);
            removedCount++;
        }
    }

    console.log(`🗑️ Cleanup completed. Removed ${removedCount} files from memory.`);
};

function saveAntideleteMessage(chatId, messageId, content) {
    if (!antideleteStore.has(chatId)) antideleteStore.set(chatId, {});
    antideleteStore.get(chatId)[messageId] = { content, timestamp: Date.now() };
}

function getAntideleteMessage(chatId, messageId) {
    return antideleteStore.has(chatId) ? antideleteStore.get(chatId)[messageId] : null;
}

function deleteAntideleteMessage(chatId, messageId) {
    if (antideleteStore.has(chatId)) delete antideleteStore.get(chatId)[messageId];
}

// Cleanup messages older than 5 minutes (300000 ms)
setInterval(() => {
    const now = Date.now();
    for (const [chatId, messages] of antideleteStore.entries()) {
        for (const [msgId, { timestamp }] of Object.entries(messages)) {
            if (now - timestamp > 5 * 60 * 1000) {
                delete messages[msgId];
            }
        }
        if (Object.keys(messages).length === 0) antideleteStore.delete(chatId);
    }
}, 60 * 1000);

// Schedule cleanup every 5 minutes
setInterval(cleanupMediaStore, 5 * 60 * 1000); // Run cleanup every 5 minutes

// Export the objects
module.exports = {
    botInstances,
    presenceSettings,
    antideleteSettings,
    groupMessages,
    pendingUsernameRequests,
    viewOnceMediaStore,
    mediaStore,
    deletedMessagesByBot, // Store deleted messages by bot
    activePolls,
    announcementIntervals,
    restartQueue,
    globalPresenceType,
    intentionalRestarts,
    saveAntideleteMessage,
    getAntideleteMessage,
    deleteAntideleteMessage,
    readReceiptSettings: {} ,
    lmSocketInstances,
    dndSettings,
    groupKickAllState,
    groupKickInactiveState,
};