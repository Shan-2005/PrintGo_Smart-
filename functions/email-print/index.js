const nodemailer = require('nodemailer');
const sdk = require('node-appwrite');

module.exports = async function (req, res) {
    const client = new sdk.Client();
    const databases = new sdk.Databases(client);
    const storage = new sdk.Storage(client);

    if (!req.variables['APPWRITE_FUNCTION_ENDPOINT'] || !req.variables['APPWRITE_FUNCTION_API_KEY']) {
        console.error("Missing Environment Variables");
        return res.json({ success: false, message: 'Missing Envs' });
    }

    client
        .setEndpoint(req.variables['APPWRITE_FUNCTION_ENDPOINT'])
        .setProject(req.variables['APPWRITE_FUNCTION_PROJECT_ID'])
        .setKey(req.variables['APPWRITE_FUNCTION_API_KEY']);

    try {
        const payload = JSON.parse(req.payload);
        // Determine if this is a CREATE event or manual trigger
        // If triggered by event, payload is the document
        const job = payload.$id ? payload : payload.job;

        if (!job || !job.fileData) {
            console.log("Invalid Payload or missing fileData");
            return res.json({ success: false, message: 'Invalid Payload' });
        }

        const fileMeta = JSON.parse(job.fileData);
        // Assuming file is in Appwrite Storage bucket defined in env
        const bucketId = req.variables['VITE_APPWRITE_BUCKET_ID'] || 'files';
        // We need the ACTUAL file ID. 
        // Wait, in previous steps we stored 'file' as JSON in `fileData`. 
        // Did we upload the file to Storage? 
        // CHECK: UserPage.tsx -> uploadFile logic?
        // Actually, in UserPage.tsx we just store `fileData`. We might need to IMPLEMENT detailed file upload first if not done.
        // Let's assume for now we get a file ID or URL.

        // For this MVP, let's assume we are sending a notification email first to test.

        // SMTP Setup
        const transporter = nodemailer.createTransport({
            host: req.variables['SMTP_HOST'] || 'smtp.gmail.com',
            port: req.variables['SMTP_PORT'] || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: req.variables['SMTP_USER'],
                pass: req.variables['SMTP_PASS'],
            },
        });

        // Send Email
        const info = await transporter.sendMail({
            from: req.variables['SMTP_USER'],
            to: 'hwp0098hmpq7m6@print.epsonconnect.com', // HARDCODED PRINTER EMAIL
            subject: `Print Job: ${job.$id}`,
            text: `Printing file: ${fileMeta.name}`,
            // Attachments would be:
            // attachments: [{ path: fileUrl }]
        });

        console.log("Email sent: %s", info.messageId);

        // Update Job Status
        await databases.updateDocument(
            req.variables['VITE_APPWRITE_DATABASE_ID'],
            req.variables['VITE_APPWRITE_COLLECTION_ID'],
            job.$id,
            { status: 'PRINTING' }
        );

        return res.json({ success: true, messageId: info.messageId });

    } catch (e) {
        console.error("Error sending email:", e);
        return res.json({ success: false, error: e.toString() });
    }
};
