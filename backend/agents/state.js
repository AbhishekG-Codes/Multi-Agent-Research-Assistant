import { Annotation } from '@langchain/langgraph';

/**
 * System state for multi-agent workflow
 */
export const SystemState = Annotation.Root({
  // User interaction
  messages: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  userQuery: Annotation({
    reducer: (current, update) => update || current,
    default: () => '',
  }),

  // Metadata extraction
  parsedMetadata: Annotation({
    reducer: (current, update) => update || current,
    default: () => ({ topic: '', exercise: '', metric: '' }),
  }),

  // Retrieval status
  foundInDB: Annotation({
    reducer: (current, update) => update ?? current,
    default: () => false,
  }),

  // Retrieved content
  retrievedChunks: Annotation({
    reducer: (current, update) => update || current,
    default: () => [],
  }),

  // Final response
  finalAnswer: Annotation({
    reducer: (current, update) => update || current,
    default: () => '',
  }),

  // Sub-agent tracking (prevent infinite loops)
  subAgentInvoked: Annotation({
    reducer: (current, update) => update ?? current,
    default: () => false,
  }),

  // Agent status for UI updates
  currentAgent: Annotation({
    reducer: (current, update) => update || current,
    default: () => 'masterAgent',
  }),

  agentStatus: Annotation({
    reducer: (current, update) => update || current,
    default: () => '',
  }),

  // Search method used ('pdf' or 'web')
  searchMethod: Annotation({
    reducer: (current, update) => update || current,
    default: () => '',
  }),

  // Error handling
  error: Annotation({
    reducer: (current, update) => update || current,
    default: () => null,
  }),
});
