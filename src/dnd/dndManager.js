const supabase = require('../supabaseClient'); // Adjust path as needed

const dndCache = new Map(); // key: userId or groupId

const DND_MODES = {
    OFF_ALL: 'off_all',
    ON_ALL: 'on_all',
    VOICE_ONLY: 'voice_only',
    VIDEO_ONLY: 'video_only',
    CONTACTS_ONLY: 'contacts_only',
};

// Fetch DND settings from DB
async function fetchDndSettingsFromDb(id) {
    const { data, error } = await supabase
        .from('dnd_settings')
        .select('mode, whitelist, blacklist, contacts_only')
        .eq('owner_id', id)
        .single();

    if (error || !data) {
        // Default settings if not found
        return {
            mode: DND_MODES.OFF_ALL,
            whitelist: [],
            blacklist: [],
            contactsOnly: false,
        };
    }
    return {
        mode: data.mode || DND_MODES.OFF_ALL,
        whitelist: data.whitelist || [],
        blacklist: data.blacklist || [],
        contactsOnly: !!data.contacts_only,
    };
}

// Save DND settings to DB
async function saveDndSettingsToDb(id, settings) {
    const { error } = await supabase
        .from('dnd_settings')
        .upsert(
            {
                owner_id: id,
                mode: settings.mode,
                whitelist: settings.whitelist,
                blacklist: settings.blacklist,
                contacts_only: settings.contactsOnly,
            },
            { onConflict: ['owner_id'] }
        );
    if (error) {
        console.error('❌ Failed to save DND settings to DB:', error);
    }
}

async function getDndSettingsCached(id) {
    const cached = dndCache.get(id);
    if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000)) return cached.data;
    const data = await fetchDndSettingsFromDb(id);
    dndCache.set(id, { data, timestamp: Date.now() });
    return data;
}

async function setDndMode(id, mode) {
    const settings = await getDndSettingsCached(id);
    settings.mode = mode;
    await saveDndSettingsToDb(id, settings);
    dndCache.set(id, { data: settings, timestamp: Date.now() });
}

async function addToWhitelist(id, userJid) {
    const settings = await getDndSettingsCached(id);
    if (!settings.whitelist.includes(userJid)) settings.whitelist.push(userJid);
    await saveDndSettingsToDb(id, settings);
    dndCache.set(id, { data: settings, timestamp: Date.now() });
}

async function removeFromWhitelist(id, userJid) {
    const settings = await getDndSettingsCached(id);
    settings.whitelist = settings.whitelist.filter(jid => jid !== userJid);
    await saveDndSettingsToDb(id, settings);
    dndCache.set(id, { data: settings, timestamp: Date.now() });
}

async function addToBlacklist(id, userJid) {
    const settings = await getDndSettingsCached(id);
    if (!settings.blacklist.includes(userJid)) settings.blacklist.push(userJid);
    await saveDndSettingsToDb(id, settings);
    dndCache.set(id, { data: settings, timestamp: Date.now() });
}

async function removeFromBlacklist(id, userJid) {
    const settings = await getDndSettingsCached(id);
    settings.blacklist = settings.blacklist.filter(jid => jid !== userJid);
    await saveDndSettingsToDb(id, settings);
    dndCache.set(id, { data: settings, timestamp: Date.now() });
}

async function setContactsOnly(id, enabled) {
    const settings = await getDndSettingsCached(id);
    settings.contactsOnly = enabled;
    await saveDndSettingsToDb(id, settings);
    dndCache.set(id, { data: settings, timestamp: Date.now() });
}

// Dummy contacts check (replace with your real logic)
async function isContact(ownerId, callerJid) {
    // TODO: Implement real contact check
    return true;
}

async function isCallAllowed(id, callerJid, callType) {
    const settings = await getDndSettingsCached(id);

    // If DND is OFF, allow all calls
    if (settings.mode === DND_MODES.OFF_ALL) return true;

    // If DND is ON, only allow whitelisted users
    if (settings.mode === DND_MODES.ON_ALL) {
        return settings.whitelist.includes(callerJid);
    }

    // If DND is VOICE_ONLY, block voice calls except for whitelist
    if (settings.mode === DND_MODES.VOICE_ONLY && callType === 'voice') {
        return settings.whitelist.includes(callerJid);
    }

    // If DND is VIDEO_ONLY, block video calls except for whitelist
    if (settings.mode === DND_MODES.VIDEO_ONLY && callType === 'video') {
        return settings.whitelist.includes(callerJid);
    }

    // Contacts only mode
    if (settings.mode === DND_MODES.CONTACTS_ONLY && !(await isContact(id, callerJid))) {
        return settings.whitelist.includes(callerJid);
    }

    // Whitelist always overrides blacklist
    if (settings.whitelist.includes(callerJid)) return true;
    if (settings.blacklist.includes(callerJid)) return false;

    return true;
}

module.exports = {
    DND_MODES,
    getDndSettingsCached,
    setDndMode,
    addToWhitelist,
    removeFromWhitelist,
    addToBlacklist,
    removeFromBlacklist,
    setContactsOnly,
    isCallAllowed,
};