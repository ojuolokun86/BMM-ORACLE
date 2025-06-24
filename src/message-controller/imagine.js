const axios = require('axios');
const sendToChat = require('../utils/sendToChat');

async function imagine(sock, message, command, args, userId, remoteJid, botInstance) {
    if (command === 'imagine') {
        try {
            const prompt = args.join(' ').trim();
            if (!prompt) {
                await sock.sendMessage(remoteJid, {
                    text: 'Please provide a prompt for the image generation.\nExample: .imagine a beautiful sunset over mountains'
                }, { quoted: message });
                return true;
            }

            await sock.sendMessage(remoteJid, {
                text: '🎨 Generating your image... Please wait.'
            }, { quoted: message });

            // Enhance the prompt
            const enhancedPrompt = enhancePrompt(prompt);

            // API request
            const response = await axios.get('https://api.shizo.top/ai/imagine/flux', {
                params: {
                    apikey: 'knightbot',
                    prompt: enhancedPrompt
                },
                responseType: 'arraybuffer'
            });

            const imageBuffer = Buffer.from(response.data);

            await sock.sendMessage(remoteJid, {
                image: imageBuffer,
                caption: `🎨 Generated image for prompt: "${prompt}"`
            }, { quoted: message });

            return true;
        } catch (error) {
            console.error('Error in imagine command:', error);
            await sock.sendMessage(remoteJid, {
                text: '❌ Failed to generate image. Please try again later.'
            }, { quoted: message });
            return true;
        }
    }
    // ...existing fun commands...
    return false;
}

// Helper to enhance prompt
function enhancePrompt(prompt) {
    const qualityEnhancers = [
        'high quality', 'detailed', 'masterpiece', 'best quality', 'ultra realistic',
        '4k', 'highly detailed', 'professional photography', 'cinematic lighting', 'sharp focus'
    ];
    const numEnhancers = Math.floor(Math.random() * 2) + 3;
    const selectedEnhancers = qualityEnhancers.sort(() => Math.random() - 0.5).slice(0, numEnhancers);
    return `${prompt}, ${selectedEnhancers.join(', ')}`;
}

module.exports = { imagine };