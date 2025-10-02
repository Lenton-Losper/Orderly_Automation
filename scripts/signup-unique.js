// Simple helper to sign up with a unique email for testing
const axios = require('axios');

(async () => {
  try {
    const timestamp = Date.now();
    const email = `test+${timestamp}@example.com`;

    const payload = {
      email,
      password: 'testpassword123',
      businessName: `Test Biz ${timestamp}`
    };

    const res = await axios.post('http://localhost:3001/auth/signup', payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(JSON.stringify({ status: res.status, data: res.data }, null, 2));
  } catch (err) {
    if (err.response) {
      console.log(JSON.stringify({ status: err.response.status, data: err.response.data }, null, 2));
    } else {
      console.error('Request failed:', err.message);
      process.exit(1);
    }
  }
})();



