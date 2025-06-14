const fs = require('fs');
const path = require('path');
const { warnUser, getWarnings } = require('../database/warning');
const { sendToChat } = require('../utils/messageUtils');
const { addNotification } = require('../database/notification');
const CRASH_CHARS = [ '\u2063', '\u200E', '\u200F', '\u202A', '\u202B', '\u202C', '\u202D', '\u202E' ];
const CRASH_MSG_THRESHOLD = 5;  
const CRASH_GROUP_THRESHOLD = 10;
const supabase = require('../supabaseClient'); // Import Supabase client

const securityStatus = new Map(); // authId => true/false

function countCrashChars(text) {
    if (!text) return 0;
    return CRASH_CHARS.reduce((sum, c) => sum + (text.split(c).length - 1), 0);
}

async function logEvent(authId, event) {
    try {
        await supabase.from('security_logs').insert([
            {
                auth_id: authId,
                event: event,
                // created_at will default to now()
            }
        ]);
    } catch (err) {
        console.error('❌ Failed to log security event to Supabase:', err.message);
    }
}

async function cleanupOldLogs() {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    try {
        await supabase
            .from('security_logs')
            .delete()
            .lt('created_at', fourDaysAgo);
    } catch (err) {
        console.error('❌ Failed to clean up old security logs:', err.message);
    }
}

async function handleMessageSecurity({ sock, message, userId, authId, subscriptionLevel, isGroup }) {
    if (!securityStatus.get(authId)) return; // Not enabled for this user

    // Only for basic/gold/premium
    if (!['basic', 'gold', 'premium'].includes(subscriptionLevel)) return;

    const sender = message.key.participant || message.key.remoteJid;
    const msgText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const crashCount = countCrashChars(msgText);

    if (crashCount > CRASH_MSG_THRESHOLD) {
        logEvent(authId, `Crash code detected from ${sender}: ${crashCount} chars`);
        await addNotification(`🚨 Crash code detected in a message from ${sender}.`, authId);

        if (!isGroup) {
            // Block sender in DM
            await sock.updateBlockStatus(sender, 'block');
            await sendToChat(sock, sender, { message: '🚫 You have been blocked for sending harmful content.' });
        } else {
            // Warn in group
            await warnUser(sender, userId, 'Crash code detected');
            const warnings = await getWarnings(sender, userId);
            await sendToChat(sock, message.key.remoteJid, {
                message: `⚠️ @${sender.split('@')[0]} sent a harmful message (${crashCount} crash chars). Warning ${warnings}/2.`,
                mentions: [sender]
            });
            if (warnings >= 2) {
                await sock.groupParticipantsUpdate(message.key.remoteJid, [sender], 'remove');
                await sendToChat(sock, message.key.remoteJid, {
                    message: `🚫 @${sender.split('@')[0]} removed for repeated crash code.`,
                    mentions: [sender]
                });
            }
        }
    }
}

async function handleGroupUpdateSecurity({ sock, groupId, userId, authId, subscriptionLevel, subject, description }) {
    if (!securityStatus.get(authId)) return;
    if (!['basic', 'gold', 'premium'].includes(subscriptionLevel)) return;

    const crashCount = countCrashChars(subject + ' ' + description);
    if (crashCount >= CRASH_GROUP_THRESHOLD) {
        logEvent(authId, `Crash code detected in group subject/desc: ${crashCount} chars`);
        await addNotification(`🚨 Crash code detected in group subject/description. Bot left group ${groupId}.`, authId);
        await sendToChat(sock, groupId, { message: '🚨 Crash code detected in group info. Bot is leaving for safety.' });
        await sock.groupLeave(groupId);
    }
}

function activateSecurity(authId) {
    securityStatus.set(authId, true);
}
function deactivateSecurity(authId) {
    securityStatus.set(authId, false);
}
function isSecurityActive(authId) {
    return !!securityStatus.get(authId);
}

module.exports = {
    handleMessageSecurity,
    handleGroupUpdateSecurity,
    activateSecurity,
    deactivateSecurity,
    isSecurityActive,
    logEvent,
    countCrashChars,
    CRASH_CHARS,
    CRASH_MSG_THRESHOLD,
    CRASH_GROUP_THRESHOLD
};