const fetch = require('node-fetch');

// Test script to verify the API endpoint
async function testAPI() {
  try {
    console.log('Testing API endpoint...');
    
    // Test the movies endpoint
    const response = await fetch('http://localhost:5001/api/movies');
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (response.ok) {
      const result = await response.json();
      console.log('API is working. Found', result.data?.movies?.length || 0, 'movies');
    } else {
      console.error('API test failed');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testAPI();
