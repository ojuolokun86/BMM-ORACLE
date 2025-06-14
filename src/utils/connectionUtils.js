/**
 * Checks if the WebSocket connection is active.
 * @param {object} sock - The bot instance.
 * @returns {boolean} - True if the connection is active, false otherwise.
 */
const isConnectionActive = (sock) => {
    return sock?.ws?.readyState === 1; // WebSocket.OPEN
};

module.exports = { isConnectionActive };