const axios = require('axios');
const fetch = require('node-fetch');
const sendToChat = require('./sendToChat');

const OPENROUTER_API_KEY = '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'; // Replace with your real key

async function handleAiCommand(sock, botInstance, remoteJid, message, args) {
    try {
        const query = args.join(' ').trim();
        if (!query) {
            await sendToChat(botInstance, remoteJid, {
                message: "Please provide a question after .ai\n\nExample: .ai write a basic html code",
                quotedMessage: message
            });
            return true;
        }
        // 🔹 Try GPT (Dreaded) fallback
        try {
            const response = await axios.get(`https://api.dreaded.site/api/chatgpt?text=${encodeURIComponent(query)}`);
            if (response.data && response.data.success && response.data.result) {
                const answer = response.data.result.prompt;
                await sendToChat(botInstance, remoteJid, {
                    message: answer,
                    quotedMessage: message
                });
                return true;
            }
        } catch (error) {
            console.log('[Dreaded GPT] Failed, trying Gemini...');
        }

        // 🔹 Try Gemini APIs as last resort
        const apis = [
            `https://vapis.my.id/api/gemini?q=${encodeURIComponent(query)}`,
            `https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(query)}`,
            `https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(query)}`,
            `https://api.dreaded.site/api/gemini2?text=${encodeURIComponent(query)}`,
            `https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${encodeURIComponent(query)}`,
            `https://api.giftedtech.my.id/api/ai/geminiaipro?apikey=gifted&q=${encodeURIComponent(query)}`
        ];

        for (const api of apis) {
            try {
                const response = await fetch(api);
                const data = await response.json();
                if (data.message || data.data || data.answer || data.result) {
                    const answer = data.message || data.data || data.answer || data.result;
                    await sendToChat(botInstance, remoteJid, {
                        message: answer,
                        quotedMessage: message
                    });
                    return true;
                }
            } catch (e) {
                continue;
            }
        }

        // ❌ If all fail
        await sendToChat(botInstance, remoteJid, {
            message: "❌ Failed to get response. Please try again later.",
            quotedMessage: message
        });
        return true;

    } catch (error) {
        console.error('AI Command Error:', error);
        await sendToChat(botInstance, remoteJid, {
            message: "❌ An error occurred. Please try again later.",
            quotedMessage: message
        });
        return true;
    }
}

module.exports = { handleAiCommand };
