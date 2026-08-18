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
        const { order_id, payment_id } = req.body || {};

        // Auto-verify (no gateway signature check)
        return res.status(200).json({
            verified: true,
            paymentId: payment_id || `pay_${Date.now()}`,
            orderId: order_id || `order_${Date.now()}`,
        });
    } catch (error) {
        console.error('Payment verification failed:', error);
        return res.status(500).json({ error: 'Verification failed', verified: false });
    }
}
