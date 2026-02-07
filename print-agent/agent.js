require('dotenv').config();
const { Client, Databases, Storage } = require('appwrite');
const fs = require('fs');
const path = require('path');
const ptp = require('pdf-to-printer');

// Init SDK
const client = new Client();
const databases = new Databases(client);
const storage = new Storage(client);

client
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID);

const DB_ID = process.env.VITE_APPWRITE_DATABASE_ID;
const COLL_ID = process.env.VITE_APPWRITE_COLLECTION_ID;
const BUCKET_ID = process.env.VITE_APPWRITE_BUCKET_ID;

console.log('🖨️  Print Agent Started...');
console.log(`Listening on: ${process.env.VITE_APPWRITE_ENDPOINT}`);

// Subscribe to Realtime
const unsubscribe = client.subscribe(
    `databases.${DB_ID}.collections.${COLL_ID}.documents`,
    async (response) => {
        const job = response.payload;

        // Only process new jobs that are PENDING
        if (job.status === 'PENDING') {
            const eventType = response.events[0]; // e.g., databases.*.create
            if (!eventType.includes('.create') && !eventType.includes('.update')) return;

            console.log(`\n📥 New Job Received: ${job.$id}`);

            try {
                let fileData = {};
                try {
                    fileData = JSON.parse(job.fileData);
                } catch (e) {
                    console.error("Error parsing fileData JSON");
                    return;
                }

                if (!fileData.fileId) {
                    console.error("❌ No fileId found in job data.");
                    return;
                }

                console.log(`⬇️  Downloading File: ${fileData.name} (${fileData.fileId})...`);

                // Get Download URL
                const arrayBuffer = await storage.getFileDownload(BUCKET_ID, fileData.fileId);
                const buffer = Buffer.from(arrayBuffer);

                // Save to Temp File
                const tempFilePath = path.join(__dirname, `temp_${job.$id}_${fileData.name}`);
                fs.writeFileSync(tempFilePath, buffer);
                console.log(`💾 Saved to: ${tempFilePath}`);

                // Print
                console.log(`🖨️  Sending to Printer...`);

                await ptp.print(tempFilePath)
                    .then(() => console.log('✅ Sent to printer queue'))
                    .catch(e => {
                        console.error('❌ Printing failed:', e);
                        throw e;
                    });

                // Update Status to COMPLETED
                await databases.updateDocument(DB_ID, COLL_ID, job.$id, {
                    status: 'COMPLETED'
                });
                console.log(`✅ Job Marked as COMPLETED`);

                // Cleanup
                fs.unlinkSync(tempFilePath);

            } catch (err) {
                console.error(`❌ Error processing job:`, err);
            }
        }
    }
);
