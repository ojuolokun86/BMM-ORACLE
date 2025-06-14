const supabase = require('../supabaseClient');
const { addNotification } = require('../database/notification');

const validateToken = async (req, res, next) => {
    const { authId } = req.body;

    if (!authId) {
        return res.status(400).json({ success: false, message: 'Auth ID is required.' });
    }

    try {
        // Fetch the token for the user
        const { data: token, error } = await supabase
            .from('subscription_tokens')
            .select('*')
            .eq('user_auth_id', authId)
            .single();

        if (error || !token) {
            console.error('❌ Token not found for authId:', authId);
            await addNotification('No token found. Please contact the developer to get a token.', authId);
            return res.status(403).json({ success: false, message: 'No token found. Please contact the developer.' });
        }

        // Check if the token is expired
        const now = new Date();
        if (new Date(token.expiration_date) < now) {
            console.error('❌ Token expired for authId:', authId);
            await addNotification('Your token has expired. Please contact the developer to renew it.', authId);
            return res.status(403).json({ success: false, message: 'Token expired. Please contact the developer.' });
        }

        // Token is valid, proceed to the next middleware or route handler
        next();
    } catch (error) {
        console.error('❌ Error validating token:', error.message);
        res.status(500).json({ success: false, message: 'Failed to validate token.' });
    }
};


module.exports = validateToken;