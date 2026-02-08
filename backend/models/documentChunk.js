import crypto from 'crypto';

/**
 * Create a document chunk object
 * @param {Object} params - Chunk parameters
 * @returns {Object} Document chunk
 */
export function createDocumentChunk({
  documentId,
  filename,
  chunkIndex,
  content,
  embedding,
  metadata,
  documentHash,
}) {
  // Limit content to 500 characters (short snippet)
  const shortContent = content.substring(0, 500);

  return {
    documentId,
    filename,
    chunkIndex,
    content: shortContent,
    embedding,
    metadata: {
      topic: metadata.topic || '',
      exercise: metadata.exercise || '',
      metric: metadata.metric || '',
      source: metadata.source || 'unknown',
      pageNumber: metadata.pageNumber || 0,
      totalPages: metadata.totalPages || 0,
      uploadedAt: metadata.uploadedAt || new Date(),
    },
    documentHash,
    createdAt: new Date(),
  };
}

/**
 * Generate document hash for deduplication
 * @param {Buffer|string} content - Document content
 * @returns {string} SHA-256 hash
 */
export function generateDocumentHash(content) {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}

/**
 * Generate unique document ID
 * @param {string} filename - Original filename
 * @returns {string} Document ID
 */
export function generateDocumentId(filename) {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
  return `${cleanFilename}_${timestamp}_${randomStr}`;
}
