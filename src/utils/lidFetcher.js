/**
 * Dynamically fetch the LID for a user.
 * @param {object} sock - The WhatsApp socket instance.
 * @param {string} userId - The user ID (e.g., bot's ID).
 * @param {string|null} groupJid - The group JID to check (optional).
 * @returns {Promise<string|null>} - The LID of the user or null if not found.
 */
async function getUserLid(sock, userId, groupJid = null) {
  try {
    // 1. Try direct method
    if (sock.user?.lid && sock.user.id === userId && sock.user.lid !== 'unknown') {
      return sock.user.lid;
    }

    // 2. If group is specified, check group metadata directly
    if (groupJid) {
      const metadata = await sock.groupMetadata(groupJid);
      const user = metadata.participants.find(p => p.id === userId);
      if (user && user.lid && user.lid !== 'unknown') return user.lid;
    }

    // 3. Otherwise scan all groups for the user
    const allGroups = await sock.groupFetchAllParticipating();
    for (const groupId in allGroups) {
      const metadata = allGroups[groupId];
      const user = metadata.participants.find(p => p.id === userId);
      if (user && user.lid && user.lid !== 'unknown') return user.lid;
    }

    // 4. If still not found
    return null;
  } catch (err) {
    console.error(`❌ Error retrieving LID for user ${userId}:`, err);
    return null;
  }
}

module.exports = { getUserLid };