import { Client, Databases, Storage, Account } from 'appwrite';

const client = new Client();

// Central Configuration with fallbacks
export const APPWRITE_CONFIG = {
    ENDPOINT: import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
    PROJECT_ID: import.meta.env.VITE_APPWRITE_PROJECT_ID || '6986c8a8001fcf92431f',
    DATABASE_ID: import.meta.env.VITE_APPWRITE_DATABASE_ID || '6986ce080036e1bb2059',
    COLLECTION_ID: import.meta.env.VITE_APPWRITE_COLLECTION_ID || 'printgo_db',
    BUCKET_ID: import.meta.env.VITE_APPWRITE_BUCKET_ID || 'print_files',
};

client
    .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
    .setProject(APPWRITE_CONFIG.PROJECT_ID);

export const databases = new Databases(client);
export const storage = new Storage(client);
export const account = new Account(client);

export const ensureSession = async () => {
    try {
        await account.get();
        console.log("[Appwrite] Active session found");
    } catch (err) {
        console.log("[Appwrite] No session, creating anonymous session...");
        await account.createAnonymousSession();
    }
};

export default client;
