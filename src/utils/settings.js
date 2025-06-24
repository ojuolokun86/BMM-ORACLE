require('dotenv').config();

module.exports = {
    botName: 'BMM',
    version: process.env.BOT_VERSION || '1.0.0',
    // botOwner will be set dynamically in the menu function
};