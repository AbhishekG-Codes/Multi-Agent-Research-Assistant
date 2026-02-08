import { MongoClient } from 'mongodb';
import { config } from '../config.js';
import { computeCosineSimilarity } from '../utils/embeddings.js';

let client = null;
let db = null;
let collection = null;

/**
 * Connect to MongoDB
 */
export async function connectDB() {
  if (client) {
    return { db, collection };
  }

  try {
    client = new MongoClient(config.mongodb.uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    await client.connect();
    db = client.db(config.mongodb.database);
    collection = db.collection(config.mongodb.collection);

    console.log('✅ Connected to MongoDB');
    console.log(`   Database: ${config.mongodb.database}`);
    console.log(`   Collection: ${config.mongodb.collection}`);
    console.log(`   Vector Search Mode: ${config.vectorSearch.mode}`);

    // Create indexes for metadata-first queries
    await createIndexes();

    return { db, collection };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
}

/**
 * Create indexes for metadata fields and document hash
 */
async function createIndexes() {
  try {
    // Index for metadata filtering (metadata-first approach)
    await collection.createIndex({
      'metadata.topic': 1,
      'metadata.exercise': 1,
      'metadata.metric': 1,
    });

    // Index for document hash (deduplication)
    await collection.createIndex({ documentHash: 1 });

    // Index for documentId lookup
    await collection.createIndex({ documentId: 1 });

    console.log('✅ MongoDB indexes created');
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
  }
}

/**
 * Check if document exists by hash (deduplication)
 * @param {string} hash - Document hash
 * @returns {Promise<boolean>} True if document exists
 */
export async function checkDocumentExists(hash) {
  await connectDB();
  const existingDoc = await collection.findOne({ documentHash: hash });
  return !!existingDoc;
}

/**
 * Insert chunks with deduplication check
 * @param {Array} chunks - Array of chunk objects
 * @returns {Promise<Object>} Insertion result
 */
export async function insertChunks(chunks) {
  await connectDB();

  if (!chunks || chunks.length === 0) {
    return { insertedCount: 0, message: 'No chunks to insert' };
  }

  try {
    // Check for duplicates by documentHash
    const docHash = chunks[0].documentHash;
    const exists = await checkDocumentExists(docHash);

    if (exists) {
      console.log(`⚠️  Document already exists (hash: ${docHash.substring(0, 8)}...)`);
      return { insertedCount: 0, message: 'Document already exists', duplicate: true };
    }

    const result = await collection.insertMany(chunks);
    console.log(`✅ Inserted ${result.insertedCount} chunks`);
    return { insertedCount: result.insertedCount, duplicate: false };
  } catch (error) {
    console.error('❌ Error inserting chunks:', error.message);
    throw error;
  }
}

/**
 * Search by metadata fields FIRST (metadata-first approach)
 * @param {Object} metadata - Metadata filter {topic, exercise, metric}
 * @returns {Promise<Array>} Matching chunks
 */
export async function searchMetadata(metadata) {
  await connectDB();

  const filter = { $or: [] };

  // Build flexible metadata query (partial matches with OR logic)
  // This allows matching if ANY metadata field matches, not all
  if (metadata.topic) {
    filter.$or.push({ 'metadata.topic': { $regex: metadata.topic, $options: 'i' } });
  }
  if (metadata.exercise) {
    filter.$or.push({ 'metadata.exercise': { $regex: metadata.exercise, $options: 'i' } });
  }
  if (metadata.metric) {
    filter.$or.push({ 'metadata.metric': { $regex: metadata.metric, $options: 'i' } });
  }

  // If no metadata fields provided, return empty
  if (filter.$or.length === 0) {
    console.log('🔍 Metadata search found 0 chunks (no metadata provided)');
    return [];
  }

  try {
    const results = await collection.find(filter).toArray();
    console.log(`🔍 Metadata search found ${results.length} chunks`);
    return results;
  } catch (error) {
    console.error('❌ Error searching metadata:', error.message);
    throw error;
  }
}

/**
 * Vector search with dual-mode support
 * @param {number[]} embedding - Query embedding vector
 * @param {number} k - Number of results to return
 * @param {Object} metadataFilter - Optional metadata pre-filter
 * @returns {Promise<Array>} Top-k similar chunks
 */
export async function vectorSearch(embedding, k = 5, metadataFilter = null) {
  await connectDB();

  const mode = config.vectorSearch.mode;

  if (mode === 'atlas') {
    return vectorSearchAtlas(embedding, k, metadataFilter);
  } else {
    return vectorSearchLocal(embedding, k, metadataFilter);
  }
}

/**
 * Atlas vector search using $vectorSearch aggregation
 * @param {number[]} embedding - Query embedding vector
 * @param {number} k - Number of results
 * @param {Object} metadataFilter - Optional metadata pre-filter
 * @returns {Promise<Array>} Top-k similar chunks
 */
async function vectorSearchAtlas(embedding, k, metadataFilter) {
  try {
    const pipeline = [];

    // Build filter for $vectorSearch (must be inside $vectorSearch, not a separate stage)
    let filter = null;
    if (metadataFilter) {
      filter = { $or: [] };
      if (metadataFilter.topic) {
        filter.$or.push({ 'metadata.topic': { $regex: metadataFilter.topic, $options: 'i' } });
      }
      if (metadataFilter.exercise) {
        filter.$or.push({ 'metadata.exercise': { $regex: metadataFilter.exercise, $options: 'i' } });
      }
      if (metadataFilter.metric) {
        filter.$or.push({ 'metadata.metric': { $regex: metadataFilter.metric, $options: 'i' } });
      }
      
      // If no filters were added, remove the filter
      if (filter.$or.length === 0) {
        filter = null;
      }
    }

    // Vector search stage (MUST be first in pipeline)
    const vectorSearchStage = {
      $vectorSearch: {
        index: 'vector_index123',
        path: 'embedding',
        queryVector: embedding,
        numCandidates: k * 10,
        limit: k,
      },
    };

    // Add filter if provided
    if (filter) {
      vectorSearchStage.$vectorSearch.filter = filter;
    }

    pipeline.push(vectorSearchStage);

    const results = await collection.aggregate(pipeline).toArray();
    console.log(`🔍 Atlas vector search found ${results.length} chunks`);
    return results;
  } catch (error) {
    console.error('❌ Atlas vector search error:', error.message);
    console.log('💡 Tip: Ensure Atlas Search vector index is created with name "vector_index123"');
    throw error;
  }
}

/**
 * Local vector search using app-side cosine similarity
 * @param {number[]} embedding - Query embedding vector
 * @param {number} k - Number of results
 * @param {Object} metadataFilter - Optional metadata pre-filter
 * @returns {Promise<Array>} Top-k similar chunks
 */
async function vectorSearchLocal(embedding, k, metadataFilter) {
  try {
    let query = {};

    // Apply metadata filter if provided (metadata-first)
    if (metadataFilter) {
      if (metadataFilter.topic) {
        query['metadata.topic'] = { $regex: metadataFilter.topic, $options: 'i' };
      }
      if (metadataFilter.exercise) {
        query['metadata.exercise'] = { $regex: metadataFilter.exercise, $options: 'i' };
      }
      if (metadataFilter.metric) {
        query['metadata.metric'] = { $regex: metadataFilter.metric, $options: 'i' };
      }
    }

    // Fetch all chunks (or filtered subset)
    const chunks = await collection.find(query).toArray();

    if (chunks.length === 0) {
      return [];
    }

    // Compute cosine similarity for each chunk
    const chunksWithScores = chunks.map((chunk) => ({
      ...chunk,
      score: computeCosineSimilarity(embedding, chunk.embedding),
    }));

    // Sort by score descending and return top-k
    const topK = chunksWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    console.log(`🔍 Local vector search found ${topK.length} chunks (from ${chunks.length} total)`);
    return topK;
  } catch (error) {
    console.error('❌ Local vector search error:', error.message);
    throw error;
  }
}

/**
 * Get all unique documents with metadata
 * @returns {Promise<Array>} List of documents
 */
export async function getDocuments() {
  await connectDB();

  try {
    const documents = await collection.aggregate([
      {
        $group: {
          _id: '$documentId',
          filename: { $first: '$filename' },
          metadata: { $first: '$metadata' },
          chunkCount: { $sum: 1 },
          createdAt: { $first: '$createdAt' },
        },
      },
      { $sort: { createdAt: -1 } },
    ]).toArray();

    return documents;
  } catch (error) {
    console.error('❌ Error fetching documents:', error.message);
    throw error;
  }
}

/**
 * Delete document and all its chunks
 * @param {string} documentId - Document ID to delete
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteDocument(documentId) {
  await connectDB();

  try {
    const result = await collection.deleteMany({ documentId });
    console.log(`🗑️  Deleted ${result.deletedCount} chunks for document ${documentId}`);
    return result;
  } catch (error) {
    console.error('❌ Error deleting document:', error.message);
    throw error;
  }
}

/**
 * Close MongoDB connection
 */
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    collection = null;
    console.log('MongoDB connection closed');
  }
}
