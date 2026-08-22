/**
 * Generate poster placeholders as inline SVG data URIs.
 * Kept in sync with client/src/utils/placeholderImage.js so seeded records
 * do not depend on any external placeholder service.
 */

// SVG is XML, so titles containing &, <, > or quotes have to be escaped
const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// SVG <text> has no automatic wrapping, so split long titles into short lines
const wrapText = (text, maxCharsPerLine = 14, maxLines = 4) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    trimmed[maxLines - 1] = `${trimmed[maxLines - 1].slice(0, maxCharsPerLine - 1)}…`;
    return trimmed;
  }

  return lines;
};

const generatePlaceholderImage = (width = 500, height = 750, text = '', bgColor = '1a1a1a', textColor = 'ffffff') => {
  const label = (text || 'No Image').trim();
  const lines = wrapText(label);
  const fontSize = Math.round(Math.min(width, height) / 10);
  const lineHeight = Math.round(fontSize * 1.25);
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map((line, index) => `<tspan x="50%" y="${Math.round(startY + index * lineHeight)}">${escapeXml(line)}</tspan>`)
    .join('');

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#${bgColor}"/>`,
    `<text font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="#${textColor}" text-anchor="middle">${tspans}</text>`,
    '</svg>'
  ].join('');

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * Poster placeholder for a movie/TV show, with a colour derived from the title
 * so the same title always gets the same poster.
 */
const getPosterPlaceholder = (title, width = 500, height = 750) => {
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

  let hash = 0;
  if (title) {
    for (let i = 0; i < title.length; i++) {
      hash = ((hash << 5) - hash) + title.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
  }

  const selectedColor = colors[Math.abs(hash) % colors.length];

  return generatePlaceholderImage(width, height, title, selectedColor.bg, selectedColor.text);
};

module.exports = { generatePlaceholderImage, getPosterPlaceholder };
