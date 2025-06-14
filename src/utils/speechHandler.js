const { speechClient } = require('../utils/globalStore'); // Import the SpeechClient

const transcribeAudio = async (audioBuffer) => {
    try {
        const audio = {
            content: audioBuffer.toString('base64'), // Convert the audio buffer to base64
        };

        const config = {
            encoding: 'LINEAR16', // Adjust based on your audio format
            sampleRateHertz: 16000, // Adjust based on your audio sample rate
            languageCode: 'en-US', // Adjust based on your language preference
        };

        const request = {
            audio,
            config,
        };

        console.log('🔍 Sending audio for transcription...');
        const [response] = await speechClient.recognize(request);
        const transcription = response.results
            .map((result) => result.alternatives[0].transcript)
            .join('\n');

        console.log(`✅ Transcription: ${transcription}`);
        return transcription;
    } catch (error) {
        console.error('❌ Failed to transcribe audio:', error);
        throw error;
    }
};

module.exports = { transcribeAudio };