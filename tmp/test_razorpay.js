
import Razorpay from 'razorpay';

const rzp = new Razorpay({
    key_id: 'rzp_test_SMGbYtZZW1QoBd',
    key_secret: 'Sfxyl3OoK5W9xxJ47LWJ8wwd',
});

async function testCredentials() {
    console.log('Testing Razorpay Credentials...');
    try {
        // Attempt to list orders (minimal permission required usually)
        const orders = await rzp.orders.all({ count: 1 });
        console.log('✅ Success! Credentials are valid.');
        console.log('Recent Orders count:', orders.items.length);
    } catch (error) {
        console.error('❌ Error testing credentials:', error.message || error);
        if (error.error && error.error.description) {
            console.error('Description:', error.error.description);
        }
    }
}

testCredentials();
