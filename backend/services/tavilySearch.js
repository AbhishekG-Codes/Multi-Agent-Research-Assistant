import { config } from '../config.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';

/**
 * Search the web using Tavily API (HTTP endpoint)
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results
 * @returns {Promise<Array>} Search results with content
 */
export async function search(query, maxResults = 5) {
  try {
    // Check if API key is configured
    if (!config.tavily.apiKey || config.tavily.apiKey === 'your_tavily_api_key_here') {
      throw new Error('Tavily API key not configured. Set TAVILY_API_KEY in .env file');
    }

    console.log(`🔍 Tavily search: "${query}"`);

    const payload = {
      api_key: config.tavily.apiKey,
      query: query,
      max_results: maxResults,
      search_depth: 'advanced',
      include_answer: false,
      include_raw_content: false,
    };

    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const results = data.results.map((result) => ({
      url: result.url,
      title: result.title,
      content: result.content || result.raw_content || '',
      snippet: (result.content || result.raw_content || '').substring(0, 200),
      score: result.score || 0,
    }));

    console.log(`✅ Found ${results.length} web results`);

    return results;
  } catch (error) {
    console.error('❌ Tavily search error:', error.message);
    
    // Return empty results on error (fallback gracefully)
    if (error.message.includes('API key')) {
      console.warn('💡 Tip: Set TAVILY_API_KEY in .env file');
    }
    
    return [];
  }
}

/**
 * Build search query from parsed metadata
 * @param {Object} metadata - Parsed metadata {topic, exercise, metric}
 * @returns {string} Optimized search query
 */
export function buildSearchQuery(metadata) {
  const parts = [];

  if (metadata.topic) parts.push(metadata.topic);
  if (metadata.exercise) parts.push(metadata.exercise);
  if (metadata.metric) parts.push(metadata.metric);

  // Join with spaces for natural language query
  return parts.filter(Boolean).join(' ');
}
