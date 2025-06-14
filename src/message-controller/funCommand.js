const axios = require('axios');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { sendToChat } = require('../utils/messageUtils');
const { getFunMenu } = require('../utils/funMenu');
const { prefix } = require('../database/userPrefix');
const sharp = require('sharp')



/**
 * Convert an image buffer to WhatsApp-compatible WebP sticker buffer.
 * @param {Buffer} imageBuffer
 * @returns {Promise<Buffer>}
 */
async function toWebpStickerBuffer(imageBuffer) {
    return sharp(imageBuffer)
        .resize(512, 512, { fit: 'inside' })
        .webp()
        .toBuffer();
}

function getTargetUser(message, args) {
    // Check if replying to a message with participant ID
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (contextInfo?.participant) {
        return contextInfo.participant;  // This should be full WhatsApp ID
    }
    // Use argument, ensure full ID format if possible
    if (args[0]) {
        // If just a number, append @s.whatsapp.net
        if (!args[0].includes('@')) {
            return `${args[0]}@s.whatsapp.net`;
        }
        return args[0];
    }
    return null; // Or 'someone'
}


async function fetchGiphyActionGif(action) {
  try {
    const res = await axios.get('https://api.giphy.com/v1/gifs/search', {
      params: {
        api_key: 'C5XVeQxRFvdVEXvO1qKN33E7cmvQss2n',  // your API key
        q: action,
        limit: 1,
        rating: 'g'
      }
    });
    
    if (res.data.data.length === 0) return null;
    
    // Get original GIF URL
    const gifUrl = res.data.data[0].images.original.url;
    
    // Download the GIF as buffer for sticker conversion, if needed
    const imgRes = await axios.get(gifUrl, { responseType: 'arraybuffer' });
    return Buffer.from(imgRes.data, 'binary');
    
  } catch (err) {
    console.error('Error fetching from Giphy:', err);
    return null;
  }
}

