import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, FileText, Loader2 } from 'lucide-react';

const Upload = ({ setTopicId, setPdfName }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError('');
    } else {
      setError('Please select a valid PDF file.');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:3003/upload', formData);
      if (response.data.success) {
        if (setPdfName) setPdfName(file.name);
        setTopicId(response.data.topicId);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to process document: ' + (err.response?.data?.details || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card glass-effect upload-container slide-up">
      <h2>Let's Start Learning</h2>
      <p className="instruction">Upload your PDF textbook or notes here.</p>
      
      <div className="upload-box">
        <input type="file" id="pdf-upload" accept=".pdf" onChange={handleFileChange} hidden />
        <label htmlFor="pdf-upload" className={`upload-label ${file ? 'has-file' : ''}`}>
          {file ? <FileText size={48} className="file-icon" /> : <UploadCloud size={48} className="upload-icon" />}
          <span className="file-name">{file ? file.name : "Click to select a PDF"}</span>
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="primary-btn" onClick={handleUpload} disabled={!file || loading}>
        {loading ? (
          <>
            <Loader2 className="spin" size={20} />
            Processing Knowledge...
          </>
        ) : (
          'Analyze Document'
        )}
      </button>
    </div>
  );
};

export default Upload;
