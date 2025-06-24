// fun-commands.js
const axios = require('axios');
const path = require('path');
const tmp = require('tmp');
const fs = require('fs');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { sendToChat } = require('../utils/messageUtils');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

function getTargetUser(message, args) {
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (contextInfo?.participant) return contextInfo.participant;
    if (args[0]) return args[0].includes('@') ? args[0] : `${args[0]}@s.whatsapp.net`;
    return null;
}

async function toWebpStickerBuffer(imageBuffer) {
    return sharp(imageBuffer)
        .resize(512, 512, { fit: 'inside' })
        .webp()
        .toBuffer();
}

async function gifToAnimatedStickerBuffer(gifBuffer) {
    return new Promise((resolve, reject) => {
        const inputFile = tmp.tmpNameSync({ postfix: '.gif' });
        const outputFile = tmp.tmpNameSync({ postfix: '.webp' });
        fs.writeFileSync(inputFile, gifBuffer);

        ffmpeg(inputFile)
            .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', "scale=320:320:force_original_aspect_ratio=decrease,fps=15,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
                '-loop', '0'
            ])
            .toFormat('webp')
            .save(outputFile)
            .on('end', () => {
                const webp = fs.readFileSync(outputFile);
                fs.unlinkSync(inputFile);
                fs.unlinkSync(outputFile);
                resolve(webp);
            })
            .on('error', err => {
                fs.unlinkSync(inputFile);
                reject(err);
            });
    });
}

async function fetchGiphyActionGif(action) {
    try {
        const res = await axios.get('https://api.giphy.com/v1/gifs/search', {
            params: {
                api_key: 'C5XVeQxRFvdVEXvO1qKN33E7cmvQss2n',
                q: action,
                limit: 1,
                rating: 'g'
            }
        });
        if (!res.data.data.length) return null;
        const gifUrl = res.data.data[0].images.original.url;
        const imgRes = await axios.get(gifUrl, { responseType: 'arraybuffer' });
        return Buffer.from(imgRes.data);
    } catch (err) {
        console.error('Giphy fetch error:', err);
        return null;
    }
}

function enhancePrompt(prompt) {
    const qualityEnhancers = ['high quality', 'detailed', 'masterpiece', 'ultra realistic', '4k', 'sharp focus'];
    const selected = qualityEnhancers.sort(() => 0.5 - Math.random()).slice(0, 3);
    return `${prompt}, ${selected.join(', ')}`;
}

// 🔁 Repeatable action handler
async function handleFunAction(sock, message, command, args, remoteJid, botInstance) {
    const target = getTargetUser(message, args);
    const senderId = message.key.participant || message.key.remoteJid;
    const senderTag = `@${senderId.split('@')[0]}`;
    const targetTag = target ? `@${target.split('@')[0]}` : 'someone';
    const text = `🔸 ${senderTag} ${command}s ${targetTag}!`;
    const mentions = target ? [senderId, target] : [senderId];

    const gifBuffer = await fetchGiphyActionGif(command);
    if (!gifBuffer) {
        await sendToChat(botInstance, remoteJid, { message: text, mentions, quotedMessage: message });
        return;
    }

    const webpBuffer = await gifToAnimatedStickerBuffer(gifBuffer);
    await sock.sendMessage(remoteJid, { sticker: webpBuffer, mentions }, { quoted: message });
    await sendToChat(botInstance, remoteJid, { message: text, mentions, quotedMessage: message });
}

