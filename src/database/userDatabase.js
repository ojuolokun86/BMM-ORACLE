const supabase = require('../supabaseClient');
const path = require('path');
const fs = require('fs');
const { deleteSessionFromSupabase, listSessionsFromSupabase } = require('./models/supabaseAuthState'); // MongoDB session handlers
const sessionsDir = path.join(__dirname, '../../sessions');
const { botInstances } = require('../utils/globalStore'); // Import the bot instances
const { deleteUserMetrics } = require('./models/metrics'); // Import the in-memory metrics map
const { sessionTimers } = require('../utils/globalStore'); // Import your timers map
const globalStore = require('../utils/globalStore');
const { subscriptionLevelCache, userCache, groupModeCache, groupOnlyModeCache, statusSettingsCache} = require('../utils/settingsCache');
const { deleteSessionFromSQLite,} = require('./models/sqliteAuthState'); // SQLite session handlers

/**
 * Add or update a user in the `users` table in Supabase.
 * @param {string} userId - The user's ID (phone number).
 * @param {string} name - The user's name.
 * @param {string} lid - The user's WhatsApp LID.
 * @param {string} id - The user's WhatsApp ID.
 * @param {string} dateCreated - The date the user was created.
 * @returns {Promise<void>}
 */
const addUser = async (userId, name, lid, id, dateCreated, authId, platform) => {
    const normalizedLid = lid ? lid.split('@')[0].split(':')[0] : 'N/A'; // Normalize the LID
    const normalizedId = id ? id.split('@')[0].split(':')[0] : 'N/A';   // Normalize the ID

    try {
        // Check if the user already exists
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('user_id, is_first_time')
            .eq('user_id', userId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error(`❌ Error checking existing user ${userId}:`, fetchError);
            throw fetchError;
        }

        if (existingUser) {
            console.log(`⚠️ User ${userId} already exists in the database. Skipping is_first_time reset.`);
        }

        // Upsert the user, but only set is_first_time to true for new users
        const { error } = await supabase
            .from('users')
            .upsert(
                {
                    user_id: userId,
                    name: name || 'Unknown', // Default to 'Unknown' if name is not provided
                    lid: normalizedLid,
                    id: normalizedId,
                    date_created: dateCreated || new Date().toISOString(),
                    is_first_time: existingUser ? existingUser.is_first_time : false, // Preserve existing value
                    auth_id: authId || null, // Optional auth_id
                    platform: platform || 'Linux', // Optional platform
                },
                { onConflict: ['user_id'] } // Update if the user already exists
            );

        if (error) {
            console.error(`❌ Error saving user ${userId} to the database:`, error);
            throw error;
        }

            if (!error) {
            // Fetch the updated user and update the cache
            const updatedUser = await getUser(userId);
            if (updatedUser) userCache.set(userId, { data: updatedUser, timestamp: Date.now() });
        }

        console.log(`✅ User ${userId} saved to the database.`);
    } catch (error) {
        console.error(`❌ Unexpected error saving user ${userId} to the database:`, error);
        throw error;
    }
};

const getUserPlatform = async (phoneNumber) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('platform')
            .eq('user_id', phoneNumber)
            .single();

        if (error) {
            console.error(`❌ Error fetching platform for user ${phoneNumber}:`, error);
            return 'Linux'; // Default to 'Linux' if not found
        }
        console.log(`✅ Platform for user ${phoneNumber} is ${data?.platform || 'Linux'}.`);
        return data?.platform || 'Linux'; // Return the platform or default to 'Linux'
        
    } catch (error) {
        console.error(`❌ Unexpected error fetching platform for user ${phoneNumber}:`, error);
        return 'Linux'; // Default to 'Linux' in case of an error
    }
}

/**
 * Get the user ID from the database.
 * @param {string} userId - The user's ID (phone number).
 * @param {string} lid - The user's WhatsApp LID.
 * @param {string} id - The user's WhatsApp ID.
 * @param {string} authId - The user's Auth ID.
 * @returns {Promise<string|null>} - The user ID if found, or null.
 */
