
require('dotenv').config({ path: './.env' });
const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');

const client = new sdk.Client();
const databases = new sdk.Databases(client);
const storage = new sdk.Storage(client);

client
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID);

const DB_ID = process.env.VITE_APPWRITE_DATABASE_ID;
const COLL_ID = process.env.VITE_APPWRITE_COLLECTION_ID;
const BUCKET_ID = process.env.VITE_APPWRITE_BUCKET_ID;

async function createTestPrint(imagePath) {
    try {
        console.log("🚀 Starting Test Print Job Creation...");

        // 1. Upload file
        const file = await storage.createFile(
            BUCKET_ID,
            sdk.ID.unique(),
            sdk.InputFile.fromPath(imagePath, path.basename(imagePath))
        );
        console.log(`✅ File uploaded: ${file.$id}`);

        // 2. Create job document
        const jobData = {
            id: sdk.ID.unique(),
            fileData: JSON.stringify({
                fileId: file.$id,
                name: path.basename(imagePath),
                type: 'image/png'
            }),
            settings: JSON.stringify({
                colorMode: 'COLOR',
                paperSize: 'A4',
                copies: 1
            }),
            status: 'QUEUED', // This triggers the agent
            createdAt: new Date().toISOString(),
            kioskId: 'test_kiosk'
        };

        const doc = await databases.createDocument(DB_ID, COLL_ID, sdk.ID.unique(), jobData);
        console.log(`✅ Print job created: ${doc.$id}`);
        console.log("🔍 Check the print agent console for activity!");

    } catch (error) {
        console.error("❌ Test Print Failed:", error);
    }
}

// Get the latest generated image from artifacts if possible, or use a placeholder
const imagePath = process.argv[2];
if (imagePath) {
    createTestPrint(imagePath);
} else {
    console.log("Please provide an image path: node test_print.js <path_to_image>");
}
