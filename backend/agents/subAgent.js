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
 * Sub Agent node - handles PDF and web ingestion
 * @param {Object} state - Current system state
 * @returns {Promise<Command>} Command to return to Master Agent
 */
export async function subAgentNode(state) {
  console.log('\n🤖 Sub Agent activated');
  console.log('   Task: Search the web for information not in DB');

  try {
    const metadata = state.parsedMetadata;
    let allChunks = [];
    let webChunks = [];

    // Step 1: ALWAYS try web search first (Sub Agent is only called when DB content isn't relevant)
    console.log('\n   Step 1: Triggering web search...');

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

    // Step 2: No web results — return to Master Agent with failure
    console.log('\n   ❌ Could not find information via web search');
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
