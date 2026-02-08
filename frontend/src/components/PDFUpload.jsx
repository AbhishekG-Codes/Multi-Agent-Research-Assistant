import { useState } from 'react';
import { uploadPDF } from '../services/api';
import '../App.css';

export default function PDFUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    } else {
      setError('Please select a PDF file');
      setFile(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setResult(null);
      setError(null);
    } else {
      setError('Please drop a PDF file');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const uploadResult = await uploadPDF(file, (percentage) => {
        setProgress(percentage);
      });

      setResult(uploadResult);
      setFile(null);
      setProgress(0);
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pdf-upload-container">
      <h3>📄 Upload PDF Documents</h3>

      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {file ? (
          <div className="file-selected">
            <span>📄 {file.name}</span>
            <button
              className="remove-file"
              onClick={() => setFile(null)}
              disabled={uploading}
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <p>Drag and drop a PDF file here</p>
            <p className="or-text">or</p>
            <label className="file-input-label">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={uploading}
              />
              Choose File
            </label>
          </>
        )}
      </div>

      {file && !uploading && (
        <button className="upload-button" onClick={handleUpload}>
          Upload and Process
        </button>
      )}

      {uploading && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="progress-text">{Math.round(progress)}%</p>
        </div>
      )}

      {result && (
        <div className="upload-result success">
          <p>✅ Upload successful!</p>
          <ul>
            <li>Filename: {result.filename}</li>
            <li>Chunks: {result.chunks}</li>
            <li>Inserted: {result.inserted}</li>
            {result.metadata?.topic && (
              <li>Topic: {result.metadata.topic}</li>
            )}
            {result.duplicate && (
              <li className="warning">⚠️ Document already exists</li>
            )}
          </ul>
        </div>
      )}

      {error && (
        <div className="upload-result error">
          <p>❌ {error}</p>
        </div>
      )}
    </div>
  );
}
