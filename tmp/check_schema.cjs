
const sdk = require('node-appwrite');
require('dotenv').config({ path: '../.env' });

const client = new sdk.Client();
const databases = new sdk.Databases(client);

const DB_ID = "6986ce080036e1bb2059";
const COLL_ID = "printgo_db";

client
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1")
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || "6986c8a8001fcf92431f");

async function checkSchema() {
    try {
        console.log('Fetching latest job to inspect schema...');
        const response = await databases.listDocuments(DB_ID, COLL_ID, [
            sdk.Query.orderDesc('$createdAt'),
            sdk.Query.limit(1)
        ]);

        if (response.documents.length > 0) {
            const doc = response.documents[0];
            console.log('✅ Found latest job:');
            // Remove system fields for cleaner output
            const { $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions, ...data } = doc;
            console.log(JSON.stringify(data, null, 2));

            // Log types
            console.log('\nField Types:');
            for (const key in data) {
                console.log(`${key}: ${typeof data[key]}`);
            }
        } else {
            console.log('❌ No jobs found in the collection.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkSchema();
