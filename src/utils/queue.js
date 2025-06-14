const userQueues = new Map(); // Map to store per-user queues

const addToQueue = (userId, task) => {
    if (!userQueues.has(userId)) {
        userQueues.set(userId, []);
    }

    const queue = userQueues.get(userId);
    queue.push(task);

    // If the queue is not already being processed, start processing it
    if (queue.length === 1) {
        processQueue(userId);
    }
};

const processQueue = async (userId) => {
    const queue = userQueues.get(userId);

    while (queue.length > 0) {
        const task = queue[0]; // Get the first task in the queue

        try {
            await task(); // Execute the task (process the message)
        } catch (error) {
            console.error(`❌ Error processing task for user ${userId}:`, error);
        }

        queue.shift(); // Remove the processed task from the queue
    }

    // Remove the queue if it's empty
    if (queue.length === 0) {
        userQueues.delete(userId);
    }
};