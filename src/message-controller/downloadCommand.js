const { exec, execSync } = require('child_process');
const sendToChat = require('../utils/sendToChat');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Helper for yt-dlp downloads
async function downloadMedia(sock, botInstance, remoteJid, url, type = 'video') {
    const outFile = path.join(__dirname, `../../tmp/${Date.now()}.${type === 'audio' ? 'mp3' : 'mp4'}`);
   let command;
        if (type === 'audio') {
            command = `yt-dlp -x --audio-format mp3 -o "${outFile}" "${url}"`;
        } else {
            command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4" --merge-output-format mp4 -o "${outFile}" "${url}"`;
        }

    console.log(`[yt-dlp] Running: ${command}`);
    await sendToChat(botInstance, remoteJid, { message: `⏬ Downloading ${type}... Please wait.` });

    exec(command, async (error, stdout, stderr) => {
        if (error) {
            console.error('[yt-dlp] Error:', error, stderr);
            await sendToChat(botInstance, remoteJid, { message: `❌ Download failed: ${stderr || error.message}` });
            return;
        }
        try {
            // Find the actual output file (yt-dlp may append .webm, etc)
            const pathBase = outFile.replace(/\.mp4$|\.mp3$/i, '');
            const dir = path.dirname(outFile);
            let foundFile = null;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file.startsWith(path.basename(pathBase))) {
                    foundFile = path.join(dir, file);
                    break;
                }
            }
            if (!foundFile) {
                console.error('[yt-dlp] No output file found.');
                await sendToChat(botInstance, remoteJid, { message: '❌ Download failed: File was not created. The video may be unavailable or blocked.' });
                return;
            }
              let mimetype = 'video/mp4';
            if (foundFile.endsWith('.webm')) mimetype = 'video/webm';
            else if (foundFile.endsWith('.mkv')) mimetype = 'video/x-matroska';
            else if (foundFile.endsWith('.mp3')) mimetype = 'audio/mp3';
            else if (foundFile.endsWith('.ogg')) mimetype = 'audio/ogg';
            else if (foundFile.endsWith('.wav')) mimetype = 'audio/wav';

            if (type === 'video' && !foundFile.endsWith('.mp4')) {
                await sendToChat(botInstance, remoteJid, {
                    message: '⚠️ Note: This video may not play in WhatsApp. For best results, use .mp4 links or try another video.'
                });
            }

            const media = fs.readFileSync(foundFile);
            const stats = fs.statSync(foundFile);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

            await sendToChat(botInstance, remoteJid, {
                media,
                mediaType: type === 'audio' ? 'audio' : 'video',
                mimetype,
                caption: `⬇️Downloaded By *🤖BMM-BOT🤖* \n\n *⬇️File Size:* ${sizeMB} MB`,
            });

            fs.unlinkSync(foundFile);
        } catch (err) {
            console.error('[yt-dlp] Error sending media:', err);
            await sendToChat(botInstance, remoteJid, { message: '❌ Failed to send the downloaded file.' });
        }
    });
}

// Helper for lyrics (using lyrics.ovh as example) with fallback
async function downloadLyrics(sock, botInstance, remoteJid, query) {
    try {
        // Expecting "artist/title" or "artist - title"
        let artist = '', title = '';
        if (query.includes('/')) {
            [artist, title] = query.split('/');
        } else if (query.includes('-')) {
            [artist, title] = query.split('-');
        } else {
            await sendToChat(botInstance, remoteJid, { message: '❌ Please use the format: artist/title or artist - title' });
            return;
        }
        artist = artist.trim();
        title = title.trim();

        // First try lyrics.ovh
        let url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        try {
            const res = await axios.get(url, { timeout: 7000 });
            if (res.data && res.data.lyrics) {
                await sendToChat(botInstance, remoteJid, { message: `🎤 *Lyrics for "${artist} - ${title}":*\n\n${res.data.lyrics}` });
                return;
            }
        } catch (err) {
            // Continue to fallback
        }

        // Fallback: try lyrics-api.dev
        url = `https://lyrics-api.dev/api/find/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        try {
            const res2 = await axios.get(url, { timeout: 7000 });
            if (res2.data && res2.data.lyrics) {
                await sendToChat(botInstance, remoteJid, { message: `🎤 *Lyrics for "${artist} - ${title}":*\n\n${res2.data.lyrics}` });
                return;
            }
        } catch (err2) {
            // Both failed
        }

        await sendToChat(botInstance, remoteJid, { message: '❌ Lyrics not found from any provider.' });
    } catch (err) {
        console.error('Failed to fetch lyrics:', err);
        await sendToChat(botInstance, remoteJid, { message: '❌ Failed to fetch lyrics.' });
    }
}

// Main handler
async function handleDownloadCommand(sock, botInstance, remoteJid, args) {
    const subcommand = (args[0] || '').toLowerCase();
    const restArgs = args.slice(1);

    if (!subcommand || ['help', '--help', '-h'].includes(subcommand)) {
        await sendToChat(botInstance, remoteJid, {
            message: `*Download Usage:*\n` +
                '`.download video <url>` - Download video from most sites\n' +
                '`.download audio <url>` - Download audio (mp3)\n' +
                '`.download lyric <artist>/<title>` - Get song lyrics\n'
        });
        return true;
    }

    switch (subcommand) {
        case 'video':
            if (!restArgs[0]) {
                await sendToChat(botInstance, remoteJid, { message: '❌ Please provide a video URL.' });
                return true;
            }
            await downloadMedia(sock, botInstance, remoteJid, restArgs[0], 'video');
            return true;
        case 'audio':
            if (!restArgs[0]) {
                await sendToChat(botInstance, remoteJid, { message: '❌ Please provide a video URL.' });
                return true;
            }
            await downloadMedia(sock, botInstance, remoteJid, restArgs[0], 'audio');
            return true;
        case 'lyric':
        case 'lyrics':
            if (!restArgs[0]) {
                await sendToChat(botInstance, remoteJid, { message: '❌ Please provide artist/title. Example: .download lyric Eminem/Lose Yourself' });
                return true;
            }
            await downloadLyrics(sock, botInstance, remoteJid, restArgs.join(' '));
            return true;
        default:
            await sendToChat(botInstance, remoteJid, { message: '❌ Unknown subcommand. Use `.download help` for usage.' });
            return true;
    }
}

module.exports = { handleDownloadCommand };