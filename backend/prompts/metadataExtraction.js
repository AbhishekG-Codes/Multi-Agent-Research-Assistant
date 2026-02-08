/**
 * Metadata extraction prompt for AI-powered analysis
 * @param {string} text - Text content (first 1000 chars of document)
 * @returns {string} Formatted prompt for metadata extraction
 */
export function createMetadataExtractionPrompt(text) {
  const truncatedText = text.substring(0, 1000);
  
  return `Extract structured metadata from this document excerpt.

Analyze the text and identify:
- TOPIC: Main subject area (e.g., "diabetes", "mathematics", "physics", "cardiology")
- EXERCISE: Specific task, problem, or concept being discussed (e.g., "cardio exercise", "calculus problem 3.2", "thermodynamics")
- METRIC: Key measurement, variable, or outcome (e.g., "heart rate", "difficulty_level_5", "temperature")

TEXT EXCERPT:
${truncatedText}

Return ONLY valid JSON in this exact format:
{
  "topic": "string",
  "exercise": "string",
  "metric": "string"
}

If any field cannot be determined, use an empty string "".
Respond with JSON only, no additional text.`;
}

/**
 * Query metadata extraction prompt
 * @param {string} query - User query
 * @returns {string} Formatted prompt for query analysis
 */
export function createQueryMetadataPrompt(query) {
  return `Analyze this user query and extract metadata filters for searching a document database.

Identify:
- TOPIC: Main subject area the user is asking about
- EXERCISE: Specific task, problem, or activity mentioned
- METRIC: Measurement, variable, or outcome the user wants to know about

USER QUERY:
${query}

Return ONLY valid JSON in this exact format:
{
  "topic": "string",
  "exercise": "string",
  "metric": "string"
}

Examples:
Query: "How does cardio exercise affect heart rate in diabetics?"
Response: {"topic": "diabetes", "exercise": "cardio exercise", "metric": "heart rate"}

Query: "What is the solution to calculus problem 3.2?"
Response: {"topic": "calculus", "exercise": "problem 3.2", "metric": "solution"}

If any field cannot be determined, use an empty string "".
Respond with JSON only, no additional text.`;
}
