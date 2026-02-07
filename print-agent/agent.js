require('dotenv').config();
const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');
const ptp = require('pdf-to-printer');
const https = require('https');

// Init SDK (Server SDK)
const client = new sdk.Client();
const databases = new sdk.Databases(client);
const storage = new sdk.Storage(client);

client
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID);
// Note: If you have an API Key, set it here. For now, we assume public/JWT access or public permissions.
// .setKey('YOUR_API_KEY'); 

const DB_ID = process.env.VITE_APPWRITE_DATABASE_ID;
const COLL_ID = process.env.VITE_APPWRITE_COLLECTION_ID;
const BUCKET_ID = process.env.VITE_APPWRITE_BUCKET_ID;

console.log('🖨️  Print Agent Started (Polling Mode)...');
console.log(`Target: ${process.env.VITE_APPWRITE_ENDPOINT}`);

async function checkJobs() {
    try {
        // List documents with status 'QUEUED' (Ready to Print)
        const response = await databases.listDocuments(
            DB_ID,
            COLL_ID,
            [
                sdk.Query.equal('status', 'QUEUED')
            ]
        );

        if (response.documents.length > 0) {
            const job = response.documents[0];
            console.log(`\n📥 Found Job: ${job.$id}`);
            await processJob(job);
        }

    } catch (error) {
        // Ignore errors to keep alive
        // console.error("Polling check failed", error.message); 
    }
}

async function processJob(job) {
    try {
        // 1. Parse File Data
        let fileData = {};
        try {
            fileData = JSON.parse(job.fileData);
        } catch (e) {
            console.error("Error parsing JSON", e);
            await markFailed(job.$id);
            return;
        }

        if (!fileData.fileId) {
            console.error("No fileId");
            await markFailed(job.$id);
            return;
        }

        console.log(`⬇️  Downloading: ${fileData.name}...`);

        // 2. Download
        const arrayBuffer = await storage.getFileDownload(BUCKET_ID, fileData.fileId);
        const buffer = Buffer.from(arrayBuffer);

        const tempFilePath = path.join(__dirname, `temp_${job.$id}_${fileData.name}`);
        fs.writeFileSync(tempFilePath, buffer);

        // 3. Print
        console.log(`🖨️  Printing...`);
        await ptp.print(tempFilePath);
        console.log(`✅ Sent to Printer`);

        // 4. Update Status
        await databases.updateDocument(DB_ID, COLL_ID, job.$id, {
            status: 'COMPLETED'
        });

        // Cleanup
        fs.unlinkSync(tempFilePath);

    } catch (err) {
        console.error("Job Failed:", err);
    }
}

async function markFailed(docId) {
    try {
        await databases.updateDocument(DB_ID, COLL_ID, docId, { status: 'ERROR' });
    } catch (e) { }
}

// Poll every 1 second for faster response
setInterval(checkJobs, 1000);
checkJobs(); // Run immediately
