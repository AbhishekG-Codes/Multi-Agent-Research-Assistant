import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import PDFUpload from './components/PDFUpload';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('chat');
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 Multi-Agent Research Assistant</h1>
        <div className="tab-buttons">
          <button 
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            💬 Chat
          </button>
          <button 
            className={activeTab === 'upload' ? 'active' : ''}
            onClick={() => setActiveTab('upload')}
          >
            📄 Upload PDF
          </button>
        </div>
      </header>
      
      <main className="app-main">
        {activeTab === 'chat' ? <ChatInterface /> : <PDFUpload />}
      </main>
    </div>
  );
}

export default App;