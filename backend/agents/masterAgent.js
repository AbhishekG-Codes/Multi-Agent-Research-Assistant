import { ChatOllama } from '@langchain/ollama';
import { Command } from '@langchain/langgraph';
import { config } from '../config.js';
import { searchMetadata, vectorSearch } from '../db/mongoClient.js';
import { generateEmbedding } from '../utils/embeddings.js';
import { createQueryMetadataPrompt } from '../prompts/metadataExtraction.js';

/**
 * Create Ollama chat model
 */
function createChatModel() {
  return new ChatOllama({
    model: config.ollama.model,
    baseUrl: config.ollama.baseUrl,
    temperature: 0.7,
  });
}

/**
 * Parse user query to extract metadata using AI
 * @param {string} query - User query
 * @returns {Promise<Object>} Extracted metadata {topic, exercise, metric}
 */
async function parseQueryMetadata(query) {
  const model = new ChatOllama({
    model: config.ollama.model,
    baseUrl: config.ollama.baseUrl,
    temperature: 0,
    format: 'json',
  });

  const prompt = createQueryMetadataPrompt(query);

  try {
    const response = await model.invoke(prompt);
    const metadata = JSON.parse(response.content);

    console.log('🔍 Parsed query metadata:', metadata);

    return {
      topic: metadata.topic || '',
      exercise: metadata.exercise || '',
      metric: metadata.metric || '',
    };
  } catch (error) {
    console.error('Error parsing query metadata:', error.message);
    return { topic: '', exercise: '', metric: '' };
  }
}

/**
 * Generate answer from retrieved chunks
 * @param {string} query - User query
 * @param {Array} chunks - Retrieved chunks
 * @returns {Promise<string>} Generated answer with citations
 */
async function generateAnswer(query, chunks) {
  if (!chunks || chunks.length === 0) {
    return 'No relevant information found in the database.';
  }

  const model = createChatModel();

  // Build context from chunks
  const context = chunks
    .map((chunk, idx) => {
      const source = chunk.metadata.source === 'pdf' 
        ? `[${idx + 1}] ${chunk.filename} (page ${chunk.metadata.pageNumber})`
        : `[${idx + 1}] ${chunk.filename}`;
      return `${source}\n${chunk.content}\n`;
    })
    .join('\n---\n\n');

  const prompt = `Answer the user's question based on the following document excerpts. 
Include citations using [1], [2], etc. to reference specific sources.

DOCUMENT EXCERPTS:
${context}

USER QUESTION:
${query}

Provide a clear, concise answer based on the documents. Include relevant citations.`;

  try {
    const response = await model.invoke(prompt);
    return response.content;
  } catch (error) {
    console.error('Error generating answer:', error.message);
    return 'Error generating answer. Please try again.';
  }
}

/**
 * Format source citations
 * @param {Array} chunks - Retrieved chunks
 * @returns {Array} Formatted sources
 */
function formatSources(chunks) {
  return chunks.map((chunk, idx) => ({
    id: idx + 1,
    filename: chunk.filename,
    snippet: chunk.content,
    metadata: chunk.metadata,
    source: chunk.metadata.source,
    page: chunk.metadata.source === 'pdf' ? chunk.metadata.pageNumber : null,
    url: chunk.metadata.url || null,
  }));
}

/**
 * Master Agent node - handles query, metadata-first retrieval
 * @param {Object} state - Current system state
 * @returns {Promise<Object>} Updated state or Command
 */
