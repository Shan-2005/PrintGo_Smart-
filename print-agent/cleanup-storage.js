require('dotenv').config();
const sdk = require('node-appwrite');

// Init SDK
const client = new sdk.Client();
const storage = new sdk.Storage(client);

client
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID);

const BUCKET_ID = process.env.VITE_APPWRITE_BUCKET_ID;

async function deleteAllFiles() {
    try {
        console.log('🗑️  Fetching all files from Appwrite storage...');

        // List all files in the bucket
        const response = await storage.listFiles(BUCKET_ID);
        const files = response.files;

        console.log(`Found ${files.length} files to delete`);

        if (files.length === 0) {
            console.log('✅ No files to delete');
            return;
        }

        // Delete each file
        for (const file of files) {
            try {
                console.log(`Deleting: ${file.name} (${file.$id})`);
                await storage.deleteFile(BUCKET_ID, file.$id);
                console.log(`✅ Deleted: ${file.name}`);
            } catch (err) {
                console.error(`❌ Failed to delete ${file.name}:`, err.message);
            }
        }

        console.log('\n🎉 Cleanup complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

deleteAllFiles();