const getUser = async (userId, lid, id, authId) => {
    console.log(`🔍 Fetching user ${userId} from the database...`);

    if (!userId) {
        console.error(`❌ Invalid userId: ${userId}. Cannot fetch user.`);
        return null;
    }

    try {
        // Build the query dynamically to exclude undefined or null values
        let query = supabase.from('users').select('*').eq('user_id', userId);

        if (lid) {
            query = query.eq('lid', lid);
        }
        if (id) {
            query = query.eq('id', id);
        }
        if (authId) {
            query = query.eq('auth_id', authId);
        }

        const { data, error } = await query.single();

       if (error && error.code === 'PGRST116') {
            console.log(`⚠️ User ${userId} not found in the database.`);
            return null;
        }

        if (!data) {
            console.log(`⚠️ User ${userId} not found in the database.`);
            return null;
        }
        return data;
    } catch (error) {
        console.error(`❌ Unexpected error fetching user ${userId}:`, error);
        return null;
    }
};
/**
 * Get all users from the `users` table in Supabase.
 * @returns {Promise<object[]>} - A list of all users.
 */
const getAllUsers = async () => {
   const normalizedUserId = normalizeUserId(userId); // Normalize userId
   
       const { data, error } = await supabase
           .from('users')
           .select('*')
           .eq('user_id', normalizedUserId)
           .single();
   
       if (error && error.code !== 'PGRST116') {
           console.error(`❌ Error fetching user from users table for user ID ${normalizedUserId}:`, error);
           throw error;
       }
   
       if (!data) {
           console.log(`⚠️ User with ID ${normalizedUserId} not found in users table.`);
           return null;
       }
       return data;
   };

/**
 * Delete a user from the database.
 * @param {string} userId - The user's ID to delete.
 * @returns {Promise<object>} - The result of the database operation.
 */
const deleteUser = async (userId) => {

    userCache.delete(userId);
    console.log(`🗑️ Deleting user ${userId} from the database...`);
    const { data, error } = await supabase
        .from('users') // Replace 'users' with your actual table name
        .delete()
        .eq('user_id', userId);

    if (error) {
        console.error('Error deleting user from database:', error);
        throw error;
    }

    console.log('User deleted from database successfully:', data);
    return data;
};

const getGroupModeFromDatabase = async (userId, groupId) => {
    try {
        const { data, error } = await supabase
            .from('group_modes')
            .select('mode')
            .eq('user_id', userId)
            .eq('group_id', groupId)
            .single(); // Expect a single row

        if (error && error.code === 'PGRST116') {
            console.log(`⚠️ No group mode found for user ${userId} in group ${groupId}.`);
            return null; // Return null if no mode exists
        }

        if (error) {
            console.error(`❌ Error fetching group mode for user ${userId} in group ${groupId}:`, error);
            throw error;
        }
    } catch (error) {
        console.error(`❌ Unexpected error fetching group mode for user ${userId} in group ${groupId}:`, error);
        return null; // Return null in case of an unexpected error
    }
};
/**
 * Save the group mode for a user-group combination in the `group_modes` table in Supabase.
 * If the combination does not exist, it will be inserted with the default mode.
 * @param {string} userId - The user's ID.
 * @param {string} groupId - The group ID.
 * @param {string} mode - The group mode to save.
 * @returns {Promise<void>}
 */
const saveGroupMode = async (userId, groupId, mode) => {
    if (!userId || !groupId) {
        console.error(`❌ Invalid userId (${userId}) or groupId (${groupId}). Cannot save group mode.`);
        return;
    }

    try {
        // Check if the combination already exists
        const { data: existingMode, error: fetchError } = await supabase
            .from('group_modes')
            .select('user_id, group_id')
            .eq('user_id', userId)
            .eq('group_id', groupId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error(`❌ Error checking existing group mode for user ${userId} in group ${groupId}:`, fetchError);
            throw fetchError;
        }

        if (!existingMode) {
            console.log(`⚠️ No existing group mode found for user ${userId} in group ${groupId}. Adding a new record.`);
        }

        // Insert or update the group mode
        const { error } = await supabase
            .from('group_modes')
            .upsert(
                {
                    user_id: userId,
                    group_id: groupId,
                    mode: mode || 'default', // Default mode if none is provided
                    updated_at: new Date().toISOString(),
                },
                { onConflict: ['user_id', 'group_id'] } // Reference the primary key columns
            );

        if (error) {
            console.error(`❌ Error saving group mode for user ${userId} in group ${groupId}:`, error);
            throw error;
        }

        if (!error) {
            groupModeCache.set(`${userId}:${groupId}`, { data: mode, timestamp: Date.now() });
        }

        console.log(`✅ Group mode for user ${userId} in group ${groupId} saved to database.`);
    } catch (error) {
        console.error(`❌ Failed to save group mode for user ${userId} in group ${groupId}:`, error);
        throw error;
    }
};
/**
 * Sync all users in the `users` table to the `group_modes` table with a default mode.
 * @returns {Promise<void>}
 */
