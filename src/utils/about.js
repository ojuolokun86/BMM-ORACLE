/**
 * Get the about me.
 * @returns {string} - The about info as a string.
 */
const getInfo = () => {
    return `
🤖 *Techitoon Bot BMM* – *Your Personal WhatsApp Bot Assistant!*

💡 Key Features:
• 🧠 Multi-user, multi-instance support – everyone gets their own bot
• 🔒 Smart group modes: me, admin, all
• 🎉 Custom welcome messages for new members
• 🚫 Anti-link protection with auto-warnings
• 👁️ Repost view-once media instantly
• 📣 Auto announcements & polls
• 📈 Memory tracking, uptime monitor & activity logs

📌 Want to see what it can do? Type *.menu*
            `;
};

const getAboutMe = () => {
    return `
    ✨ *Welcome to TECHITOON BOT BMM*🤖 – *Where Control Meets Creativity!*

This isn't just a bot. It's your smart assistant, moderator, community manager, and hype engine all in one 💥

✅ Run your own bot, your way
✅ Automate greetings, actions & protections
✅ Keep your group safe, active & engaged
✅ Manage members like a pro

Whether you’re building a community, running a squad, or just having fun – Techitoon Bot is here to level up your chat experience 🚀

🔔 Always smart. Always ready. Always evolving.
            `;
};

module.exports = {
    getAboutMe,
    getInfo,
};