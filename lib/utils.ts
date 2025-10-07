// Token estimation (rough approximation)
export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

// Text chunking with overlap
export function chunkText(
  text: string,
  maxTokens: number = 800,
  overlap: number = 100
): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (const word of words) {
    const wordTokens = estimateTokens(word);
    
    if (currentTokens + wordTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      
      // Keep the last few words for overlap
      const overlapWords = [];
      let overlapTokens = 0;
      
      for (let i = currentChunk.length - 1; i >= 0 && overlapTokens < overlap; i--) {
        const token = currentChunk[i];
        overlapTokens += estimateTokens(token);
        overlapWords.unshift(token);
      }
      
      currentChunk = overlapWords;
      currentTokens = overlapTokens;
    }
    
    currentChunk.push(word);
    currentTokens += wordTokens;
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks;
}

// Generate a unique document ID
export function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}