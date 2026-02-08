import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { config } from './config.js';
import { connectDB, getDocuments, deleteDocument } from './db/mongoClient.js';
import { buildGraph, invokeGraph, streamGraph } from './agents/graph.js';
import { processPDF } from './services/pdfProcessor.js';
import { insertChunks } from './db/mongoClient.js';

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());

// Multer configuration for PDF uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only accept PDF files
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Build LangGraph application on server start
let graphApp = null;

// Routes

/**
 * POST /api/chat - Chat endpoint with LangGraph
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { query, threadId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`\n💬 Chat request: "${query}"`);
    console.log(`   Thread ID: ${threadId || 'none'}`);

    // Invoke graph
    const finalState = await invokeGraph(graphApp, query);

    // Build response
    const response = {
      answer: finalState.finalAnswer || 'No answer generated',
      sources: finalState.retrievedChunks
        ? finalState.retrievedChunks.map((chunk, idx) => ({
            id: idx + 1,
            filename: chunk.filename || 'Unknown',
            snippet: chunk.content || chunk.snippet || '',
            metadata: chunk.metadata || {},
            source: chunk.source || chunk.metadata?.source || 'unknown',
            page: chunk.page ?? chunk.metadata?.pageNumber ?? null,
            url: chunk.url || chunk.metadata?.url || null,
          }))
        : [],
      searchMethod: finalState.searchMethod || 'unknown',
      metadata: finalState.parsedMetadata || {},
      foundInDB: finalState.foundInDB || false,
      error: finalState.error || null,
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Chat endpoint error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/chat/stream - Streaming chat endpoint with SSE
 */
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { query, threadId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`\n💬 Streaming chat request: "${query}"`);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream graph updates
    for await (const update of streamGraph(graphApp, query)) {
      const data = JSON.stringify(update);
      res.write(`data: ${data}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('❌ Streaming error:', error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/ingest/pdf - Upload and ingest PDF
 */
app.post('/api/ingest/pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`\n📤 PDF upload: ${req.file.originalname}`);

    // Process PDF
    const result = await processPDF(req.file.path, req.file.originalname);

    // Insert chunks into MongoDB
    const insertResult = await insertChunks(result.chunks);

    res.json({
      success: true,
      documentId: result.documentId,
      filename: result.filename,
      chunks: result.totalChunks,
      metadata: result.metadata,
      inserted: insertResult.insertedCount,
      duplicate: insertResult.duplicate || false,
    });
  } catch (error) {
    console.error('❌ PDF upload error:', error.message);
    res.status(500).json({
      error: 'Failed to process PDF',
      message: error.message,
    });
  }
});

/**
 * GET /api/documents - List all documents
 */
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await getDocuments();
    res.json({
      documents: documents.map((doc) => ({
        id: doc._id,
        filename: doc.filename,
        metadata: doc.metadata,
        chunks: doc.chunkCount,
        createdAt: doc.createdAt,
      })),
      total: documents.length,
    });
  } catch (error) {
    console.error('❌ Get documents error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch documents',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/documents/:id - Delete document
 */
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteDocument(id);

    res.json({
      success: true,
      deletedChunks: result.deletedCount,
    });
  } catch (error) {
    console.error('❌ Delete document error:', error.message);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error.message,
    });
  }
});

/**
 * GET /api/health - Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    vectorSearchMode: config.vectorSearch.mode,
    ollamaModel: config.ollama.model,
    embeddingModel: config.ollama.embeddingModel,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Express error:', err.message);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 10MB)' });
    }
  }

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
async function startServer() {
  try {
    console.log('\n🚀 Starting Multi-Agent Research Assistant Server...\n');

    // Connect to MongoDB
    await connectDB();

    // Build LangGraph application
    graphApp = buildGraph();

    // Start Express server
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log('='.repeat(60));
      console.log('\n📍 API Endpoints:');
      console.log(`   POST   http://localhost:${PORT}/api/chat`);
      console.log(`   POST   http://localhost:${PORT}/api/chat/stream`);
      console.log(`   POST   http://localhost:${PORT}/api/ingest/pdf`);
      console.log(`   GET    http://localhost:${PORT}/api/documents`);
      console.log(`   DELETE http://localhost:${PORT}/api/documents/:id`);
      console.log(`   GET    http://localhost:${PORT}/api/health`);
      console.log('\n⚙️  Configuration:');
      console.log(`   Ollama Model: ${config.ollama.model}`);
      console.log(`   Embedding Model: ${config.ollama.embeddingModel}`);
      console.log(`   Vector Search Mode: ${config.vectorSearch.mode}`);
      console.log(`   MongoDB: ${config.mongodb.database}`);
      console.log('\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
