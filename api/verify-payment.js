import crypto from 'crypto';

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
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const skipPayment = process.env.VITE_SKIP_PAYMENT === 'true';

        if (skipPayment) {
            console.log('Skipping Razorpay signature verification (test mode)');
            return res.status(200).json({
                verified: true,
                paymentId: razorpay_payment_id || `mock_pay_${Date.now()}`,
                orderId: razorpay_order_id || `mock_order_${Date.now()}`,
            });
        }

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing payment details', verified: false });
        }

        // Verify signature using HMAC SHA256
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        const isValid = expectedSignature === razorpay_signature;

        if (isValid) {
            return res.status(200).json({
                verified: true,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
            });
        } else {
            return res.status(400).json({
                verified: false,
                error: 'Payment signature verification failed',
            });
        }
    } catch (error) {
        console.error('Payment verification failed:', error);
        return res.status(500).json({ error: 'Verification failed', verified: false });
    }
};
