/**
 * Get the menu list with the user's prefix.
 * @param {string} prefix - The user's custom prefix.
 * @returns {string} - The menu list as a string.
 */


const getMenuCategories = (prefix = '.') => `
╭━━━〘 🤖 Techitoon AI - Menu Categories 🚀 〙━━━╮

1️⃣ *${prefix}menu general* - General Commands
2️⃣ *${prefix}menu settings* - Settings Commands
3️⃣ *${prefix}menu protection* - Protection Commands
4️⃣ *${prefix}menu group* - Group Commands
5️⃣ *${prefix}menu fun* - Fun Commands

╰━━━〘 Select a category above! 〙━━━╯
`;

const getGeneralMenu = (prefix = '.') => `
📌 𝗚𝗘𝗡𝗘𝗥𝗔𝗟 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦:
╭───────────────────────╮
┃ ✅ *${prefix}menu* - Show this menu  
┃ ℹ️ *${prefix}info* - Get bot information  
┃ 🏓 *${prefix}ping* - Check bot responsiveness  
┃ 📖 *${prefix}about* - Learn about this bot  
┃ 🔄 *${prefix}restart* - Restart the bot  
┃ 🎉 *${prefix}fun* - Show all fun commands  
┃ 🗑️ *${prefix}deleteit* - Delete your command message in DM  
╰───────────────────────╯
`;

const getSettingsMenu = (prefix = '.') => `
📌 𝗦𝗘𝗧𝗧𝗜𝗡𝗚𝗦 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦:
╭───────────────────────╮
┃ 🔤 *${prefix}prefix* <new_prefix> - Change the command prefix  
┃ 🎨 *${prefix}tagformat* - Toggle between formatted and plain tagall messages  
┃ ✏️ *${prefix}setname* <name> - Update the bot's display name  
┃ 🖼️ *${prefix}setpic* - Set the bot's profile picture  
┃ ✏️ *${prefix}setstatus* <status> - Update the bot's "About Me" status  
┃ 🔄 *${prefix}presence* <type> - Set the bot's presence (e.g., available, composing, recording)  
┃ 🔄 *${prefix}presence* unavailable - disable all presence
┃ 🔄 *${prefix}presence dynamic* <status> - Set the bot's presence for chat and group (e.g., available, composing, recording)  
┃ 👁️ *${prefix}seen on* - Mark chat as seen  
┃ 👁️ *${prefix}seen off* - Disable seen status
┃ 🤖 *${prefix}logout* - logout from Bot
┃ 🗣️ *${prefix}formatrespond* - format response from Bot
┃ 📞 *${prefix}dnd mode* - Show DND modes
┃ 📞 *${prefix}dnd chmod <code>* - Change DND mode
┃ 📞 *${prefix}dnd w add/remove <number>* - Add/remove number to whitelist
┃ 📞 *${prefix}dnd w* - View whitelist
┃ 📞 *${prefix}dnd b add/remove <number>* - Add/remove number to blacklist
┃ 📞 *${prefix}dnd b* - View blacklist
┃ 📞 *${prefix}dnd contacts on/off* - Allow only contacts to call
╰───────────────────────╯
`;

const getProtectionMenu = (prefix = '.') => `
📌 𝗣𝗥𝗢𝗧𝗘𝗖𝗧𝗜𝗢𝗡 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦:
╭───────────────────────╮
┃ 🛡️ *${prefix}antidelete* on/off - Enable or disable antidelete  
┃ 🛡️ *${prefix}antidelete chaton* - set antidelete to all chat
┃ 🛡️ *${prefix}antidelete chatoff* - disable antidelete to all chat
┃ 🪲 *${prefix}bug* - Bug a whatsapp user
┃ 🛡️ *${prefix}protect* on/off - Enable or disable message protection
┃ 🔗 *${prefix}antilink* on/off - Enable or disable Anti-Link for the group  
┃ 🔗 *${prefix}antilink* warncount <number> - Set the warning count for Anti-Link  
┃ 🔗 *${prefix}antilink* bypassadmin - Enable bypass for group admins  
┃ 🔗 *${prefix}antilink* dbadmin - Disable bypass for group admins  
┃ 🔗 *${prefix}antilink* bypass @user - Add a specific user to the bypass list  
┃ 🔗 *${prefix}antilink* db @user - Remove a specific user from the bypass list  
┃ 🔗 *${prefix}antilink* list - Display the current Anti-Link settings  
╰───────────────────────╯
`;

