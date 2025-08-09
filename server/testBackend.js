const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5001/api';

const testBackend = async () => {
  console.log('🧪 Testing NKMovieHUB Backend...\n');

  try {
    // Test health check
    console.log('1. Testing health check...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.message);
    console.log('   Status:', healthData.status);
    console.log('   Database:', healthData.database);
    console.log('');

    // Test admin login
    console.log('2. Testing admin login...');
    const adminLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
              body: JSON.stringify({
          email: 'admin@gmail.com',
          password: '123456'
        }),
    });
    
    const adminLoginData = await adminLoginResponse.json();
    
    if (adminLoginData.success) {
      console.log('✅ Admin login successful');
      console.log('   User:', adminLoginData.data.user.name);
      console.log('   Role:', adminLoginData.data.user.role);
      console.log('   Redirect to:', adminLoginData.data.redirectTo);
      console.log('   Token received:', adminLoginData.data.token ? 'Yes' : 'No');
    } else {
      console.log('❌ Admin login failed:', adminLoginData.message);
    }
    console.log('');

    // Test regular user login
    console.log('3. Testing regular user login...');
    const userLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'user@gmail.com',
        password: '123456'
      }),
    });
    
    const userLoginData = await userLoginResponse.json();
    
    if (userLoginData.success) {
      console.log('✅ User login successful');
      console.log('   User:', userLoginData.data.user.name);
      console.log('   Role:', userLoginData.data.user.role);
      console.log('   Redirect to:', userLoginData.data.redirectTo);
      console.log('   Token received:', userLoginData.data.token ? 'Yes' : 'No');
    } else {
      console.log('❌ User login failed:', userLoginData.message);
    }
    console.log('');

    // Test invalid login
    console.log('4. Testing invalid login...');
    const invalidLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid@email.com',
        password: 'wrongpassword'
      }),
    });
    
    const invalidLoginData = await invalidLoginResponse.json();
    
    if (!invalidLoginData.success) {
      console.log('✅ Invalid login properly rejected');
      console.log('   Message:', invalidLoginData.message);
    } else {
      console.log('❌ Invalid login should have been rejected');
    }
    console.log('');

    console.log('🎯 Backend testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running on port 5001');
    console.log('   Run: npm run dev');
  }
};

// Run the test
testBackend(); 