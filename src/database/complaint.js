const supabase = require('../supabaseClient');

/**
 * Add a complaint to the database.
 * @param {string} authId - The Auth ID of the user submitting the complaint.
 * @param {string} message - The complaint message.
 */
const addComplaint = async (authId, message) => {
    const { data, error } = await supabase
        .from('complaints')
        .insert([{ auth_id: authId, message, timestamp: new Date().toISOString() }]);

    if (error) {
        console.error('❌ Error adding complaint to database:', error.message);
        throw new Error('Failed to add complaint.');
    }

    console.log('✅ Complaint added to database:', data);
};

/**
 * Get all complaints from the database.
 * @returns {Array} - An array of complaints.
 */
const getAllComplaints = async () => {
    const { data, error } = await supabase
        .from('complaints')
        .select('auth_id, message, timestamp') // Include auth_id in the selection
        .order('timestamp', { ascending: false });

    if (error) {
        console.error('❌ Error fetching complaints from database:', error.message);
        throw new Error('Failed to fetch complaints.');
    }

    return data;
};

module.exports = { addComplaint, getAllComplaints };