const handleFunCommand = async (sock, message, command, args, userId, remoteJid, botInstance) => {
    try {
        switch (command) {
            case 'imagine': {
                const prompt = args.join(' ').trim();
                if (!prompt) return await sendToChat(botInstance, remoteJid, {
                    message: 'Please provide a prompt. Example: .imagine a castle on a cliff', quotedMessage: message });
                await sendToChat(botInstance, remoteJid, {
                    message: '🎨 Generating your image... Please wait.', quotedMessage: message });
                const enhancedPrompt = enhancePrompt(prompt);
                const res = await axios.get('https://api.shizo.top/ai/imagine/flux', {
                    params: { apikey: 'knightbot', prompt: enhancedPrompt }, responseType: 'arraybuffer' });
                return await sock.sendMessage(remoteJid, { image: Buffer.from(res.data), caption: `🎨 Prompt: "${prompt}"` }, { quoted: message });
            }

            case 'sticker': {
                let imageBuffer = null;
                const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const type = quoted ? Object.keys(quoted)[0] : null;
                if (quoted && type === 'imageMessage') {
                    imageBuffer = await downloadMediaMessage({ message: { imageMessage: quoted.imageMessage } }, 'buffer', {});
                } else if (message.message?.imageMessage) {
                    imageBuffer = await downloadMediaMessage(message, 'buffer', {});
                } else if (args[0]?.startsWith('http')) {
                    const res = await axios.get(args[0], { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(res.data);
                }
                if (!imageBuffer) return await sendToChat(botInstance, remoteJid, {
                    message: '❌ Reply to or send an image to make a sticker.', quotedMessage: message });
                const webpBuffer = await toWebpStickerBuffer(imageBuffer);
                return await sock.sendMessage(remoteJid, { sticker: webpBuffer }, { quoted: message });
            }

            case 'emoji': {
                const emoji = args[0];
                if (!emoji) return await sendToChat(botInstance, remoteJid, {
                    message: '❌ Provide an emoji. Example: .emoji 😎', quotedMessage: message });
                const codePoint = emoji.codePointAt(0).toString(16);
                const url = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${codePoint}.png`;
                const res = await axios.get(url, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(res.data);
                const webpBuffer = await toWebpStickerBuffer(buffer);
                return await sock.sendMessage(remoteJid, { sticker: webpBuffer }, { quoted: message });
            }

            case 'quote': {
                const res = await axios.get('https://zenquotes.io/api/random');
                const data = res.data[0];
                return await sendToChat(botInstance, remoteJid, {
                    message: `💬 *Quote of the Moment*\n\n"${data.q}"\n\n— _${data.a}_`, quotedMessage: message });
            }

            case 'joke': {
                const res = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,religious,political,racist,sexist,explicit');
                const joke = res.data.type === 'single' ? res.data.joke : `${res.data.setup}\n${res.data.delivery}`;
                return await sendToChat(botInstance, remoteJid, {
                    message: `😂 *Joke of the Moment*\n\n${joke}`, quotedMessage: message });
            }

            case 'translate': {
                const [targetLang, ...textArr] = args;
                const text = textArr.join(' ');
                if (!targetLang || !text) return await sendToChat(botInstance, remoteJid, {
                    message: '❌ Usage: .translate <lang_code> <text>', quotedMessage: message });
                const res = await axios.post('https://libretranslate.de/translate', {
                    q: text, source: 'auto', target: targetLang, format: 'text'
                }, { headers: { accept: 'application/json' } });
                return await sendToChat(botInstance, remoteJid, {
                    message: `🌐 *Translated (${targetLang}):*\n${res.data.translatedText}`, quotedMessage: message });
            }

            // 🎯 INDIVIDUAL CASE BLOCKS FOR ACTION COMMANDS
            case 'slap': case 'hug': case 'kick': case 'poke': case 'tickle':
            case 'cry': case 'pat': case 'kill': case 'kiss': case 'wave':
            case 'blush': case 'shrug': case 'smile': case 'laugh':
            case 'lick': case 'bored': case 'stare': case 'yeet': case 'feed':
            case 'dance': case 'cuddle': case 'highfive': case 'facepalm':
            case 'thumbsup': case 'think': case 'shoot': case 'pout':
            case 'bite': case 'smug': case 'baka': {
                return await handleFunAction(sock, message, command, args, remoteJid, botInstance);
            }

            default:
                return false;
        }
    } catch (err) {
        console.error('❌ Error in fun command:', err);
        await sendToChat(botInstance, remoteJid, {
            message: '❌ An error occurred while processing the command.', quotedMessage: message });
        return true;
    }
};

module.exports = { handleFunCommand };
