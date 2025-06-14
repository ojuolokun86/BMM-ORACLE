const express = require('express');
const bcrypt = require('bcryptjs'); // For password hashing
const supabase = require('../supabaseClient'); // Supabase client
const router = express.Router();
require('dotenv').config(); // Load environment variables
const { botInstances } = require('../utils/globalStore')
const { listSessionsFromMemory, getUserSessionsMemoryUsage } = require('../database/models/memory'); // Import memory functions
const { deleteUserData } = require('../database/userDatabase'); // Import deleteUserData function
const { restartUserBot } = require('../bot/restartBot'); // Import the restartBot function
const { getAllUserMetrics } = require('../database/models/metrics'); // Import metrics functions


// Helper function to generate a random four-digit auth_id
const generateAuthId = () => {
    return Math.floor(100000 + Math.random() * 900000); // Generate a six-digit auth_id
};

const generateUniqueAuthId = async () => {
    console.log('🔍 Fetching all existing auth_id values from user_auth table...'); // Debug log

    // Fetch all existing auth_id values
    const { data: existingAuthIds, error } = await supabase
        .from('user_auth')
        .select('auth_id');

    if (error) {
        console.error('❌ Error fetching existing auth_id values:', error.message);
        throw new Error('Failed to fetch existing auth_id values.');
    }

    const authIdSet = new Set(existingAuthIds.map((entry) => entry.auth_id)); // Store in a Set for fast lookup

    let authId;
    do {
        authId = generateAuthId(); // Generate a new auth_id
        console.log(`🔍 Checking if auth_id ${authId} is unique...`); // Debug log
    } while (authIdSet.has(authId)); // Repeat until a unique auth_id is found

    console.log(`✅ auth_id ${authId} is unique.`); // Debug log
    return authId;
};

router.post('/register', async (req, res) => {
    console.log('📥 Received registration request:', req.body); // Debug log
   let { email, password, confirmPassword } = req.body;
    email = email.toLowerCase();

    if (!email || !password || !confirmPassword) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    try {
        console.log('🔒 Hashing password...'); // Debug log
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log('🔢 Generating unique auth_id...'); // Debug log
        const authId = await generateUniqueAuthId(); // Generate a six-digit auth_id

        console.log('💾 Saving user to user_auth table...'); // Debug log
        const { data: authData, error: authError } = await supabase
            .from('user_auth')
            .insert([{ email, password: hashedPassword, auth_id: authId }])
            .select('auth_id'); // Get the generated auth_id
            
            if (authError) {
            // Check for duplicate email error
            if (authError.code === '23505' && authError.message.includes('user_auth_email_key')) {
                return res.status(409).json({ success: false, message: 'User already registered. Please login.' });
            }
            console.error('❌ Error saving to user_auth table:', authError.message);
            throw new Error(authError.message);
        }

        console.log(`✅ User registered successfully with auth_id: ${authData[0].auth_id}`); // Debug log
        res.status(201).json({ success: true, message: 'User registered successfully.', auth_id: authData[0].auth_id });
    } catch (error) {
        console.error('❌ Error registering user:', error.message);
        res.status(500).json({ success: false, message: 'Failed to register user.', error: error.message });
    }
});
router.post('/login', async (req, res) => {
    let { email, password } = req.body;
    email = email.toLowerCase();
    console.log('📥 Received login request:', req.body); // Debug log

    // Validate input
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    try {
        // Check if the user is an admin
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            return res.status(200).json({
                success: true,
                role: 'admin',
                auth_id: process.env.ADMIN_AUTH_ID, // Return admin auth_id
                message: 'Admin login successful',
            });
        }

        // Handle normal user login
        const { data: user, error } = await supabase
            .from('user_auth')
            .select('id, email, password, auth_id')
            .eq('email', email)
            .single();

            console.log('🔍 User data fetched:', user); // Debug log

        if (error || !user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Return auth_id and role on successful login
        res.status(200).json({ success: true, role: 'user', auth_id: user.auth_id });
    } catch (error) {
        console.error('❌ Error during login:', error.message);
        res.status(500).json({ success: false, message: 'Failed to log in.', error: error.message });
    }
});


