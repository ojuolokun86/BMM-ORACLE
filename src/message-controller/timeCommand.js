const moment = require('moment-timezone');
const countryTimezoneList = require('../data/all_countries_timezones.json'); // Full list
const countryAliases = require('../data/countryAliases.json'); // Shortcut names

function getTimezone(userInput) {
    if (!userInput) return null;

    const input = userInput.trim().toLowerCase();

    // Step 1: Check if it's an alias
    const resolvedCountry = countryAliases[input] || userInput;

    // Step 2: Build map of country -> timezones
    const countryTimezones = countryTimezoneList.reduce((acc, curr) => {
        acc[curr.country.toLowerCase()] = curr.timezones;
        return acc;
    }, {});

    // Step 3: Try to find timezones by resolved name
    const match = Object.entries(countryTimezones).find(
        ([key]) => key === resolvedCountry.trim().toLowerCase()
    );

    // Step 4: Return the first timezone
    return match?.[1]?.[0] || null;
}

async function handleTimeCommand(botInstance, remoteJid, message, args, sendToChat) {
    const country = args.join(' ').trim();

    if (!country) {
        await sendToChat(botInstance, remoteJid, {
            message: '❌ Please provide a country. Example: `.time Nigeria`',
            quotedMessage: message
        });
        return;
    }

    const timezone = getTimezone(country);

    if (!timezone) {
        await sendToChat(botInstance, remoteJid, {
            message: `❌ Sorry, I don't know the timezone for "${country}".`,
            quotedMessage: message
        });
        return;
    }

    const now = moment().tz(timezone);
    const formatted = now.format('dddd, MMMM Do YYYY, h:mm:ss A');

    await sendToChat(botInstance, remoteJid, {
        message: `🕒 *Time in ${country}*\n${formatted}\n🌍 Timezone: ${timezone}`,
        quotedMessage: message
    });
}

module.exports = handleTimeCommand;