const handleFunCommand = async (sock, message, command, args, userId, remoteJid, botInstance) => {
    try {
        switch (command) {
                           case 'sticker': {
                    let imageBuffer = null;

                    // 1. Check if replying to a media message
                    const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                    const quotedMessageType = quotedMessage ? Object.keys(quotedMessage)[0] : null;

                    if (quotedMessage && quotedMessageType === 'imageMessage') {
                        // Download buffer from quoted image
                        const mediaMessage = quotedMessage.imageMessage;
                        imageBuffer = await downloadMediaMessage(
                            { message: { imageMessage: mediaMessage } },
                            'buffer',
                            {}
                        );
                    } else if (message.message?.imageMessage) {
                        // 2. Check if the message itself is an image
                        imageBuffer = await downloadMediaMessage(message, 'buffer', {});
                    } else if (args[0] && args[0].startsWith('http')) {
                        // 3. Download from URL
                        const response = await axios.get(args[0], { responseType: 'arraybuffer' });
                        imageBuffer = Buffer.from(response.data, 'binary');
                    }

                    if (!imageBuffer) {
                        await sendToChat(botInstance, remoteJid, {
                            message: '❌ Reply to an image or provide an image URL to make a sticker.',
                            quotedMessage: message
                        });
                        return true;
                    }

                    let webpBuffer;
                try {
                    webpBuffer = await toWebpStickerBuffer(imageBuffer);
                } catch (err) {
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ Failed to convert image to sticker.',
                        quotedMessage: message
                    });
                    return true;
                }

                await sock.sendMessage(remoteJid, { sticker: webpBuffer }, { quoted: message });
                return true;
            }

            case 'emoji': {
                // Usage: .emoji 😎
                const emoji = args[0];
                if (!emoji) {
                    await sendToChat(botInstance, remoteJid, {
                        message: '❌ Please provide an emoji. Example: `.emoji 😎`',
                        quotedMessage: message
                    });
                    return true;
                }
                console.log(`🔍 Debugging emoji:`, emoji);
                // Create a canvas and draw the emoji
                const codePoint = emoji.codePointAt(0).toString(16);
                const url = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${codePoint}.png`;
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');
                let webpBuffer;
                    try {
                        webpBuffer = await toWebpStickerBuffer(buffer);
                    } catch (err) {
                        await sendToChat(botInstance, remoteJid, {
                            message: '❌ Failed to convert emoji to sticker.',
                            quotedMessage: message
                        });
                        return true;
                    }
                    await sock.sendMessage(remoteJid, { sticker: webpBuffer }, { quoted: message });
                    return true;
                }

                // Add these to the fun command routing case list:
       case 'baka':
case 'bite':
case 'blush':
case 'bored':
case 'cry':
case 'cuddle':
case 'dance':
case 'facepalm':
case 'feed':
case 'happy':
case 'highfive':
case 'hug':
case 'kick':
case 'kill':
case 'kiss':
case 'laugh':
case 'lick':
case 'pat':
case 'poke':
case 'pout':
case 'shoot':
case 'shrug':
case 'slap':
case 'smile':
case 'smug':
case 'stare':
case 'think':
case 'thumbsup':
case 'tickle':
case 'wave':
case 'wink':
case 'yeet': {
  const actionMap = {
    baka: 'baka',
    bite: 'bite',
    blush: 'blush',
    bored: 'bored',
    cry: 'cry',
    cuddle: 'cuddle',
    dance: 'dance',
    facepalm: 'facepalm',
    feed: 'feed',
    happy: 'happy',
    highfive: 'highfive',
    hug: 'hug',
    kick: 'kick',
    kill: 'kill',
    kiss: 'kiss',
    laugh: 'laugh',
    lick: 'lick',
    pat: 'pat',
    poke: 'poke',
    pout: 'pout',
    shoot: 'shoot',
    shrug: 'shrug',
    slap: 'slap',
    smile: 'smile',
    smug: 'smug',
    stare: 'stare',
    think: 'think',
    thumbsup: 'thumbsup',
    tickle: 'tickle',
    wave: 'wave',
    wink: 'wink',
    yeet: 'yeet'
  };

  if (actionMap[command]) {
    const action = actionMap[command];
    const target = getTargetUser(message, args); // your function to get target user ID
   const senderId = message.key.participant || message.key.remoteJid || null;
    if (!senderId) {
    console.error('senderId is missing');
    return false; // or handle error gracefully
    }

    const senderTag = `@${senderId.split('@')[0]}`;

    let text = '';
    let mentions = [];

    if (target === 'someone' || !target) {
    text = `🔸 ${senderTag} ${command}s someone!`;
    mentions = [senderId];
    } else {
    const targetTag = `@${target.split('@')[0]}`;
    text = `🔸 ${senderTag} ${command}s ${targetTag}!`;
    mentions = [senderId, target];
    }


    // Fetch the sticker from nekos.best (your existing function)
   const stickerBuffer = await fetchGiphyActionGif(actionMap[command]);
    if (!stickerBuffer) {
      // If no sticker, just send the message with mentions
      await sendToChat(botInstance, remoteJid, { message: text, mentions, quotedMessage: message });
      return true;
    }

    // Convert to webp sticker buffer (your existing function)
    let webpBuffer;
    try {
      webpBuffer = await toWebpStickerBuffer(stickerBuffer);
    } catch (err) {
      await sendToChat(botInstance, remoteJid, {
        message: text + '\n❌ Failed to convert action to sticker.',
        mentions,
        quotedMessage: message
      });
      return true;
    }

    // Send sticker first, with mentions if any
    await sock.sendMessage(
      remoteJid,
      {
        sticker: webpBuffer,
        ...(mentions.length > 0 && { mentions }),
      },
      { quoted: message }
    );

    // Then send the mention message (text) so WhatsApp displays the tagged names properly
    await sendToChat(botInstance, remoteJid, {
      message: text,
      mentions,
      quotedMessage: message,
    });

    return true;
  }
}


         case 'quote': {
    try {
        const response = await axios.get('https://zenquotes.io/api/random');
        const data = response.data[0];
        const quote = data.q;
        const author = data.a;
        const formatted = `💬 *Quote of the Moment*\n\n"${quote}"\n\n— _${author}_`;
        await sendToChat(botInstance, remoteJid, { message: formatted, quotedMessage: message });
    } catch (err) {
        await sendToChat(botInstance, remoteJid, { message: '❌ Could not fetch a quote at this time.', quotedMessage: message });
    }
    return true;
}


case 'joke': {
    try {
        const response = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit');
        let formatted;
        if (response.data.type === 'single') {
            formatted = `😂 *Joke of the Moment*\n\n${response.data.joke}`;
        } else {
            formatted = `😂 *Joke of the Moment*\n\n${response.data.setup}\n${response.data.delivery}`;
        }
        await sendToChat(botInstance, remoteJid, { message: formatted, quotedMessage: message });
    } catch (err) {
        await sendToChat(botInstance, remoteJid, { message: '❌ Could not fetch a joke at this time.', quotedMessage: message });
    }
    return true;
}

case 'translate': {
    // Usage: .translate <lang> <text>
    const [targetLang, ...textArr] = args;
    const text = textArr.join(' ');
    if (!targetLang || !text) {
        await sendToChat(botInstance, remoteJid, {
            message: '❌ Usage: .translate <target_lang_code> <text>\nExample: .translate es Hello world',
            quotedMessage: message
        });
        return true;
    }
    try {
        // Auto-detect source language and translate
        const resp = await axios.post('https://libretranslate.de/translate', {
            q: text,
            source: 'auto',
            target: targetLang,
            format: 'text'
        }, {
            headers: { accept: 'application/json' }
        });
        const translated = resp.data.translatedText;
        await sendToChat(botInstance, remoteJid, {
            message: `🌐 *Translated (${targetLang}):*\n${translated}`,
            quotedMessage: message
        });
    } catch (err) {
        await sendToChat(botInstance, remoteJid, {
            message: '❌ Could not translate. Please try again or check your language code.',
            quotedMessage: message
        });
    }
    return true;
}
case 'fun': {
    await sendToChat(botInstance, remoteJid, {
        message: getFunMenu(prefix), // Pass the user's prefix if available
        quotedMessage: message
    });
    return true;
}
             default:
                return false;
        }
    } catch (error) {
        console.error(`❌ Error handling fun command: ${error.message}`);
        await sendToChat(botInstance, remoteJid, {
            message: '❌ Error processing fun command.',
            quotedMessage: message
        });
        return true; // Considered handled, since we replied with an error
    }
};
module.exports = { handleFunCommand };