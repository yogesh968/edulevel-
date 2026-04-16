import React, { useState, useEffect } from 'react';
import Upload from './components/Upload';
import ChatUI from './components/ChatUI';
import { BookOpen } from 'lucide-react';

function App() {
  const [topicId, setTopicId] = useState(() => localStorage.getItem('topicId'));
  const [pdfName, setPdfName] = useState(() => localStorage.getItem('pdfName') || "");

  useEffect(() => {
    if (topicId) {
      localStorage.setItem('topicId', topicId);
      localStorage.setItem('pdfName', pdfName);
    } else {
      localStorage.removeItem('topicId');
      localStorage.removeItem('pdfName');
    }
  }, [topicId, pdfName]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <BookOpen size={28} className="icon-pulse" />
          <h1>Lumina Tutor</h1>
        </div>
        <p className="subtitle">AI-Powered Learning & Image Retrieval</p>
      </header>

      <main className="main-content">
        {!topicId ? (
          <Upload setTopicId={setTopicId} setPdfName={setPdfName} />
        ) : (
          <ChatUI topicId={topicId} pdfName={pdfName} onBack={() => { setTopicId(null); setPdfName(""); }} />
        )}
      </main>

      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>
    </div>
  );
}

export default App;
