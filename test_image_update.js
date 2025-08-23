const fs = require('fs');
const path = require('path');

// Test script to verify image update functionality
async function testImageUpdate() {
  try {
    // Read a test image file and convert to base64
    const testImagePath = path.join(__dirname, 'test_image.jpg');
    
    // Check if test image exists
    if (!fs.existsSync(testImagePath)) {
      console.log('Test image not found. Please create a test_image.jpg file in the server directory.');
      return;
    }
    
    const imageBuffer = fs.readFileSync(testImagePath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    
    console.log('Test image converted to base64. Length:', base64Image.length);
    console.log('Starts with data:image/:', base64Image.startsWith('data:image/'));
    
    // Test the API endpoint
    const response = await fetch('http://localhost:5001/api/movies/TEST_MOVIE_ID/update-admin-fields', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      body: JSON.stringify({
        imageFile: base64Image
      })
    });
    
    console.log('Response status:', response.status);
    const result = await response.json();
    console.log('Response:', result);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testImageUpdate();
