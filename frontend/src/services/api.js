const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Send chat message
 * @param {string} query - User query
 * @returns {Promise<Object>} Response with answer and sources
 */
export async function sendChatMessage(query) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error('Failed to send chat message');
  }

  return response.json();
}

/**
 * Upload PDF file
 * @param {File} file - PDF file
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Upload result
 */
export async function uploadPDF(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentage = (e.loaded / e.total) * 100;
        onProgress(percentage);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error('Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    xhr.open('POST', `${API_BASE_URL}/ingest/pdf`);
    xhr.send(formData);
  });
}

/**
 * Get all documents
 * @returns {Promise<Object>} Documents list
 */
export async function getDocuments() {
  const response = await fetch(`${API_BASE_URL}/documents`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }

  return response.json();
}

/**
 * Delete document
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteDocument(documentId) {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete document');
  }

  return response.json();
}

/**
 * Health check
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE_URL}/health`);
  
  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}
