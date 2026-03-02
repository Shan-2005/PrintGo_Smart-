import Razorpay from 'razorpay';

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
                // Keep as string if parsing fails, let validation catch it
            }
        }

        const { amount, currency = 'INR', receipt } = bodyPayload || {};

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount or missing body' });
        }

        const key_id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_KEY_SECRET;
        const skipPayment = process.env.VITE_SKIP_PAYMENT === 'true';

        if (skipPayment) {
            console.log('Skipping Razorpay order creation (test mode)');
            return res.status(200).json({
                orderId: `mock_order_${Date.now()}`,
                amount: Math.round(amount * 100),
                currency: currency,
            });
        }

        if (!key_id || !key_secret) {
            console.error('CRITICAL: Razorpay keys are missing in Vercel environment variables.');
            return res.status(500).json({ error: 'Server misconfiguration: Payment gateway unavailable' });
        }

        const razorpay = new Razorpay({
            key_id,
            key_secret,
        });

        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100), // Razorpay expects amount in paise
            currency,
            receipt: receipt || `printgo_${Date.now()}`,
        });

        return res.status(200).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        });
    } catch (error) {
        console.error('Razorpay order creation failed:', error);
        return res.status(500).json({ error: 'Failed to create order' });
    }
};
