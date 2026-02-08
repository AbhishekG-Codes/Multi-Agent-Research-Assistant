import { OllamaEmbeddings } from '@langchain/ollama';
import { config } from '../config.js';

/**
 * Generate embeddings using configurable Ollama embedding model
 * @param {string} text - Text to embed
 * @param {string} model - Optional embedding model override
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text, model = null) {
  const embeddingModel = model || config.ollama.embeddingModel;
  
  const embeddings = new OllamaEmbeddings({
    model: embeddingModel,
    baseUrl: config.ollama.baseUrl,
  });

  try {
    const embedding = await embeddings.embedQuery(text);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to embed
 * @param {string} model - Optional embedding model override
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function generateEmbeddings(texts, model = null) {
  const embeddingModel = model || config.ollama.embeddingModel;
  
  const embeddings = new OllamaEmbeddings({
    model: embeddingModel,
    baseUrl: config.ollama.baseUrl,
  });

  try {
    const embeddingVectors = await embeddings.embedDocuments(texts);
    return embeddingVectors;
  } catch (error) {
    console.error('Error generating embeddings:', error.message);
    throw error;
  }
}

/**
 * Compute cosine similarity between two vectors (for local mode)
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} Cosine similarity score (0-1)
 */
export function computeCosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}
