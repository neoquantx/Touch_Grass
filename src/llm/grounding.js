export function isGrounded(output, tagLines) {
  const numberRegex = /\b\d{3,}\b/g;
  const numbers = output.match(numberRegex) || [];
  
  const tagText = tagLines.join('\n').toLowerCase();
  
  for (const num of numbers) {
    if (!tagText.includes(num)) {
      return false;
    }
  }
  
  const hasHistoryWords = ['built in', 'founded', 'established', 'dating back'].some(w => output.toLowerCase().includes(w));
  if (hasHistoryWords) {
    const hasDateLike = tagLines.some(line => {
      const l = line.toLowerCase();
      return l.includes('start_date') || l.includes('date') || l.includes('year');
    });
    if (!hasDateLike) {
      return false;
    }
  }
  
  return true;
}

export function clampSentences(text, max) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, max).join(' ').replace(/\s+/g, ' ').trim();
}
