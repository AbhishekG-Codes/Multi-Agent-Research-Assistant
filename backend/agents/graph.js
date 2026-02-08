import { StateGraph, START, END } from '@langchain/langgraph';
import { SystemState } from './state.js';
import { masterAgentNode } from './masterAgent.js';
import { subAgentNode } from './subAgent.js';

/**
 * Build and compile the multi-agent state graph
 * @returns {CompiledGraph} Compiled LangGraph application
 */
export function buildGraph() {
  console.log('🏗️  Building multi-agent state graph...');

  const graph = new StateGraph(SystemState)
    // Add nodes with Command routing destinations
    .addNode('masterAgent', masterAgentNode, { ends: ['subAgent', END] })
    .addNode('subAgent', subAgentNode, { ends: ['masterAgent', END] })

    // Entry point
    .addEdge(START, 'masterAgent');

  const app = graph.compile();

  console.log('✅ Multi-agent graph compiled');
  console.log('   Nodes: masterAgent, subAgent');
  console.log('   Flow: START → masterAgent ⇄ subAgent (Command-based routing)');

  return app;
}

/**
 * Invoke the graph with a user query
 * @param {CompiledGraph} app - Compiled graph
 * @param {string} query - User query
 * @returns {Promise<Object>} Final state
 */
export async function invokeGraph(app, query) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Invoking multi-agent workflow');
  console.log('   Query:', query);
  console.log('='.repeat(60));

  const initialState = {
    userQuery: query,
    messages: [
      {
        role: 'user',
        content: query,
      },
    ],
  };

  try {
    const finalState = await app.invoke(initialState, {
      recursionLimit: 50,
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Workflow completed');
    console.log('   Final Answer:', finalState.finalAnswer ? 'Generated' : 'Not generated');
    console.log('   Retrieved Chunks:', finalState.retrievedChunks?.length || 0);
    console.log('='.repeat(60) + '\n');

    return finalState;
  } catch (error) {
    console.error('❌ Graph invocation error:', error.message);
    throw error;
  }
}

/**
 * Stream the graph execution for real-time updates
 * @param {CompiledGraph} app - Compiled graph
 * @param {string} query - User query
 * @yields {Object} State updates
 */
export async function* streamGraph(app, query) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Streaming multi-agent workflow');
  console.log('   Query:', query);
  console.log('='.repeat(60));

  const initialState = {
    userQuery: query,
    messages: [
      {
        role: 'user',
        content: query,
      },
    ],
  };

  try {
    const stream = await app.stream(initialState, {
      recursionLimit: 50,
      streamMode: 'updates',
    });

    for await (const update of stream) {
      console.log('📡 Stream update:', Object.keys(update));
      yield update;
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Stream completed');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('❌ Graph streaming error:', error.message);
    throw error;
  }
}