const syncUsersToGroupModes = async () => {
    try {
        // Fetch all users from the `users` table
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('user_id');

        if (usersError) {
            console.error('❌ Error fetching users from Supabase:', usersError);
            throw usersError;
        }

        // Fetch all existing group modes
        const { data: groupModes, error: groupModesError } = await supabase
            .from('group_modes')
            .select('user_id');

        if (groupModesError) {
            console.error('❌ Error fetching group modes from Supabase:', groupModesError);
            throw groupModesError;
        }

        const existingUserIds = groupModes.map((groupMode) => groupMode.user_id);

        // Add missing users to the `group_modes` table with a default mode
        for (const user of users) {
            if (!existingUserIds.includes(user.user_id)) {
                await saveGroupMode(user.user_id, 'default_group', 'me'); // Default group ID placeholder
                console.log(`✅ User ${user.user_id} added to group_modes with default mode "me".`);
            }
        }
    } catch (error) {
        console.error('❌ Failed to sync users to group_modes:', error);
    }
};



/**
 * Get the tagformat setting for a user.
 * @param {string} userId - The user's ID.
 * @returns {Promise<boolean>} - The tagformat setting (true for formatted, false for plain).
 */
const getUserTagFormat = async (userId) => {
    const { data, error } = await supabase
        .from('users')
        .select('tagformat')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error(`❌ Error fetching tagformat for user ${userId}:`, error);
        throw error;
    }

    return data?.tagformat ?? true; // Default to true (formatted) if not found
};

/**
 * Update the tagformat setting for a user.
 * @param {string} userId - The user's ID.
 * @param {boolean} tagFormat - The new tagformat setting (true for formatted, false for plain).
 * @returns {Promise<void>}
 */
const updateUserTagFormat = async (userId, tagFormat) => {
    const { error } = await supabase
        .from('users')
        .update({ tagformat: tagFormat })
        .eq('user_id', userId);

    if (error) {
        console.error(`❌ Error updating tagformat for user ${userId}:`, error);
        throw error;
    }

    console.log(`✅ Tagformat for user ${userId} updated to "${tagFormat ? 'on' : 'off'}".`);
};

/**
 * Fetch a user from the `users` table by user ID.
 * @param {string} userId - The user's ID.
 * @returns {Promise<object|null>} - The user data or null if not found.
 */
