/**
 * Generate a placeholder image URL using a local data URI or fallback service
 * This avoids external API dependencies and CORS issues
 */
export const generatePlaceholderImage = (width = 300, height = 450, text = '', bgColor = '1a1a1a', textColor = 'ffffff') => {
  // Remove spaces and encode text
  const encodedText = encodeURIComponent(text || 'No Image');
  
  // Create SVG as data URI for perfect placeholder without external requests
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#${bgColor}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="${Math.min(width, height) / 8}px" 
        font-weight="bold" 
        fill="#${textColor}" 
        text-anchor="middle" 
        dominant-baseline="middle"
        style="word-wrap: break-word;"
      >
        ${text || 'No Image'}
      </text>
    </svg>
  `.trim().replace(/\s+/g, ' ');
  
  // Convert to data URI
  const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  
  return dataUri;
};

/**
 * Get a placeholder image URL for a movie/TV show
 */
export const getMoviePlaceholder = (title, width = 300, height = 450) => {
  // Generate colors based on title hash for variety
  const colors = [
    { bg: '1a1a1a', text: 'ffffff' }, // Dark
    { bg: '0f0f23', text: 'ffffff' }, // Dark blue
    { bg: '2d1b1b', text: 'ffffff' }, // Dark red
    { bg: '1a2332', text: 'ffffff' }, // Dark teal
    { bg: '2c1810', text: 'ffffff' }, // Dark brown
    { bg: '2d4a2d', text: 'ffffff' }, // Dark green
    { bg: '0d0d0d', text: '00ff00' }, // Very dark with green text
    { bg: '1a0f0f', text: 'ffffff' }, // Dark maroon
    { bg: '0d1a0d', text: 'ffffff' }, // Dark forest
    { bg: '2d1b0d', text: 'ffffff' }, // Dark orange
    { bg: '1a0d0d', text: 'ffffff' }, // Very dark red
    { bg: '1a0f0a', text: 'ffffff' }, // Dark purple-brown
  ];
  
  // Use title to pick a consistent color
  let hash = 0;
  if (title) {
    for (let i = 0; i < title.length; i++) {
      hash = ((hash << 5) - hash) + title.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
  }
  
  const colorIndex = Math.abs(hash) % colors.length;
  const selectedColor = colors[colorIndex];
  
  return generatePlaceholderImage(width, height, title, selectedColor.bg, selectedColor.text);
};

/**
 * Handle image loading errors by providing a fallback placeholder
 */
export const handleImageError = (event, title) => {
  if (event.target.src && event.target.src.startsWith('data:')) {
    // Already using placeholder, don't replace
    return;
  }
  
  // Replace with placeholder
  event.target.src = getMoviePlaceholder(title || 'Image');
  event.target.onerror = null; // Prevent infinite loop
};

