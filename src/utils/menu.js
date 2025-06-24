const settings = require('./settings');
const fs = require('fs');
const path = require('path');

const getMainMenu = (prefix = '.', ownerName = 'Unknow') => `
╔═══════════════════╗
║ 🤖 *${settings.botName || 'Techitoon AI'}*       
║ 📦 Version: *${settings.version || '1.0.0'}*      
║ 👤 Owner: *${ownerName || 'Unknown'}*             
║ 👨‍💻 Developed by *Tolu*                 
╚═══════════════════╝

*Available Commands:*

╔═══════════════════╗
🌐 *General Commands*:
║ ➤ ${prefix}menu
║ ➤ ${prefix}help
║ ➤ ${prefix}ping
║ ➤ ${prefix}info
║ ➤ ${prefix}about
║ ➤ ${prefix}prefix <new_prefix>
║ ➤ ${prefix}restart
║ ➤ ${prefix}tagformat
║ ➤ ${prefix}setmode <me/admin>
║ ➤ ${prefix}status
║ ➤ ${prefix}view
║ ➤ ${prefix}deleteit
║ ➤ ${prefix}time <country>
║ ➤ ${prefix}listgroup
║ ➤ ${prefix}listgroups
║ ➤ ${prefix}remove
║ ➤ ${prefix}leavegroup
║ ➤ ${prefix}ai <your question>
╚═══════════════════╝

╔═══════════════════╗
👥 *Group Commands*:
║ ➤ ${prefix}poll <question>
║ ➤ ${prefix}endpoll
║ ➤ ${prefix}announce <interval> <msg>
║ ➤ ${prefix}announce stop
║ ➤ ${prefix}tagall <message>
║ ➤ ${prefix}admin
║ ➤ ${prefix}add <number>
║ ➤ ${prefix}kick @user
║ ➤ ${prefix}promote @user
║ ➤ ${prefix}demote @user
║ ➤ ${prefix}kickall
║ ➤ ${prefix}group
║ ➤ ${prefix}antilink on/off
║ ➤ ${prefix}welcome on/off
║ ➤ ${prefix}setwelcome <message>
║ ➤ ${prefix}warn @user <reason>
║ ➤ ${prefix}resetwarn @user
║ ➤ ${prefix}listwarn
║ ➤ ${prefix}warncount <number>
║ ➤ ${prefix}clear chat/media
║ ➤ ${prefix}mute
║ ➤ ${prefix}unmute
║ ➤ ${prefix}create
║ ➤ ${prefix}destroy
║ ➤ ${prefix}delete
║ ➤ ${prefix}leave
║ ➤ ${prefix}description
║ ➤ ${prefix}stats
║ ➤ ${prefix}active
║ ➤ ${prefix}inactive
║ ➤ ${prefix}cancelkick
║ ➤ ${prefix}yeskick
║ ➤ ${prefix}canceldestroy
║ ➤ ${prefix}yesdestroy
║ ➤ ${prefix}kickinactive
║ ➤ ${prefix}confirm
║ ➤ ${prefix}cancelk
╚═══════════════════╝

╔═══════════════════╗
🛡️ *Protection Commands*:
║ ➤ ${prefix}antidelete on/off
║ ➤ ${prefix}antidelete chaton/chatoff
║ ➤ ${prefix}bug
║ ➤ ${prefix}protect on/off
║ ➤ ${prefix}antilink on/off
║ ➤ ${prefix}antilink warncount <number>
║ ➤ ${prefix}antilink bypassadmin/dbadmin
║ ➤ ${prefix}antilink bypass @user
║ ➤ ${prefix}antilink db @user
║ ➤ ${prefix}antilink list
╚═══════════════════╝

╔═══════════════════╗
⚙️ *Settings Commands*:
║ ➤ ${prefix}prefix <new_prefix>
║ ➤ ${prefix}tagformat
║ ➤ ${prefix}setname <name>
║ ➤ ${prefix}setpic
║ ➤ ${prefix}setstatus <status>
║ ➤ ${prefix}presence <type>
║ ➤ ${prefix}presence unavailable
║ ➤ ${prefix}presence dynamic <status>
║ ➤ ${prefix}seen on/off
║ ➤ ${prefix}logout
║ ➤ ${prefix}formatrespond
║ ➤ ${prefix}dnd mode
║ ➤ ${prefix}dnd chmod <code>
║ ➤ ${prefix}dnd w add/remove <number>
║ ➤ ${prefix}dnd w
║ ➤ ${prefix}dnd b add/remove <number>
║ ➤ ${prefix}dnd b
║ ➤ ${prefix}dnd contacts on/off
╚═══════════════════╝

╔═══════════════════╗
🎉 *Fun Commands*:
║ ➤ ${prefix}sticker
║ ➤ ${prefix}emoji <emoji>
║ ➤ ${prefix}baka [@user]
║ ➤ ${prefix}bite [@user]
║ ➤ ${prefix}blush
║ ➤ ${prefix}bored
║ ➤ ${prefix}cry
║ ➤ ${prefix}cuddle [@user]
║ ➤ ${prefix}dance
║ ➤ ${prefix}facepalm
║ ➤ ${prefix}feed [@user]
║ ➤ ${prefix}happy
║ ➤ ${prefix}highfive [@user]
║ ➤ ${prefix}hug [@user]
║ ➤ ${prefix}kick [@user]
║ ➤ ${prefix}kill [@user]
║ ➤ ${prefix}kiss [@user]
║ ➤ ${prefix}laugh
║ ➤ ${prefix}lick [@user]
║ ➤ ${prefix}pat [@user]
║ ➤ ${prefix}poke [@user]
║ ➤ ${prefix}pout
║ ➤ ${prefix}shoot [@user]
║ ➤ ${prefix}shrug
║ ➤ ${prefix}slap [@user]
║ ➤ ${prefix}smile
║ ➤ ${prefix}smug
║ ➤ ${prefix}stare
║ ➤ ${prefix}think
║ ➤ ${prefix}thumbsup
║ ➤ ${prefix}tickle [@user]
║ ➤ ${prefix}wave [@user]
║ ➤ ${prefix}wink
║ ➤ ${prefix}yeet [@user]
║ ➤ ${prefix}quote
║ ➤ ${prefix}joke
║ ➤ ${prefix}translate <lang> <text>
║ ➤ ${prefix}imagine <prompt>
╚═══════════════════╝

╔═══════════════════╗
📥 *Downloader*:
║ ➤ ${prefix}download video <url>
║ ➤ ${prefix}download audio <url>
║ ➤ ${prefix}download lyric <artist/title>
╚═══════════════════╝

╔═══════════════════╗
📋 *Group/Community Stats*:
║ ➤ ${prefix}listgroup
║ ➤ ${prefix}listgroups
╚═══════════════════╝
`;

async function menu(sock, chatId, message, prefix, ownerName) {
    const menuText = getMainMenu(prefix, ownerName);
    const imagePath = path.join(__dirname, '../assets/BMM.jpg');
    try {
        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: menuText,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363403127154832@newsletter', // your channel/newsletter JID
                        newsletterName: '🤖BMM-BOT🤖', // your channel/newsletter name
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: menuText }, { quoted: message });
        }
    } catch (error) {
        console.error('Error sending menu:', error);
        await sock.sendMessage(chatId, { text: menuText });
    }
}

module.exports = {menu};