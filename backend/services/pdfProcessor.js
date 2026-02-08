import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ChatOllama } from '@langchain/ollama';
import { config } from '../config.js';
import { generateEmbeddings } from '../utils/embeddings.js';
import { createMetadataExtractionPrompt } from '../prompts/metadataExtraction.js';
import {
  createDocumentChunk,
  generateDocumentHash,
  generateDocumentId,
} from '../models/documentChunk.js';
import fs from 'fs/promises';

/**
 * Create Ollama model for metadata extraction
 */
function createExtractionModel() {
  return new ChatOllama({
    model: config.ollama.model,
    baseUrl: config.ollama.baseUrl,
    temperature: 0, // Low temperature for consistent extraction
    format: 'json', // Request JSON output
  });
}

/**
 * Extract metadata from document text using AI
 * @param {string} text - Document text (first 1000 chars)
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Extracted metadata {topic, exercise, metric}
 */
export async function extractMetadata(text, timeout = 45000) {
  const model = createExtractionModel();
  const prompt = createMetadataExtractionPrompt(text);

  try {
    // Add timeout protection
    const extractionPromise = model.invoke(prompt);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Metadata extraction timeout')), timeout)
    );

    const response = await Promise.race([extractionPromise, timeoutPromise]);

    // Parse JSON response
    const content = response.content;
    let metadata;

    try {
      metadata = JSON.parse(content);
    } catch (parseError) {
      console.warn('Failed to parse metadata JSON, using defaults');
      metadata = { topic: '', exercise: '', metric: '' };
    }

    // Validate structure
    if (!metadata.topic) metadata.topic = '';
    if (!metadata.exercise) metadata.exercise = '';
    if (!metadata.metric) metadata.metric = '';

    return metadata;
  } catch (error) {
    console.error('Error extracting metadata:', error.message);
    // Return empty metadata on error
    return { topic: '', exercise: '', metric: '' };
  }
}

/**
 * Process PDF file: extract text, metadata, chunk, and embed
 * @param {string} filePath - Path to PDF file
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} Processing result with chunks
 */
export async function processPDF(filePath, filename) {
  try {
    console.log(`📄 Processing PDF: ${filename}`);

    // Read file for hash generation
    const fileBuffer = await fs.readFile(filePath);
    const documentHash = generateDocumentHash(fileBuffer);
    const documentId = generateDocumentId(filename);

    // Load PDF
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      throw new Error('No content extracted from PDF');
    }

    // Combine all pages
    const fullText = docs.map((doc) => doc.pageContent).join('\n');
    const totalPages = docs.length;

    console.log(`   Pages: ${totalPages}`);
    console.log(`   Text length: ${fullText.length} chars`);

    // Extract metadata using AI (from first 1000 chars)
    console.log('   Extracting metadata with AI...');
    const metadata = await extractMetadata(fullText);
    console.log(`   Metadata: topic="${metadata.topic}" exercise="${metadata.exercise}" metric="${metadata.metric}"`);

    // Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.vectorSearch.chunkSize,
      chunkOverlap: config.vectorSearch.chunkOverlap,
    });

    const chunks = await splitter.splitText(fullText);
    console.log(`   Created ${chunks.length} chunks`);

    // Generate embeddings for all chunks
    console.log('   Generating embeddings...');
    const embeddings = await generateEmbeddings(chunks);

    // Create document chunks with short snippets (500 chars max)
    const documentChunks = chunks.map((chunk, index) =>
      createDocumentChunk({
        documentId,
        filename,
        chunkIndex: index,
        content: chunk, // Will be truncated to 500 chars in createDocumentChunk
        embedding: embeddings[index],
        metadata: {
          ...metadata,
          source: 'pdf',
          pageNumber: Math.floor(index / (chunks.length / totalPages)),
          totalPages,
          uploadedAt: new Date(),
        },
        documentHash,
      })
    );

    console.log(`✅ PDF processed successfully: ${documentChunks.length} chunks`);

    return {
      documentId,
      documentHash,
      filename,
      chunks: documentChunks,
      metadata,
      totalChunks: documentChunks.length,
    };
  } catch (error) {
    console.error(`❌ Error processing PDF ${filename}:`, error.message);
    throw error;
  }
}

/**
 * Process multiple PDFs from directory
 * @param {string} directoryPath - Path to directory containing PDFs
 * @returns {Promise<Array>} Array of processed results
 */
export async function processPDFDirectory(directoryPath) {
  try {
    const files = await fs.readdir(directoryPath);
    const pdfFiles = files.filter((file) => file.toLowerCase().endsWith('.pdf'));

    console.log(`📁 Found ${pdfFiles.length} PDF files in ${directoryPath}`);

    const results = [];

    for (const pdfFile of pdfFiles) {
      const filePath = `${directoryPath}/${pdfFile}`;
      try {
        const result = await processPDF(filePath, pdfFile);
        results.push(result);
      } catch (error) {
        console.error(`❌ Skipping ${pdfFile}:`, error.message);
        // Continue with other files
        results.push({
          filename: pdfFile,
          error: error.message,
          chunks: [],
        });
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Error processing PDF directory:', error.message);
    throw error;
  }
}
