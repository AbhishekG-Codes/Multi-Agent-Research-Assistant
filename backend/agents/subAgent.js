import { Command } from '@langchain/langgraph';
import { processPDFDirectory } from '../services/pdfProcessor.js';
import { search, buildSearchQuery } from '../services/tavilySearch.js';
import { processWebResults } from '../services/webProcessor.js';
import { insertChunks } from '../db/mongoClient.js';
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config.js';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MIN_CHUNKS_THRESHOLD = 3;

/**
 * Sub Agent node - handles PDF scanning/ingestion and web search fallback
 * @param {Object} state - Current system state
 * @returns {Promise<Command>} Command to return to Master Agent
 */
export async function subAgentNode(state) {
  console.log('\n🤖 Sub Agent activated');
  console.log('   Task: Scan files for new PDFs, then search web if needed');

  try {
    const metadata = state.parsedMetadata;
    let allChunks = [];
    let pdfChunks = [];
    let webChunks = [];

    // Step 1: Check uploads/ directory for unprocessed PDFs
    console.log('\n   Step 1: Scanning uploads/ directory for PDFs...');
    
    try {
      const pdfResults = await processPDFDirectory(UPLOADS_DIR);
      
      if (pdfResults && pdfResults.length > 0) {
        // Filter out failed results
        const successfulResults = pdfResults.filter(r => r.chunks && r.chunks.length > 0);
        
        if (successfulResults.length > 0) {
          console.log(`   ✅ Found ${successfulResults.length} new PDFs to process`);
          
          // Store all PDF chunks in MongoDB
          for (const result of successfulResults) {
            try {
              await insertChunks(result.chunks);
              pdfChunks.push(...result.chunks);
              console.log(`   ✅ Stored ${result.chunks.length} chunks from ${result.filename}`);
            } catch (err) {
              console.warn(`   ⚠️  Failed to store chunks from ${result.filename}:`, err.message);
            }
          }
          
          if (pdfChunks.length > 0) {
            console.log(`   ✅ Total PDF chunks stored: ${pdfChunks.length}`);
            console.log('   Returning to Master Agent to re-query with new data...');
            
            // Return to Master Agent so it can re-query the now-populated database
            return new Command({
              goto: 'masterAgent',
              update: {
                foundInDB: false, // Master should re-check
                currentAgent: 'masterAgent',
                agentStatus: 'PDFs processed, re-querying database',
                messages: [
                  ...state.messages,
                  {
                    role: 'system',
                    content: `Sub Agent: Processed ${successfulResults.length} PDF(s), returning to Master Agent for re-query`,
                  },
                ],
              },
            });
          }
        } else {
          console.log('   ℹ️  No new PDFs to process (all already in database)');
        }
      } else {
        console.log('   ℹ️  No PDFs found in uploads/ directory');
      }
    } catch (error) {
      console.warn('   ⚠️  PDF scanning error:', error.message);
      // Continue to web search fallback
    }

    // Step 2: No new PDFs or they didn't help - try web search
    console.log('\n   Step 2: Triggering web search fallback...');

    try {
      // Use the original user query for web search
      const searchQuery = state.userQuery || buildSearchQuery(metadata);
      console.log(`   Search query: "${searchQuery}"`);

      if (searchQuery) {
        const searchResults = await search(searchQuery, 5);

        if (searchResults.length > 0) {
          // Generate answer directly from Tavily results
          console.log(`   ✅ Got ${searchResults.length} web results, generating direct answer...`);
          
          const webContext = searchResults
            .map((r, i) => `[${i+1}] ${r.title}\n${r.content}`)
            .join('\n\n---\n\n');
          
          const model = new ChatOllama({
            model: config.ollama.model,
            baseUrl: config.ollama.baseUrl,
            temperature: 0.7,
          });
          
          const answerPrompt = `Answer the user's question based on these web search results.
Include citations using [1], [2], etc.

WEB SEARCH RESULTS:
${webContext}

USER QUESTION:
${state.userQuery}

Provide a clear, concise answer based on the web results. Include relevant citations.`;
            
            const answerResponse = await model.invoke(answerPrompt);
            const webAnswer = answerResponse.content;
            
            const webSources = searchResults.map((r, i) => ({
              id: i + 1,
              filename: r.title || r.url,
              snippet: r.content?.substring(0, 300) || '',
              metadata: { source: 'web', url: r.url },
              source: 'web',
              page: null,
              url: r.url,
            }));
            
            // Also process and store for future queries (background)
            try {
              webChunks = await processWebResults(searchResults);
              allChunks.push(...webChunks);
            } catch (e) {
              console.warn('   ⚠️  Background web chunk processing failed:', e.message);
            }
            
            // Return directly with the web answer
            console.log('   ✅ Web answer generated directly');
            
            // Store chunks in background
            if (allChunks.length > 0) {
              try {
                const chunksByDoc = {};
                allChunks.forEach((chunk) => {
                  const docId = chunk.documentId;
                  if (!chunksByDoc[docId]) chunksByDoc[docId] = [];
                  chunksByDoc[docId].push(chunk);
                });
                for (const docId in chunksByDoc) {
                  await insertChunks(chunksByDoc[docId]);
                }
              } catch (e) {
                console.warn('   ⚠️  Chunk storage failed:', e.message);
              }
            }
            
            return new Command({
              goto: '__end__',
              update: {
                foundInDB: true,
                retrievedChunks: webSources,
                finalAnswer: webAnswer,
                searchMethod: 'web',
                currentAgent: 'subAgent',
                agentStatus: 'Answer from web search',
                messages: [
                  ...state.messages,
                  {
                    role: 'assistant',
                    content: webAnswer,
                    sources: webSources,
                  },
                ],
              },
            });
          } else {
            console.log('   No web results found');
          }
        } else {
          console.log('   Cannot build search query');
        }
      } catch (error) {
        console.warn('   ⚠️  Web search error:', error.message);
      }

    // Step 3: No PDFs and no web results — return to Master Agent with failure
    console.log('\n   ❌ Could not find information via PDF scan or web search');
    console.log('   Returning to Master Agent...');

    return new Command({
      goto: 'masterAgent',
      update: {
        foundInDB: false,
        currentAgent: 'masterAgent',
        agentStatus: 'No relevant data found',
        messages: [
          ...state.messages,
          {
            role: 'system',
            content: 'Sub Agent: web search returned no usable results',
          },
        ],
      },
    });
  } catch (error) {
    console.error('❌ Sub Agent error:', error.message);

    return new Command({
      goto: 'masterAgent',
      update: {
        error: error.message,
        foundInDB: false,
        currentAgent: 'masterAgent',
        agentStatus: 'Sub Agent encountered error',
      },
    });
  }
}
