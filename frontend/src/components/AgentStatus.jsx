export default function AgentStatus({ status, currentAgent }) {
  if (!status) return null;

  const getAgentIcon = (agent) => {
    switch (agent) {
      case 'masterAgent':
        return '🎯';
      case 'subAgent':
        return '🤖';
      default:
        return '⚙️';
    }
  };

  const getAgentName = (agent) => {
    switch (agent) {
      case 'masterAgent':
        return 'Master Agent';
      case 'subAgent':
        return 'Sub Agent';
      default:
        return 'System';
    }
  };

  return (
    <div className="agent-status">
      <span className="agent-icon">{getAgentIcon(currentAgent)}</span>
      <span className="agent-name">{getAgentName(currentAgent)}</span>
      <span className="status-separator">•</span>
      <span className="agent-status-text">{status}</span>
      <div className="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}
