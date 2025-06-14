const dotenv = require('dotenv');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '../../.env');
console.log(`🔍 Loading .env file from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('❌ Failed to load .env file. Please ensure it exists in the root directory.');
    process.exit(1); // Exit the application if .env fails to load
}



// Validate required environment variables
const requiredEnvVars = ['ADMIN_NUMBER'];
requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1); // Exit the application if a required variable is missing
    }
});

console.log('✅ Environment variables loaded successfully.');

module.exports = process.env;