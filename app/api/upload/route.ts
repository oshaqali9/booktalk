import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { supabase } from '@/lib/supabase';
import { openai } from '@/lib/openai';
import { chunkText, generateDocumentId } from '@/lib/utils';
import type { Chunk, Document } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text based on file type
    let text = '';
    let pageTexts: string[] = [];
    
    if (file.name.toLowerCase().endsWith('.pdf')) {
      const pdfData = await pdf(buffer);
      text = pdfData.text;
      // Split by page (this is a simplified approach)
      // In production, you might want more sophisticated page detection
      pageTexts = pdfData.text.split('\n\n\n').filter(p => p.trim());
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF.' }, { status: 400 });
    }

    // Generate document ID
    const documentId = generateDocumentId();

    // Process each page and create chunks
    const allChunks: Chunk[] = [];
    let chunkIndex = 0;

    for (let pageNum = 0; pageNum < pageTexts.length; pageNum++) {
      const pageText = pageTexts[pageNum];
      const pageChunks = chunkText(pageText, 800, 100);

      for (const chunkContent of pageChunks) {
        allChunks.push({
          content: chunkContent,
          page_number: pageNum + 1,
          chunk_index: chunkIndex++,
          document_id: documentId,
        });
      }
    }

    // Create embeddings for all chunks
    console.log(`Creating embeddings for ${allChunks.length} chunks...`);
    
    const chunksWithEmbeddings = await Promise.all(
      allChunks.map(async (chunk) => {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.content,
        });
        
        return {
          ...chunk,
          embedding: embeddingResponse.data[0].embedding,
        };
      })
    );

    // Store document metadata
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        filename: file.name,
        total_pages: pageTexts.length,
        total_chunks: allChunks.length,
      })
      .select()
      .single();

    if (docError) {
      console.error('Error storing document:', docError);
      return NextResponse.json({ error: 'Failed to store document' }, { status: 500 });
    }

    // Store chunks with embeddings
    const { error: chunksError } = await supabase
      .from('chunks')
      .insert(
        chunksWithEmbeddings.map(chunk => ({
          document_id: chunk.document_id,
          content: chunk.content,
          page_number: chunk.page_number,
          chunk_index: chunk.chunk_index,
          embedding: chunk.embedding,
        }))
      );

    if (chunksError) {
      console.error('Error storing chunks:', chunksError);
      return NextResponse.json({ error: 'Failed to store chunks' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      document: docData,
      message: `Successfully processed ${file.name} with ${allChunks.length} chunks`,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    );
  }
}