export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        let bodyPayload = req.body;
        if (typeof req.body === 'string') {
            try {
                bodyPayload = JSON.parse(req.body);
            } catch (e) {
                // Keep as string if parsing fails
            }
        }

        const { amount, currency = 'INR', receipt } = bodyPayload || {};

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount or missing body' });
        }

        // Return a mock order (no payment gateway)
        return res.status(200).json({
            orderId: `order_${Date.now()}`,
            amount: Math.round(amount * 100),
            currency,
            receipt: receipt || `printgo_${Date.now()}`,
        });
    } catch (error) {
        console.error('Order creation failed:', error);
        return res.status(500).json({ error: 'Failed to create order' });
    }
}
