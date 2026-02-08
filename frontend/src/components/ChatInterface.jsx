import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import AgentStatus from './AgentStatus';
import { sendChatMessage } from '../services/api';
import '../App.css';

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState(null);
  const [currentAgent, setCurrentAgent] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setAgentStatus('Processing query...');
    setCurrentAgent('masterAgent');

    try {
      const response = await sendChatMessage(userMessage.content);

      const assistantMessage = {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        searchMethod: response.searchMethod,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setAgentStatus(null);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
      setAgentStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>Multi-Agent Research Assistant</h2>
            <p>Ask me anything! I'll search my knowledge base or gather new information from PDFs and the web.</p>
            <div className="example-queries">
              <p><strong>Try asking:</strong></p>
              <ul>
                <li onClick={() => setInput("How does cardio exercise affect heart rate in diabetics?")}>
                  How does cardio exercise affect heart rate in diabetics?
                </li>
                <li onClick={() => setInput("What are the side effects of ibuprofen?")}>
                  What are the side effects of ibuprofen?
                </li>
                <li onClick={() => setInput("How does the mRNA vaccine work against COVID-19?")}>
                  How does the mRNA vaccine work against COVID-19?
                </li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={idx}
            message={msg}
            sources={msg.sources}
          />
        ))}

        {loading && agentStatus && (
          <AgentStatus status={agentStatus} currentAgent={currentAgent} />
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question..."
          rows="2"
          disabled={loading}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          {loading ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  );
}
