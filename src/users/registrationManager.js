const { makeWASocket, initAuthCreds, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { sendQrToLm } = require('../server/lmSocketClient');
const { saveSessionToSupabase } = require('../database/models/supabaseAuthState');
const { deleteUserData } = require('../database/userDatabase');
const { fullyStopSession } = require('./userSession');
const pino = require('pino');
const { useSupabaseAuthState} = require('../database/hybridAuthState');
const logger = pino({
  level: 'info', // or 'debug', 'error', etc.
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Minimal in-memory auth state for registration (no file, no DB)
const inMemorySessions = {}; // <--- store by phoneNumber

function createInMemoryAuthState(phoneNumber, authId) {
    const key = `${phoneNumber}:${authId}`;
    if (inMemorySessions[key]) return inMemorySessions[key];
    const creds = initAuthCreds();
    const keys = {};
    const stateObj = {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const result = {};
                    if (keys[type]) {
                        for (const id of ids) {
                            if (keys[type][id]) result[id] = keys[type][id];
                        }
                    }
                    return result;
                },
                set: async (data) => {
                    for (const category in data) {
                        if (!keys[category]) keys[category] = {};
                        for (const id in data[category]) {
                            keys[category][id] = data[category][id];
                        }
                    }
                }
            }
        },
        saveCreds: async () => {},
        getSessionData: () => ({ creds, keys })
    };
    inMemorySessions[key] = stateObj;
    return stateObj;
}