export async function masterAgentNode(state) {
  console.log('\n🎯 Master Agent activated');

  try {
    const query = state.userQuery;

    // If we already have an answer, return it
    if (state.finalAnswer) {
      return {
        currentAgent: 'masterAgent',
        agentStatus: 'Answer ready',
      };
    }

    // Step 1: Parse query to extract metadata
    console.log('   Step 1: Parsing query metadata...');
    const metadata = await parseQueryMetadata(query);
    
    // Step 2: Search by metadata FIRST (metadata-first approach)
    console.log('   Step 2: Searching metadata DB...');
    const metadataResults = await searchMetadata(metadata);

    // Step 3: Check if we found relevant content
    if (metadataResults.length > 0) {
      console.log(`   ✅ Found ${metadataResults.length} chunks via metadata`);

      // ALWAYS compute relevance scores to verify chunks are actually relevant
      console.log('   Computing relevance scores...');
      const queryEmbedding = await generateEmbedding(query);
      const { computeCosineSimilarity } = await import('../utils/embeddings.js');
      
      const rankedChunks = metadataResults
        .map((chunk) => ({
          ...chunk,
          score: computeCosineSimilarity(queryEmbedding, chunk.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, config.vectorSearch.topK);
      
      // Check if top chunks are actually relevant
      const RELEVANCE_THRESHOLD = 0.6;
      const topScore = rankedChunks[0]?.score || 0;
      const avgScore = rankedChunks.reduce((sum, c) => sum + c.score, 0) / rankedChunks.length;
      
      console.log(`   Top ${rankedChunks.length} scores: [${rankedChunks.map(c => c.score.toFixed(3)).join(', ')}]`);
      console.log(`   Top: ${topScore.toFixed(3)}, Avg: ${avgScore.toFixed(3)} (threshold: ${RELEVANCE_THRESHOLD})`);
      
      if (topScore >= RELEVANCE_THRESHOLD) {
        // Chunks are semantically relevant, use them
        console.log(`   ✅ Chunks are relevant (score ${topScore.toFixed(3)} >= ${RELEVANCE_THRESHOLD})`);
        
        const finalChunks = rankedChunks;

        // Detect source type from chunks
        const hasWebSource = finalChunks.some(c => c.metadata?.source === 'web');
        const detectedMethod = hasWebSource ? 'web' : 'pdf';

        // Step 4: Generate answer with citations
        console.log('   Step 3: Generating answer...');
        const answer = await generateAnswer(query, finalChunks);
        const sources = formatSources(finalChunks);

        return {
          foundInDB: true,
          retrievedChunks: finalChunks,
          finalAnswer: answer,
          parsedMetadata: metadata,
          searchMethod: detectedMethod,
          currentAgent: 'masterAgent',
          agentStatus: 'Answer generated',
          messages: [
            ...state.messages,
            {
              role: 'assistant',
              content: answer,
              sources: sources,
            },
          ],
        };
      } else {
        // Metadata found chunks but they're not semantically relevant
        console.log(`   ❌ Chunks not relevant (score ${topScore.toFixed(3)} < ${RELEVANCE_THRESHOLD})`);
        console.log('   Treating as "not found" and routing to web search...');
      }
    }
    
    // No metadata results OR metadata results not relevant - try vector search
    console.log('   ❌ No relevant chunks from metadata search');
    console.log('   Step 2b: Falling back to vector search...');
    
    try {
      const queryEmbedding = await generateEmbedding(query);
      const vectorResults = await vectorSearch(queryEmbedding, config.vectorSearch.topK);
      
      if (vectorResults.length > 0) {
        // Check relevance of vector search results too
        const { computeCosineSimilarity: cosSim } = await import('../utils/embeddings.js');
        const topVectorScore = vectorResults[0].score || 
          cosSim(queryEmbedding, vectorResults[0].embedding);
        
        console.log(`   Vector search top score: ${topVectorScore.toFixed(3)} (threshold: 0.6)`);
        
        if (topVectorScore >= 0.6) {
          console.log(`   ✅ Found ${vectorResults.length} relevant chunks via vector search`);
          
          // Detect source type from chunks
          const hasWebSrc = vectorResults.some(c => c.metadata?.source === 'web');
          const vecMethod = hasWebSrc ? 'web' : 'pdf';
          
          // Step 4: Generate answer with citations
          console.log('   Step 3: Generating answer...');
          const answer = await generateAnswer(query, vectorResults);
          const sources = formatSources(vectorResults);

          return {
            foundInDB: true,
            retrievedChunks: vectorResults,
            finalAnswer: answer,
            parsedMetadata: metadata,
            searchMethod: vecMethod,
            currentAgent: 'masterAgent',
            agentStatus: 'Answer generated (vector search)',
            messages: [
              ...state.messages,
              {
                role: 'assistant',
                content: answer,
                sources: sources,
              },
            ],
          };
        } else {
          console.log(`   ❌ Vector search results not relevant (${topVectorScore.toFixed(3)} < 0.6)`);
        }
      }
    } catch (error) {
      console.error('❌ Vector search error:', error.message);
    }
    
    // Check if we already tried the Sub Agent
    if (state.subAgentInvoked) {
      console.log('   Sub Agent already invoked, no more data available');
      
      return {
        foundInDB: false,
        finalAnswer: 'I could not find any relevant information in the database or through web search. Please try uploading relevant documents or rephrasing your question.',
        currentAgent: 'masterAgent',
        agentStatus: 'No data available',
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: 'I could not find any relevant information in the database or through web search. Please try uploading relevant documents or rephrasing your question.',
            sources: [],
          },
        ],
      };
    }
    
    // First time - route to Sub Agent for ingestion
    console.log('   Routing to Sub Agent for ingestion...');

    return new Command({
      goto: 'subAgent',
      update: {
        parsedMetadata: metadata,
        foundInDB: false,
        subAgentInvoked: true,
        currentAgent: 'subAgent',
        agentStatus: 'Sub Agent ingesting new data...',
      },
    });
  } catch (error) {
    console.error('❌ Master Agent error:', error.message);
    return {
      error: error.message,
      finalAnswer: 'Error processing query. Please try again.',
      currentAgent: 'masterAgent',
      agentStatus: 'Error occurred',
    };
  }
}
