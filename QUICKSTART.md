# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install Prerequisites (2 min)

```bash
# Install Ollama (if not already installed)
# Visit https://ollama.ai and download for macOS

# Pull required models
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

### 2. Start MongoDB (30 sec)

```bash
# Option A: Local MongoDB
brew services start mongodb-community

# Option B: Use MongoDB Atlas
# Create free cluster at https://cloud.mongodb.com
# Update backend/.env with connection string
```

### 3. Configure Backend (1 min)

```bash
cd backend

# Install dependencies (ignore @tavily/core error for now)
npm install --legacy-peer-deps

# Set up environment
cp .env.example .env

# Edit .env - REQUIRED: Add your Tavily API key
# Get free key at: https://tavily.com
nano .env
# Update: TAVILY_API_KEY=tvly-your-key-here
```

### 4. Start Backend (30 sec)

```bash
cd backend
npm run dev

# Look for these success messages:
# ✅ Connected to MongoDB
# ✅ Multi-agent graph compiled
# ✅ Server running on http://localhost:3001
```

### 5. Start Frontend (30 sec)

Frontend should already be running from initial setup at http://localhost:5173

If not:
```bash
cd frontend
npm run dev
```

### 6. Test It! (30 sec)

1. Open http://localhost:5173
2. Click "📄 Upload PDF" → Upload a PDF (optional)
3. Click "💬 Chat"
4. Ask: "What is quantum entanglement?"
5. Watch the magic happen! ✨

---

## 🎯 What Just Happened?

When you asked the question:

1. **Master Agent** parsed your query for metadata
2. **Checked MongoDB** - no data found (first time)
3. **Sub Agent activated** - scanned local PDFs (none yet)
4. **Searched the web** via Tavily - found relevant pages
5. **Ingested content** - extracted metadata, chunked, embedded
6. **Stored in MongoDB** - ready for next time
7. **Master Agent** - generated answer with sources

---

## 📁 Project Structure Overview

```
kofuku/
├── backend/              # Node.js + Express API
│   ├── agents/          # LangGraph multi-agent logic
│   ├── services/        # PDF & web processing
│   ├── db/              # MongoDB client
│   └── server.js        # Main entry point
├── frontend/            # React + Vite UI
│   ├── src/
│   │   ├── components/  # Chat UI components
│   │   └── services/    # API client
│   └── App.jsx
├── README.md            # Full documentation
├── SETUP.md             # Detailed setup & troubleshooting
└── ollamasample.txt     # Ollama reference code
```

---

## 🔗 Useful Links

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **API Health**: http://localhost:3001/api/health
- **Ollama**: http://localhost:11434

---

## ⚡ Pro Tips

### Upload PDFs for Faster Responses
- Upload domain-specific PDFs
- Ask questions about their content
- Master Agent will find answers instantly (no web search needed)

### Understand Vector Search Modes

**Local Mode** (default - `VECTOR_SEARCH_MODE=local`):
- ✅ Works with free MongoDB Community
- ✅ No Atlas M10+ cluster needed
- ⚠️ Slower for large datasets (> 1000 chunks)

**Atlas Mode** (`VECTOR_SEARCH_MODE=atlas`):
- ✅ Fast vector search at scale
- ✅ Production-ready
- ⚠️ Requires MongoDB Atlas M10+ ($57/month)

### Monitor Agent Activity

Watch backend logs to see:
- 🎯 Master Agent metadata parsing
- 🔍 MongoDB searches
- 🤖 Sub Agent ingestion
- 📡 Tavily web searches

---

## 🐛 Quick Troubleshooting

### Backend won't start?
```bash
# Check Ollama
ollama list

# Check MongoDB
mongosh
```

### No responses?
- Check backend logs for errors
- Verify Tavily API key is set
- Ensure Ollama models are pulled

### Frontend errors?
```bash
# Verify components exist
ls frontend/src/components/
# Should have: ChatInterface.jsx, MessageBubble.jsx, AgentStatus.jsx, PDFUpload.jsx
```

---

## 📖 Learn More

- **Full Documentation**: See [README.md](README.md)
- **Detailed Setup**: See [SETUP.md](SETUP.md)
- **Ollama Reference**: See [ollamasample.txt](ollamasample.txt)

---

**Need Help?** Check the logs - both backend and browser console will show detailed error messages.

🎉 **Enjoy your Multi-Agent Research Assistant!**
