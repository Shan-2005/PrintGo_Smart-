
import { Client, Databases } from 'appwrite';

const client = new Client();

client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const databases = new Databases(client);

// Test connection
client.ping().then(() => {
    console.log('Appwrite Connected Successfully');
}).catch((error) => {
    console.error('Appwrite Connection Failed:', error);
});

export default client;
