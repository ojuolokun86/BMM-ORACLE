const supabase = require('../supabaseClient');

/**
 * Upload a file to Supabase Storage.
 * @param {string} bucketName - The name of the storage bucket.
 * @param {Buffer} fileBuffer - The file buffer to upload.
 * @param {string} fileName - The name to save the file as in the bucket.
 * @returns {Promise<string|null>} - The public URL of the uploaded file or null if an error occurs.
 */
const uploadFileToSupabase = async (bucketName, fileBuffer, fileName) => {
    try {
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(fileName, fileBuffer, {
                cacheControl: '3600',
                upsert: true,
            });

        if (error) {
            console.error('❌ Failed to upload file to Supabase:', error);
            return null;
        }

        console.log(`✅ File uploaded to Supabase: ${data.path}`);
        return data.path; // Return the file path
    } catch (error) {
        console.error('❌ Error uploading file to Supabase:', error);
        return null;
    }
};

/**
 * Delete a file from Supabase Storage.
 * @param {string} bucketName - The name of the storage bucket.
 * @param {string} fileName - The name of the file to delete.
 * @returns {Promise<void>}
 */
const deleteFileFromSupabase = async (bucketName, fileName) => {
    try {
        const { error } = await supabase.storage
            .from(bucketName)
            .remove([fileName]);

        if (error) {
            console.error(`❌ Failed to delete file ${fileName} from Supabase:`, error);
            return;
        }

        console.log(`🗑️ File deleted from Supabase: ${fileName}`);
    } catch (error) {
        console.error(`❌ Error deleting file ${fileName} from Supabase:`, error);
    }
};

module.exports = { uploadFileToSupabase, deleteFileFromSupabase };