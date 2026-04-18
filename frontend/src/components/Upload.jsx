import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, FileText, Loader2, Zap, Brain, Layout, MessageSquare, Search, Sparkles } from 'lucide-react';

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
      const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
      const response = await axios.post(`${API_BASE}/api/upload`, formData);
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
    <div className="upload-container-outer slide-up">
      <div className="card glass-effect upload-container">
        <div className="upload-header">
            <h3>Start Your Session</h3>
            <p>PDF documents only • Max 10MB</p>
        </div>
        
        <div className="upload-box-wrapper">
          <input type="file" id="pdf-upload" accept=".pdf" onChange={handleFileChange} hidden />
          <label htmlFor="pdf-upload" className={`upload-label ${file ? 'has-file' : ''}`}>
            {file ? <FileText size={48} className="file-icon" /> : <UploadCloud size={48} className="upload-icon" />}
            <div className="upload-info">
                <span className="file-name">{file ? file.name : "Drag & Drop or Click to Upload"}</span>
                {!file && <span className="upload-hint">Analyze context, diagrams, and logic in seconds</span>}
            </div>
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="primary-btn pulse-on-hover" onClick={handleUpload} disabled={!file || loading}>
          {loading ? (
            <><Loader2 className="spin" size={20} /> Building Your Knowledge Base...</>
          ) : (
            <>Analyze My PDF <Zap size={18} /></>
          )}
        </button>
      </div>

      <section className="features-grid slide-up-delayed">
        <div className="feature-card">
          <div className="feature-icon-box"><Search size={24} /></div>
          <h4>Visual Search</h4>
          <p>AI automatically finds relevant diagrams from your materials.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-box"><Brain size={24} /></div>
          <h4>Smart Flashcards</h4>
          <p>Turns chapters into interactive study cards instantly.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-box"><Sparkles size={24} /></div>
          <h4>Doc Summaries</h4>
          <p>Get point-by-point summaries of long textbook chapters.</p>
        </div>
      </section>
    </div>
  );
};

export default Upload;
