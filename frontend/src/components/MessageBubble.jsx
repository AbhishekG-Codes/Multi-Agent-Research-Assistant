import { useState } from 'react';
import '../App.css';

export default function MessageBubble({ message, sources }) {
  const [showSources, setShowSources] = useState(false);
  const [expandedSource, setExpandedSource] = useState(null);
  const isUser = message.role === 'user';
  const searchMethod = message.searchMethod;

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div style={{ maxWidth: isUser ? '75%' : '100%' }}>
        {/* Search method badge - shown above assistant messages */}
        {!isUser && searchMethod && (
          <div className={`search-method-badge ${searchMethod}`}>
            {searchMethod === 'pdf' ? '📄 Answered from PDF Knowledge Base' : '🌐 Answered from Tavily Web Search'}
          </div>
        )}

        <div className="message-content">
          {message.content}
        </div>

        {/* Compact sources row */}
        {sources && sources.length > 0 && (
          <div className="sources-compact">
            <button 
              className="sources-toggle"
              onClick={() => setShowSources(!showSources)}
            >
              {sources[0]?.source === 'web' ? '🌐' : '📄'} {sources.length} Sources
              <span className={`toggle-arrow ${showSources ? 'open' : ''}`}>▾</span>
            </button>
            
            {!showSources && (
              <div className="sources-chips">
                {sources.slice(0, 3).map((source) => (
                  <span key={source.id} className="source-chip">
                    {source.source === 'web' ? '🌐' : '📄'} {source.filename?.length > 30 
                      ? source.filename.substring(0, 30) + '…' 
                      : source.filename}
                  </span>
                ))}
                {sources.length > 3 && (
                  <span className="source-chip more">+{sources.length - 3} more</span>
                )}
              </div>
            )}

            {showSources && (
              <div className="sources-expanded">
                {sources.map((source) => (
                  <div 
                    key={source.id} 
                    className={`source-card ${expandedSource === source.id ? 'expanded' : ''}`}
                    onClick={() => setExpandedSource(
                      expandedSource === source.id ? null : source.id
                    )}
                  >
                    <div className="source-card-header">
                      <span className="source-number">[{source.id}]</span>
                      <span className="source-filename">
                        {source.source === 'web' ? '🌐' : '📄'} {source.filename}
                      </span>
                      {source.source === 'pdf' && source.page !== null && (
                        <span className="source-page">p.{source.page}</span>
                      )}
                    </div>

                    {expandedSource === source.id && (
                      <div className="source-snippet">
                        <p>{source.snippet}</p>
                        {source.url && (
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Full Source →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
