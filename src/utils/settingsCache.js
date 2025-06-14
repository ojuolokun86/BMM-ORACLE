const antilinkCache = new Map();    // key: `${groupId}:${userLid}`
const antideleteCache = new Map();  // key: `${groupId}:${botInstanceId}`
const prefixCache = new Map();      // key: userId
const subscriptionLevelCache = new Map(); // key: authId
const formatResponseCache = new Map(); // key: userId
const userCache = new Map(); // key: userId
const groupModeCache = new Map(); // key: `${userId}:${groupId}`
const statusSettingsCache = new Map(); // key: userId

module.exports = { 
    antilinkCache, 
    antideleteCache, 
    prefixCache,
    subscriptionLevelCache,
    formatResponseCache,
    userCache,
    groupModeCache,
    statusSettingsCache,
};