const getUserFromUsersTable = async (userId) => {
    console.log(`🔍 Fetching user from users table for user ID: ${userId}...`);

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching user from users table for user ID ${userId}:`, error);
        throw error;
    }

    if (!data) {
        console.log(`⚠️ User with ID ${userId} not found in users table.`);
        return null;
    }

    console.log(`✅ User fetched from users table:`, data);
    return data;
};

/**
 * Get the status settings for a user.
 * @param {string} userId - The user's ID.
 * @returns {Promise<object>} - The user's status settings.
 */
const getUserStatusSettings = async (userId) => {
    const { data, error } = await supabase
        .from('users')
        .select('status_seen, status_react')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error(`❌ Error fetching status settings for user ${userId}:`, error);
        return { status_seen: false, status_react: false }; // Default settings
    }

    return data || { status_seen: false, status_react: false };
};

/**
 * Update the status settings for a user.
 * @param {string} userId - The user's ID.
 * @param {object} settings - The new status settings.
 * @returns {Promise<void>}
 */
const updateUserStatusSettings = async (userId, settings) => {
    const { error } = await supabase
        .from('users')
        .update(settings)
        .eq('user_id', userId);

    if (error) {
        console.error(`❌ Error updating status settings for user ${userId}:`, error);
        throw error;
    }

    console.log(`✅ Status settings for user ${userId} updated to:`, settings);
};

function getPossibleUserKeys(phoneNumber) {
    const normalized = String(phoneNumber).replace(/\D/g, '');
    return [
        normalized,
        normalized + '@s.whatsapp.net',
        normalized + '@lid',
        String(phoneNumber),
    ];
}


const deleteUserData = async (phoneNumber) => {
    const userId = phoneNumber
    try {
        console.log(`🗑️ Deleting all data for user: ${phoneNumber}`);

        // Get all possible keys for this user
        const keys = getPossibleUserKeys(phoneNumber);

        userCache.delete(userId);

        // 0. Stop and clear all timers for this user
        if (sessionTimers) {
            for (const key of keys) {
                if (sessionTimers[key]) {
                    sessionTimers[key].forEach(clearInterval);
                    delete sessionTimers[key];
                    console.log(`⏹️ Cleared session timers for user: ${key}`);
                }
            }
        }

        // 0b. Remove dynamic presence and read receipt settings
        if (globalStore.presenceSettings) {
            for (const key of keys) {
                delete globalStore.presenceSettings[key];
            }
        }
        if (globalStore.readReceiptSettings) {
            for (const key of keys) {
                delete globalStore.readReceiptSettings[key];
            }
        }

        // 0c. Mark user as deleted to ignore future messages
        if (globalStore.deletedUsers) {
            for (const key of keys) {
                globalStore.deletedUsers[key] = true;
            }
        }

        if (globalStore.deletedUsers) {
                 delete globalStore.deletedUsers[phoneNumber];
            }
            const { fullyStopSession } = require('../users/userSession');
            await fullyStopSession(phoneNumber); // Ensure the session is fully stopped
        // 1. Stop and remove the bot instance for all possible keys
        for (const key of keys) {
            if (botInstances[key]) {
                console.log(`🔄 Stopping bot instance for user: ${key}`);
                try {
                    const botInstance = botInstances[key];
                    if (botInstance.sock && botInstance.sock.ws) {
                        botInstance.disconnectReason = 'intentional';
                        await botInstance.sock.ws.close();
                        console.log(`✅ Bot instance for user ${key} stopped successfully.`);
                    } else {
                        console.warn(`⚠️ Bot instance for user ${key} does not have a valid WebSocket connection.`);
                    }
                    delete botInstances[key];
                } catch (error) {
                    console.error(`❌ Failed to stop bot instance for user ${key}:`, error.message);
                }
            } else {
                console.log(`⚠️ No active bot instance found for user: ${key}`);
            }

            // 3. Delete metrics for the user for all keys
            deleteUserMetrics(key);
            console.log(`✅ Deleted metrics for user: ${key}`);

            // 4. Delete the user's session folder (if applicable)
            const userSessionPath = path.join(sessionsDir, key);
            if (fs.existsSync(userSessionPath)) {
                fs.rmSync(userSessionPath, { recursive: true, force: true });
                console.log(`✅ Deleted session folder for user: ${key}`);
            } else {
                console.log(`⚠️ Session folder for user ${key} does not exist.`);
            }
        }

        // 5. Delete the user's session from Supabase (only needs to be done once)
        await deleteSessionFromSupabase(phoneNumber);
       
        console.log(`✅ Deleted session from Supabase for user: ${phoneNumber}`);
         await deleteSessionFromSQLite(phoneNumber); // Also delete from SQLite if applicable
         console.log(`✅ Deleted session from SQLite for user: ${phoneNumber}`);

        // 6. Delete the user's data from the `users` table in Supabase
        const { error: userError } = await supabase
            .from('users')
            .delete()
            .eq('user_id', phoneNumber);

        console.log(`✅ Deleting user ${phoneNumber} from the database.`);
        if (userError) {
            console.error(`❌ Error deleting user ${phoneNumber} from the database:`, userError);
        } else {
            console.log(`✅ Deleted user ${phoneNumber} from the database.`);
        }

        // 7. Delete the user's group modes from the `group_modes` table in Supabase
        const { error: groupModesError } = await supabase
            .from('group_modes')
            .delete()
            .eq('user_id', phoneNumber);

        if (groupModesError) {
            console.error(`❌ Error deleting group modes for user ${phoneNumber}:`, groupModesError);
        } else {
            console.log(`✅ Deleted group modes for user ${phoneNumber}.`);
        }

        console.log(`✅ All data for user ${phoneNumber} deleted successfully.`);
    } catch (error) {
        console.error(`❌ Failed to delete data for user ${phoneNumber}:`, error);
    }
};


/**
 * Delete all users and their data.
 */
const deleteAllUsers = async () => {
    try {
        console.log('🔄 Fetching all users from Supabase...');
        const sessions = await listSessionsFromSupabase(); // Fetch all sessions from Supabase

        for (const session of sessions) {
            const phoneNumber = session.phoneNumber; // Extract phoneNumber
            if (!phoneNumber) {
                console.warn('⚠️ Skipping undefined phone number.');
                continue;
            }

            console.log(`🗑️ Deleting all data for user: ${phoneNumber}`);
            await deleteUserData(phoneNumber); // Pass only the phoneNumber string
        }

        console.log('✅ All users deleted successfully.');
    } catch (error) {
        console.error('❌ Failed to delete all users:', error.message);
        throw error;
    }
};

/**
 * Get the subscription level for a user from the subscription_tokens table.
 * @param {string} authId - The user's Auth ID.
 * @returns {Promise<string>} - The subscription level ('free', 'basic', 'gold', 'premium', etc.)
 */
const getUserSubscriptionLevel = async (authId) => {
    if (!authId) return 'free';
    try {
        const { data: token, error } = await supabase
            .from('subscription_tokens')
            .select('subscription_level')
            .eq('user_auth_id', authId)
            .single();
        if (error) {
            console.error('❌ Error fetching subscription level:', error.message);
            return 'free';
        }
        return token && token.subscription_level ? token.subscription_level : 'free';
    } catch (err) {
        console.error('❌ Exception fetching subscription level:', err.message);
        return 'free';
    }
};

async function preloadCacheOnStartup() {
    try {
        // 1. Preload all users
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('*');
        if (usersError) {
            console.error('❌ Error preloading users:', usersError);
        } else if (users && Array.isArray(users)) {
            users.forEach(user => {
                userCache.set(user.user_id, { data: user, timestamp: Date.now() });
            });
            console.log(`✅ Preloaded ${users.length} users into cache.`);
        }

        // 2. Preload all group modes
         const { data: groupModes, error: groupModesError } = await supabase
            .from('group_modes')
            .select('*');
        if (groupModes && Array.isArray(groupModes)) {
            groupModes.forEach(mode => {
                groupModeCache.set(`${mode.user_id}:${mode.group_id}`, { data: mode.mode, timestamp: Date.now() });
                groupOnlyModeCache.set(mode.group_id, { data: mode.mode, timestamp: Date.now() });
            });
                console.log(`✅ Preloaded ${groupModes.length} group modes into both caches.`);
            }

        // 3. Preload all user status settings
        const { data: statusSettings, error: statusSettingsError } = await supabase
            .from('users')
            .select('user_id, status_seen, status_react');
        if (statusSettingsError) {
            console.error('❌ Error preloading status settings:', statusSettingsError);
        } else if (statusSettings && Array.isArray(statusSettings)) {
            statusSettings.forEach(row => {
                statusSettingsCache.set(row.user_id, { data: { status_seen: row.status_seen, status_react: row.status_react }, timestamp: Date.now() });
            });
            console.log(`✅ Preloaded ${statusSettings.length} user status settings into cache.`);
        }

        // 4. Preload all subscription levels
        const { data: tokens, error: tokensError } = await supabase
            .from('subscription_tokens')
            .select('user_auth_id, subscription_level');
        if (tokensError) {
            console.error('❌ Error preloading subscription tokens:', tokensError);
        } else if (tokens && Array.isArray(tokens)) {
            tokens.forEach(token => {
                subscriptionLevelCache.set(token.user_auth_id, { data: token.subscription_level, timestamp: Date.now() });
            });
            console.log(`✅ Preloaded ${tokens.length} subscription tokens into cache.`);
        }

    } catch (err) {
        console.error('❌ Error during cache preload:', err);
    }
}



async function getUserSubscriptionLevelCached(authId) {
    if (!authId) return 'free';
    const cached = subscriptionLevelCache.get(authId);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
        return cached.data;
    }
    // Fallback to DB
    try {
        const { data: token, error } = await supabase
            .from('subscription_tokens')
            .select('subscription_level')
            .eq('user_auth_id', authId)
            .single();
        if (error) {
            console.error('❌ Error fetching subscription level:', error.message);
            subscriptionLevelCache.set(authId, { data: 'free', timestamp: Date.now() });
            return 'free';
        }
        const level = token && token.subscription_level ? token.subscription_level : 'free';
        subscriptionLevelCache.set(authId, { data: level, timestamp: Date.now() });
        return level;
    } catch (err) {
        console.error('❌ Exception fetching subscription level:', err.message);
        subscriptionLevelCache.set(authId, { data: 'free', timestamp: Date.now() });
        return 'free';
    }
}

async function getUserCached(userId, lid, id, authId) {
    const cacheKey = userId;
    const cached = userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
        return cached.data;
    }
    const data = await getUser(userId, lid, id, authId);
    if (data) userCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
}

async function getGroupModeCached(userId, groupId) {
    const cacheKey = `${userId}:${groupId}`;
    const cached = groupModeCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
        return cached.data;
    }
    const mode = await getGroupModeFromDatabase(userId, groupId);
    if (mode) groupModeCache.set(cacheKey, { data: mode, timestamp: Date.now() });
    return mode;
}

async function getUserStatusSettingsCached(userId) {
    const cached = statusSettingsCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) {
        return cached.data;
    }
    const settings = await getUserStatusSettings(userId);
    statusSettingsCache.set(userId, { data: settings, timestamp: Date.now() });
    return settings;
}

async function updateUserStatusSettingsCached(userId, settings) {
    await updateUserStatusSettings(userId, settings);
    // Update cache immediately
    const merged = { ...(await getUserStatusSettingsCached(userId)), ...settings };
    statusSettingsCache.set(userId, { data: merged, timestamp: Date.now() });
}

async function preloadUserCache(userId, authId, botInstanceId) {
    try {
        // 1. User info
        const user = await getUser(userId, undefined, undefined, authId);
        if (user) userCache.set(userId, { data: user, timestamp: Date.now() });

        // 2. Status settings
        const statusSettings = await getUserStatusSettings(userId);
        statusSettingsCache.set(userId, { data: statusSettings, timestamp: Date.now() });

        // 3. Subscription level
        if (user?.auth_id) {
            const level = await getUserSubscriptionLevel(user.auth_id);
            subscriptionLevelCache.set(user.auth_id, { data: level, timestamp: Date.now() });
        }

        // 4. Group modes (for all groups this user is in)
        const { data: groupModes, error: groupModesError } = await supabase
            .from('group_modes')
            .select('*')
            .eq('user_id', userId);
        if (groupModes && Array.isArray(groupModes)) {
            for (const mode of groupModes) {
                groupModeCache.set(`${mode.user_id}:${mode.group_id}`, { data: mode.mode, timestamp: Date.now() });
                groupOnlyModeCache.set(mode.group_id, { data: mode.mode, timestamp: Date.now() });

                // Preload antilink and antidelete for each group
                const { getAntiLinkSettingsCached } = require('../message-controller/antilink');
                await getAntiLinkSettingsCached(mode.group_id, userId);

                const { getAntideleteSettingsCached } = require('../message-controller/antidelete');
                if (botInstanceId) {
                    await getAntideleteSettingsCached(mode.group_id, botInstanceId);
                }
            }
        }

        console.log(`✅ Preloaded cache for user ${userId} (and their groups) after restart.`);
    } catch (err) {
        console.error(`❌ Error preloading cache for user ${userId}:`, err);
    }
}


module.exports = {
    getUser,
    preloadUserCache,
    addUser,
    getAllUsers,
    deleteUser,
    saveGroupMode,
    getGroupModeFromDatabase,
    syncUsersToGroupModes,
    getUserTagFormat,
    updateUserTagFormat,
    getUserFromUsersTable,
    getUserStatusSettings,
    updateUserStatusSettings,
    deleteUserData,
    deleteAllUsers,
    getUserSubscriptionLevel,
    getUserPlatform,
    getUserSubscriptionLevelCached,
    getUserCached,
    getGroupModeCached,
    getUserStatusSettingsCached,
    updateUserStatusSettingsCached,
    preloadCacheOnStartup,
};