async function registerUser(phoneNumber, io, authId, pairingMethod) {
    console.log(`📝 [REGISTRATION] Starting registration for ${phoneNumber}, authId: ${authId}, method: ${pairingMethod}`);

    let pairingTimeout;
    let registered = false;
    let pairingCodeSent = false;
    let registrationDone = false;
    let registrationStopped = false;
    // Use Supabase auth state for robust registration
    const { useSQLiteAuthState } = require('../database/models/sqliteAuthState');
    const { state, saveCreds } = await useSQLiteAuthState(phoneNumber, authId);
    const { version } = await fetchLatestBaileysVersion(); // ✅ STEP 2

    async function startRegistrationSocket() {
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '125.0.6422.112'],
            printQRInTerminal: false,
             auth: {
                        creds: state.creds,
                        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                    },
        });
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            if (registrationStopped) return;
            const { connection, qr, lastDisconnect, isNewLogin } = update;
            logger.info(`🔄 [REGISTRATION] Connection update for ${phoneNumber}:`, update);
            logger.debug('creds.registered:', sock.authState?.creds?.registered, 'isNewLogin:', isNewLogin);

            if (!registered && qr && pairingMethod === 'pairingCode' && !pairingCodeSent) {
                pairingCodeSent = true;
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    const formattedCode = code.match(/.{1,4}/g).join('-');
                    logger.info(`📱 [REGISTRATION] Sending pairing code to LM: ${formattedCode}`);
                    sendQrToLm({ authId, phoneNumber, pairingCode: formattedCode });
                    pairingTimeout = setTimeout(async () => {
                        logger.warn(`⏰ [REGISTRATION] Timeout for ${phoneNumber}`);
                        await fullyStopSession(phoneNumber);
                        await deleteUserData(phoneNumber);
                          try {
                                await sock.ws.close();
                                sock.ev.removeAllListeners(); // Clean up listeners
                                logger.info(`✅ [REGISTRATION] Registration socket closed for ${phoneNumber}`);
                            } catch (e) {
                                console.warn(`⚠️ Error closing registration socket:`, e.message);
                            }
                        sendQrToLm({
                            authId,
                            phoneNumber,
                            status: 'failure',
                            message: '❌ Registration timed out. Please try again.',
                            needsRescan: true,
                        });
                    }, 2 * 60 * 1000); // 2 minutes
                } catch (err) {
                    console.error('❌ Pairing code generation failed:', err);
                    sendQrToLm({
                        authId,
                        phoneNumber,
                        status: 'failure',
                        message: '❌ Failed to generate pairing code. Please try again.',
                        needsRescan: true,
                    });
                    await fullyStopSession(phoneNumber);
                    await deleteUserData(phoneNumber);
                    return;
                }
            } else if (!registered && qr && pairingMethod === 'qrCode') {
                sendQrToLm({ authId, phoneNumber, qr });
                if (!pairingTimeout) {
                    pairingTimeout = setTimeout(async () => {
                       logger.warn(`⏰ [REGISTRATION] Timeout for ${phoneNumber}`);
                        await fullyStopSession(phoneNumber);
                        await deleteUserData(phoneNumber);
                        sendQrToLm({
                            authId,
                            phoneNumber,
                            status: 'failure',
                            message: '❌ Registration timed out. Please try again.',
                            needsRescan: true,
                        });
                    }, 2 * 60 * 1000); // 2 minutes
                }
            }

            // Only proceed when registered!
           if (connection === 'open' && !registrationDone) {
            registrationDone = true;
            logger.info(`✅ [REGISTRATION] Connection open for ${phoneNumber}`);
            if (pairingTimeout) clearTimeout(pairingTimeout);
            await saveCreds();

            // Close registration socket before starting main session
            try {
                await sock.ws.close();
                sock.ev.removeAllListeners(); // Clean up listeners
                logger.info(`✅ [REGISTRATION] Registration socket closed for ${phoneNumber}`);
            } catch (e) {
                console.warn(`⚠️ Error closing registration socket:`, e.message);
            }

            // Now start the main session
            if (io) {
                io.to(String(authId)).emit('registration-status', {
                    phoneNumber,
                    status: 'success',
                    message: '✅ Registration complete!',
                });
            }
            const { startNewSession } = require('./userSession');
            await startNewSession(phoneNumber, io, authId, pairingMethod);
            return;
        }

            // If connection closes and not registered, restart registration socket
           if (connection === 'close' && !registered) {
                if (pairingTimeout) clearTimeout(pairingTimeout);

                // Check error reason
                const errorMsg = lastDisconnect?.error?.message || '';
                if (
                    errorMsg.includes('restart required') ||
                    errorMsg.includes('Stream Errored (restart required)')
                ) {
                    logger.info(`🔄 [REGISTRATION] Restarting registration socket for ${phoneNumber} (restart required)`);
                    setTimeout(() => startRegistrationSocket(), 5000);
                } else if (
                    errorMsg.includes('QR refs attempts ended')
                ) {
                    // Stop and notify user
                    console.warn(`⛔ [REGISTRATION] QR scan attempts ended for ${phoneNumber}. Stopping registration.`);
                    sendQrToLm({
                        authId,
                        phoneNumber,
                        status: 'failure',
                        message: '❌ Registration failed: QR scan attempts ended. Please try again later.',
                        needsRescan: true,
                    });
                    // Optionally: fully stop session
                    await fullyStopSession(phoneNumber);
                    await deleteUserData(phoneNumber);
                    // Do NOT restart registration
                } else {
                    // For other errors, you can decide to stop or restart as needed
                    console.warn(`⛔ [REGISTRATION] Registration closed for ${phoneNumber} due to: ${errorMsg}. Not restarting.`);
                    sendQrToLm({
                        authId,
                        phoneNumber,
                        status: 'failure',
                        message: `❌ Registration failed: ${errorMsg || 'Unknown error'}`,
                        needsRescan: true,
                    });

                     function cancelRegistration() {
                        registrationStopped = true;
                        if (sock && sock.ev) sock.ev.removeAllListeners();
                        if (sock && sock.ws) sock.ws.close();
                    }
                    await fullyStopSession(phoneNumber);
                    await deleteUserData(phoneNumber);
                    // Do NOT restart registration
                }
            }
        });
    }

    // Start the first registration socket
   await startRegistrationSocket();
}

module.exports = { registerUser };