const getGroupMenu = (prefix = '.') => `
📌 𝗚𝗥𝗢𝗨𝗣 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦:
╭───────────────────────╮
┃ 👥 *${prefix}tagall* <message> - Tag all members in a group  
┃ ⚙️ *${prefix}setmode* <me/admin> - Set the group mode  
┃ ⚠️ *${prefix}warn* @user <reason> - Warn a user  
┃ ♻️ *${prefix}resetwarn* @user - Reset warnings for a user  
┃ 📋 *${prefix}listwarn* - List all warnings in the group  
┃ 🔢 *${prefix}warncount* <number> - Set the warning threshold  
┃ 👋 *${prefix}welcome* on/off - Enable or disable welcome messages  
┃ ✍️ *${prefix}setwelcome* <message> - Set a custom welcome message  
┃ 📜 *${prefix}group description* <description> - Update the group description  
┃ 📜 *${prefix}group info* Get the group description 
┃ 🏷️ *${prefix}group name* <new_name> - Update the group name  
┃ 🖼️ *${prefix}group pic* - Update the group profile picture  
┃ 📊 *${prefix}poll* <question>\n<option1>\n<option2> - Create a poll  
┃ 🛑 *${prefix}endpoll* - End the current poll  
┃ 🚪 *${prefix}kick* <@user> - Remove a member from the group  
┃ ➕ *${prefix}add* <number> - Add a member to the group  
┃ ⬆️ *${prefix}promote* <@user> - Promote a member to admin  
┃ ⬇️ *${prefix}demote* <@user> - Demote an admin to a regular member  
┃ 🧹 *${prefix}clear* chat/media - Clear messages in the group  
┃ 🔒 *${prefix}mute* - Mute the group (only admins can send messages)  
┃ 🔓 *${prefix}unmute* - Unmute the group (all members can send messages)  
┃ 🚪 *${prefix}kickall* - Remove all non-admin members from the group  
┃ 📢 *${prefix}announce* <interval> <message> - Start announcements  
┃ 🛑 *${prefix}announce stop* - Stop announcements  
┃ 🔗 *${prefix}group link* - Get the group invite link  
┃ 🔄 *${prefix}group revoke* - Revoke the group invite link  
┃ 🔄 *${prefix}leave* - Leave the group  
┃ 🚫 *${prefix}block* <number> - Block a user (owner only)  
┃ ✅ *${prefix}unblock* <number> - Unblock a user (owner only) 
┃ 📢 *${prefix}admin* - Tag all admins in the group  
┃ 📈 *${prefix}stats* - Show group stats  
┃ 🟢 *${prefix}active* - List active members  
┃ 🔴 *${prefix}inactive* - List inactive members  
╰───────────────────────╯
`;

const getFunMenu = (prefix = '.') => `
📌 𝗙𝗨𝗡 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦:
╭───────────────────────╮
┃ 😂 *${prefix}joke* - Get a random joke  
┃ 📝 *${prefix}quote* - Get a random quote  
┃ 🎲 *${prefix}roll* - Roll a dice  
┃ 🃏 *${prefix}rps* - Rock Paper Scissors  
┃ 🖼️ *${prefix}meme* - Get a random meme  
┃ 🖼️ *${prefix}anime* - Get a random anime image  
┃ 🖼️ *${prefix}waifu* - Get a random waifu image  
┃ 🖼️ *${prefix}cat* - Get a random cat image  
┃ 🖼️ *${prefix}dog* - Get a random dog image  
┃ 🎵 *${prefix}song* <query> - Search and play a song  
┃ 🎬 *${prefix}movie* <query> - Search for a movie  
┃ 🎮 *${prefix}game* - Play a mini game  
╰───────────────────────╯
`;

module.exports = {
    getMenuCategories,
    getGeneralMenu,
    getSettingsMenu,
    getProtectionMenu,
    getGroupMenu,
    getFunMenu,
};