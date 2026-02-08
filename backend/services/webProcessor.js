import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { config } from '../config.js';
import { generateEmbeddings } from '../utils/embeddings.js';
import { extractMetadata } from './pdfProcessor.js';
import {
  createDocumentChunk,
  generateDocumentHash,
  generateDocumentId,
} from '../models/documentChunk.js';

/**
 * Process web search results: chunk, extract metadata, and embed
 * @param {Array} searchResults - Tavily search results
 * @returns {Promise<Array>} Processed web chunks ready for storage
 */
export async function processWebResults(searchResults) {
  const allChunks = [];

  for (const result of searchResults) {
    try {
      console.log(`🌐 Processing web result: ${result.title}`);

      const content = result.content;
      
      if (!content || content.length < 50) {
        console.warn(`   ⚠️  Skipping (content too short): ${result.url}`);
        continue;
      }

      // Generate hash and ID
      const documentHash = generateDocumentHash(content);
      const documentId = generateDocumentId(result.title || result.url);

      // Extract metadata using AI
      console.log('   Extracting metadata...');
      const metadata = await extractMetadata(content);
      console.log(`   Metadata: topic="${metadata.topic}" exercise="${metadata.exercise}" metric="${metadata.metric}"`);

      // Split content into chunks
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: config.vectorSearch.chunkSize,
        chunkOverlap: config.vectorSearch.chunkOverlap,
      });

      const chunks = await splitter.splitText(content);
      console.log(`   Created ${chunks.length} chunks`);

      // Generate embeddings
      console.log('   Generating embeddings...');
      const embeddings = await generateEmbeddings(chunks);

      // Create document chunks with short snippets
      const documentChunks = chunks.map((chunk, index) =>
        createDocumentChunk({
          documentId,
          filename: result.title || result.url,
          chunkIndex: index,
          content: chunk, // Will be truncated to 500 chars
          embedding: embeddings[index],
          metadata: {
            ...metadata,
            source: 'web',
            url: result.url,
            pageNumber: 0,
            totalPages: 1,
            uploadedAt: new Date(),
          },
          documentHash,
        })
      );

      allChunks.push(...documentChunks);
      console.log(`   ✅ Processed: ${documentChunks.length} chunks`);
    } catch (error) {
      console.error(`   ❌ Error processing ${result.url}:`, error.message);
      // Continue with other results
    }
  }

  console.log(`✅ Total web chunks processed: ${allChunks.length}`);
  return allChunks;
}

/**
 * Process single web page content
 * @param {Object} webPage - Web page data {url, title, content}
 * @param {Object} metadata - Optional metadata override
 * @returns {Promise<Object>} Processing result with chunks
 */
export async function processWebPage(webPage, metadata = null) {
  try {
    const { url, title, content } = webPage;

    console.log(`🌐 Processing web page: ${title || url}`);

    const documentHash = generateDocumentHash(content);
    const documentId = generateDocumentId(title || url);

    // Extract metadata or use provided
    const extractedMetadata = metadata || await extractMetadata(content);

    // Split and embed
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.vectorSearch.chunkSize,
      chunkOverlap: config.vectorSearch.chunkOverlap,
    });

    const chunks = await splitter.splitText(content);
    const embeddings = await generateEmbeddings(chunks);

    const documentChunks = chunks.map((chunk, index) =>
      createDocumentChunk({
        documentId,
        filename: title || url,
        chunkIndex: index,
        content: chunk,
        embedding: embeddings[index],
        metadata: {
          ...extractedMetadata,
          source: 'web',
          url,
          pageNumber: 0,
          totalPages: 1,
          uploadedAt: new Date(),
        },
        documentHash,
      })
    );

    return {
      documentId,
      documentHash,
      filename: title || url,
      url,
      chunks: documentChunks,
      metadata: extractedMetadata,
      totalChunks: documentChunks.length,
    };
  } catch (error) {
    console.error('❌ Error processing web page:', error.message);
    throw error;
  }
}
