const { fetchLatestBaileysVersion: fetchVersionWhiskey } = require('@whiskeysockets/baileys');


const fetchWhatsAppWebVersion = async (library = 'whiskeysockets') => {
    try {
        if (library === 'whiskeysockets') {
            const { version } = await fetchVersionWhiskey();
            return version;
        }
    } catch (error) {
        console.error(`❌ Error fetching WhatsApp Web version (${library}):`, error);
        throw error;
    }
};

module.exports = { fetchWhatsAppWebVersion };