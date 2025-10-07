export interface Chunk {
  id?: string;
  content: string;
  page_number: number;
  chunk_index: number;
  document_id: string;
  embedding?: number[];
}

export interface Document {
  id: string;
  filename: string;
  uploaded_at: string;
  total_pages: number;
  total_chunks: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export interface Citation {
  page: number;
  text: string;
}