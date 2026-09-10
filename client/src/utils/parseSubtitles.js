/**
 * Parse SRT / simple WebVTT into cue objects for the manual subtitle overlay.
 * @returns {{ startMs: number, endMs: number, text: string }[]}
 */

const TIME_TOKEN =
  /(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})|(\d{1,2}):(\d{2})[.,](\d{1,3})/;

const parseTimestamp = (raw = '') => {
  const value = String(raw).trim();
  const match = value.match(TIME_TOKEN);
  if (!match) return null;

  if (match[1] !== undefined) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const frac = match[4].padEnd(3, '0').slice(0, 3);
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + Number(frac);
  }

  const minutes = Number(match[5]);
  const seconds = Number(match[6]);
  const frac = match[7].padEnd(3, '0').slice(0, 3);
  return (minutes * 60 + seconds) * 1000 + Number(frac);
};

const stripTags = (text = '') =>
  String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .trim();

const splitBlocks = (raw = '') =>
  String(raw)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

const isTimingLine = (line = '') => /-->/.test(line);

const parseTimingLine = (line = '') => {
  const parts = String(line).split('-->');
  if (parts.length < 2) return null;
  const startMs = parseTimestamp(parts[0]);
  const endRaw = String(parts[1] || '')
    .trim()
    .split(/\s+/)[0];
  const endMs = parseTimestamp(endRaw || '');
  if (startMs == null || endMs == null || endMs <= startMs) return null;
  return { startMs, endMs };
};

export const parseSubtitles = (raw = '') => {
  const blocks = splitBlocks(raw);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trimEnd());
    if (!lines.length) continue;

    const first = lines[0].trim();
    if (/^WEBVTT/i.test(first) || /^NOTE\b/i.test(first) || /^STYLE\b/i.test(first)) {
      continue;
    }

    const timingIndex = lines.findIndex((line) => isTimingLine(line));
    if (timingIndex < 0) continue;

    const timing = parseTimingLine(lines[timingIndex]);
    if (!timing) continue;

    const textLines = lines
      .slice(timingIndex + 1)
      .map(stripTags)
      .filter(Boolean);

    if (!textLines.length) continue;

    cues.push({
      startMs: timing.startMs,
      endMs: timing.endMs,
      text: textLines.join('\n')
    });
  }

  return cues.sort((a, b) => a.startMs - b.startMs);
};

export default parseSubtitles;
