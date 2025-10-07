import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@/lib/openai';
import type { Citation } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { question, documentId } = await request.json();

    if (!question) {
      return NextResponse.json({ error: 'No question provided' }, { status: 400 });
    }

    // Create embedding for the question
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });

    const questionEmbedding = embeddingResponse.data[0].embedding;

    // Search for relevant chunks
    const { data: chunks, error: searchError } = await supabase
      .rpc('search_chunks', {
        query_embedding: questionEmbedding,
        match_count: 5,
        filter_document_id: documentId || null,
      });

    if (searchError) {
      console.error('Search error:', searchError);
      return NextResponse.json({ error: 'Failed to search chunks' }, { status: 500 });
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find any relevant information to answer your question.",
        citations: [],
      });
    }

    // Prepare context from chunks
    const context = chunks
      .map((chunk, i) => `[Page ${chunk.page_number}]: ${chunk.content}`)
      .join('\n\n');

    // Generate answer using GPT-4
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions based on the provided context from a document. 
Always cite the page numbers when referencing information. If the context doesn't contain enough information to answer the question, say so.
Format your citations as [Page X] inline with your answer.`,
        },
        {
          role: 'user',
          content: `Context from the document:\n\n${context}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const answer = completion.choices[0].message.content || 'Unable to generate an answer.';

    // Extract citations from chunks
    const citations: Citation[] = chunks.map(chunk => ({
      page: chunk.page_number,
      text: chunk.content.substring(0, 150) + '...',
    }));

    return NextResponse.json({
      answer,
      citations,
    });

  } catch (error) {
    console.error('Ask error:', error);
    return NextResponse.json(
      { error: 'Failed to process question' },
      { status: 500 }
    );
  }
}