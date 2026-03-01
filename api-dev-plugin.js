/**
 * Vite plugin that serves the /api/ routes locally during development.
 * In production (Vercel), these are handled by serverless functions in /api/.
 * This plugin loads the same handler files and calls them with mock req/res objects.
 */
import Razorpay from 'razorpay';
import crypto from 'crypto';

export function apiDevPlugin(env) {
    return {
        name: 'api-dev-server',
        configureServer(server) {
            // POST /api/create-order
            server.middlewares.use('/api/create-order', async (req, res) => {
                console.log(`[API] ${req.method} ${req.url}`);
                if (req.method === 'OPTIONS') {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    res.statusCode = 200;
                    res.end();
                    return;
                }

                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                    return;
                }

                try {
                    const body = await parseBody(req);
                    const { amount, currency = 'INR', receipt } = body;

                    if (!amount || amount <= 0) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Invalid amount' }));
                        return;
                    }

                    const razorpay = new Razorpay({
                        key_id: env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID,
                        key_secret: env.RAZORPAY_KEY_SECRET,
                    });

                    const order = await razorpay.orders.create({
                        amount: Math.round(amount * 100), // paise
                        currency,
                        receipt: receipt || `printgo_${Date.now()}`,
                    });

                    console.log('✅ Order created:', order.id);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        orderId: order.id,
                        amount: order.amount,
                        currency: order.currency,
                    }));
                } catch (error) {
                    console.error('❌ Order creation failed:', error.message);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Failed to create order: ' + error.message }));
                }
            });

            // POST /api/verify-payment
            server.middlewares.use('/api/verify-payment', async (req, res) => {
                console.log(`[API] ${req.method} ${req.url}`);
                if (req.method === 'OPTIONS') {
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    res.statusCode = 200;
                    res.end();
                    return;
                }

                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                    return;
                }

                try {
                    const body = await parseBody(req);
                    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

                    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                        res.statusCode = 400;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: 'Missing payment details', verified: false }));
                        return;
                    }

                    const secret = env.RAZORPAY_KEY_SECRET;
                    const expectedSignature = crypto
                        .createHmac('sha256', secret)
                        .update(razorpay_order_id + '|' + razorpay_payment_id)
                        .digest('hex');

                    const isValid = expectedSignature === razorpay_signature;

                    res.statusCode = isValid ? 200 : 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                        verified: isValid,
                        paymentId: isValid ? razorpay_payment_id : undefined,
                        orderId: isValid ? razorpay_order_id : undefined,
                        error: isValid ? undefined : 'Signature verification failed',
                    }));
                } catch (error) {
                    console.error('❌ Verification failed:', error.message);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Verification failed', verified: false }));
                }
            });
        },
    };
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}