// Restart a bot for the logged-in user
router.post('/restart-bot/:phoneNumber', async (req, res) => {
    console.log('📥 Received request to restart bot:', JSON.stringify(req.params), JSON.stringify(req.body));
    const { phoneNumber } = req.params;
    const { authId } = req.body;

    console.log(`📥 Restarting bot for phoneNumber: ${phoneNumber}, authId: ${authId}`); // Debug log

    try {
       const bots = listSessionsFromMemory().filter(
        (bot) => String(bot.authId) === String(authId) && String(bot.phoneNumber) === String(phoneNumber)
        );
        console.log(`🔍 Found ${bots.length} bot(s) for phoneNumber: ${phoneNumber} with authId: ${authId}`); // Debug log

        if (!bots || bots.length === 0) {
            console.log(`⚠️ No bot found for phoneNumber: ${phoneNumber} with authId: ${authId}`); // Debug log
            return res.status(404).json({ success: false, message: 'Bot not found for this user.' });
        }
    
        const userId = phoneNumber;
        console.log(`🔍 Found ${bots.length} bot(s) for phoneNumber: ${phoneNumber}`); // Debug log
         await restartUserBot(userId, null, authId); // Call the restartBot function
        console.log(`✅ Bot restarted for phoneNumber: ${phoneNumber}`);
        res.status(200).json({ success: true, message: `Bot restarted successfully for ${phoneNumber}.` });
    } catch (error) {
        console.error('❌ Error restarting bot:', error.message);
        res.status(500).json({ success: false, message: 'Failed to restart bot.', error: error.message });
    }
});
// Delete a bot for the logged-in user
router.delete('/delete-bot/:phoneNumber', async (req, res) => {
    const { phoneNumber } = req.params;
    const { authId } = req.body;
    const userId = phoneNumber;

    console.log(`📥 Deleting bot for phoneNumber: ${phoneNumber}, authId: ${authId}`); // Debug log

    try {
       const bots = listSessionsFromMemory().filter(
        (bot) => String(bot.authId) === String(authId) && String(bot.phoneNumber) === String(phoneNumber)
        );

        if (!bots || bots.length === 0) {
            return res.status(404).json({ success: false, message: 'Bot not found for this user.' });
        }
        delete botInstances[userId];
        await deleteUserData(phoneNumber); // Delete the bot
        console.log(`✅ Bot deleted for phoneNumber: ${phoneNumber}`);
        res.status(200).json({ success: true, message: `Bot deleted successfully for ${phoneNumber}.` });
    } catch (error) {
        console.error('❌ Error deleting bot:', error.message);
        res.status(500).json({ success: false, message: 'Failed to delete bot.', error: error.message });
    }
});

router.post('/validate-token', async (req, res) => {
    const { authId } = req.body;

    if (!authId) {
        return res.status(400).json({ success: false, message: 'Auth ID is required.' });
    }

    try {
        const { data: token, error } = await supabase
            .from('subscription_tokens')
            .select('*')
            .eq('user_auth_id', authId)
            .single();

        if (error || !token) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
        }

        const now = new Date();
        if (new Date(token.expiration_date) < now) {
            return res.status(401).json({ success: false, message: 'Token has expired.' });
        }

        res.status(200).json({ success: true, message: 'Token is valid.' });
    } catch (error) {
        console.error('❌ Error validating token:', error.message);
        res.status(500).json({ success: false, message: 'Failed to validate token.' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    }

    try {
        // Check if user exists
        const { data: user, error } = await supabase
            .from('user_auth')
            .select('id')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        const { error: updateError } = await supabase
            .from('user_auth')
            .update({ password: hashedPassword })
            .eq('email', email);

        if (updateError) {
            throw new Error(updateError.message);
        }

        res.status(200).json({ success: true, message: 'Password reset successful.' });
    } catch (error) {
        console.error('❌ Error resetting password:', error.message);
        res.status(500).json({ success: false, message: 'Failed to reset password.' });
    }
});

module.exports = router;