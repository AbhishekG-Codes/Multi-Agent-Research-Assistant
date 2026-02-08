import dotenv from 'dotenv';

dotenv.config();

export const config = {
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
    embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS) || 768,
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'graphrag',
    collection: process.env.MONGODB_COLLECTION || 'document_chunks',
  },
  vectorSearch: {
    mode: process.env.VECTOR_SEARCH_MODE || 'local', // 'atlas' or 'local'
    chunkSize: parseInt(process.env.CHUNK_SIZE) || 500,
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP) || 50,
    topK: parseInt(process.env.TOP_K_RESULTS) || 5,
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY,
  },
  server: {
    port: parseInt(process.env.PORT) || 3001,
  },
};
