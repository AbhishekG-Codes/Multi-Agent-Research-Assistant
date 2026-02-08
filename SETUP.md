# Setup Guide for Multi-Agent Research Assistant

## ⚠️ Important Fixes Before Running

### 1. Fix Tavily Package (Backend)

The `@tavily/core` package version in package.json may not exist. Update it:

```bash
cd backend

# Remove the incorrect version
npm uninstall @tavily/core

# Install using npm package manager to get latest
npm install tavily

# OR use the axios-based alternative:
# npm install axios
```

**Update backend/services/tavilySearch.js** to use the correct import:

```javascript
// If using 'tavily' package:
import { TavilySearchAPIRetriever } from '@langchain/community/retrievers/tavily_search_api';

// OR build custom wrapper with axios:
import axios from 'axios';
```

### 2. Update Frontend App.jsx

The frontend App.jsx needs to be updated with the chat interface:

```bash
cd frontend/src

# Backup original
cp App.jsx App.jsx.backup

# Create new App.jsx with this content:
```

```javascript
import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import PDFUpload from './components/PDFUpload';
import './App.css';

function App() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 Multi-Agent Research Assistant</h1>
        <p className="subtitle">Metadata-First PDF & Web Knowledge System</p>
        <button
          className="toggle-upload"
          onClick={() => setShowUpload(!showUpload)}
        >
          {showUpload ? '💬 Chat' : '📄 Upload PDF'}
        </button>
      </header>

      <main className="app-main">
        {showUpload ? (
          <div className="upload-panel">
            <PDFUpload />
          </div>
        ) : (
          <ChatInterface />
        )}
      </main>

      <footer className="app-footer">
        <div className="tech-stack">
          <span>Powered by:</span>
          <span className="tech-badge">LangGraph</span>
          <span className="tech-badge">Ollama</span>
          <span className="tech-badge">MongoDB</span>
          <span className="tech-badge">Tavily</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
```

## 🔧 Complete Setup Steps

### 1. Prerequisites

Install required software:

```bash
# 1. Ollama
# Download from https://ollama.ai
# Then pull models:
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# Verify:
ollama list

# 2. MongoDB
# Option A: Local (for demo/development)
brew install mongodb-community
brew services start mongodb-community

# Option B: MongoDB Atlas (for production)
# Create cluster at https://cloud.mongodb.com

# 3. Node.js (v18+)
node --version  # Should be v18 or higher
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies (may fail on @tavily/core - see fix above)
npm install

# Configure environment
cp .env.example .env

# Edit .env:
nano .env  # or your preferred editor
```

**Required .env values:**

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768

# For local development:
MONGODB_URI=mongodb://localhost:27017
VECTOR_SEARCH_MODE=local

# Tavily API (get key from https://tavily.com)
TAVILY_API_KEY=tvly-<your-key-here>

PORT=3001
```

### 3. Frontend Setup

Frontend should already be set up. If not:

```bash
cd frontend

# Install if needed
npm install

# Update App.jsx (see above)
```

### 4. Start Services

**Terminal 1: Ollama** (if not running as service)
```bash
ollama serve
```

**Terminal 2: MongoDB** (if local)
```bash
mongod
# OR if installed via brew:
brew services start mongodb-community
```

**Terminal 3: Backend**
```bash
cd backend
npm run dev
```

**Terminal 4: Frontend**
```bash
cd frontend
npm run dev
```

### 5. Verify Everything Works

1. **Check Ollama**: http://localhost:11434
2. **Check MongoDB**: 
   ```bash
   mongosh
   show dbs
   ```
3. **Check Backend**: http://localhost:3001/api/health
4. **Check Frontend**: http://localhost:5173

## 🐛 Common Issues

### Issue: @tavily/core package not found

**Solution**: See "Fix Tavily Package" above. You have 3 options:
1. Install `tavily` instead
2. Use LangChain's TavilySearchAPIRetriever
3. Build custom axios-based wrapper

### Issue: Ollama connection error

**Solution**: 
```bash
# Make sure Ollama is running:
ollama serve

# Check models are pulled:
ollama list
# Should show qwen2.5:7b and nomic-embed-text

# If not, pull them:
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

### Issue: MongoDB connection error

**Solution**:
```bash
# If using local MongoDB:
brew services start mongodb-community

# Test connection:
mongosh
```

### Issue: Frontend components not found

**Solution**:
```bash
cd frontend

# Verify all component files exist:
ls -la src/components/
# Should show: ChatInterface.jsx, MessageBubble.jsx, AgentStatus.jsx, PDFUpload.jsx

# Verify services:
ls -la src/services/
# Should show: api.js
```

### Issue: CSS not loading

**Solution**:
The App.css file should already exist from Vite. If styling looks off, the CSS was provided in the implementation but may need manual creation. Check the implementation files for the complete CSS content.

## ✅ Test the Application

### 1. Upload a PDF

1. Go to http://localhost:5173
2. Click "📄 Upload PDF"
3. Drop or select a PDF file
4. Click "Upload and Process"
5. Should see success message with metadata

### 2. Ask a Question

1. Click "💬 Chat"
2. Type: "What is this document about?"
3. Master Agent should:
   - Parse query metadata
   - Search MongoDB
   - Return answer with citations

### 3. Test Web Search

1. Ask something not in your PDFs
2. Example: "How does cardio exercise affect heart rate in diabetics?"
3. Sub Agent should:
   - Check local PDFs (if no match)
   - Trigger Tavily web search
   - Ingest results
   - Master Agent answers with web sources

### 4. Verify MongoDB

```bash
mongosh
use graphrag
db.document_chunks.countDocuments()
# Should show number of stored chunks

db.document_chunks.findOne()
# Should show a document with metadata, content, embedding
```

## 📊 Expected Behavior

### Metadata-First Flow

```
Query: "How does cardio exercise affect heart rate in diabetics?"
  ↓
Master Agent: Extract metadata
  topic: "diabetes"
  exercise: "cardio exercise"
  metric: "heart rate"
  ↓
Search MongoDB by metadata (FAST)
  ↓
Found? → Retrieve snippets → Generate answer
Not found? → Sub Agent
  ↓
Sub Agent: Scan local PDFs
  Found 0 relevant PDFs
  ↓
Trigger Tavily web search
  Query: "diabetes cardio exercise heart rate"
  Found 5 web pages
  ↓
Process & store chunks
  ↓
Return to Master Agent
  ↓
Master Agent: Re-query → Generate answer with web sources
```

## 🎉 Success Indicators

✅ Backend logs show:
- ✅ Connected to MongoDB
- ✅ Multi-agent graph compiled
- ✅ Server running on http://localhost:3001

✅ Frontend shows:
- Chat interface with example queries
- Toggle between Chat and Upload
- Tech stack badges in footer

✅ First query works:
- Master Agent parses metadata
- Searches DB
- Returns answer (or triggers Sub Agent if no data)

---

If you encounter any issues not covered here, check the backend server logs for detailed error messages.
