import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, User, Cpu, Image as ImageIcon, FileText, ArrowLeft, Trash2, X, ImagePlus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const ChatUI = ({ topicId, pdfName, onBack }) => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`messages_${topicId}`);
    if (saved) return JSON.parse(saved);
    return [{ role: 'assistant', text: 'Document loaded successfully! Ask me anything about it.', image: null }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadImage, setUploadImage] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (topicId) {
      localStorage.setItem(`messages_${topicId}`, JSON.stringify(messages));
    }
  }, [messages, topicId]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        setUploadImage(file);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; // Optimized for high-speed analysis
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG for high efficiency
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setUploadPreview(dataUrl);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
  };

  const clearUpload = () => {
    setUploadImage(null);
    setUploadPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleSend = async () => {
    if (!input.trim() && !uploadImage) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { 
        role: 'user', 
        text: userMsg, 
        uploadImage: uploadPreview 
    }]);
    setLoading(true);

    const currentImage = uploadPreview;
    clearUpload();

    try {
      const historyToPass = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));
      const API_BASE = import.meta.env.VITE_API_URL || 'https://edulevel-zxml.vercel.app';
      const response = await axios.post(`${API_BASE}/api/chat`, {
        topicId,
        question: userMsg,
        history: historyToPass,
        image: currentImage
      });

      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          text: response.data.answer,
          image: response.data.image
        }
      ]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: `Error: ${err.response?.data?.details || err.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear your chat history for this document?")) {
      const resetMsg = [{ role: 'assistant', text: 'History cleared. Ask me anything about the document!', image: null }];
      setMessages(resetMsg);
      localStorage.setItem(`messages_${topicId}`, JSON.stringify(resetMsg));
    }
  };

  return (
    <div className="card glass-effect chat-container slide-up">
      {/* Chat Header for PDF Info */}
      <div className="chat-header">
        <button onClick={onBack} className="back-btn" title="Upload a different document">
          <ArrowLeft size={18} />
        </button>
        <div className="active-doc-info">
          <FileText size={16} className="doc-icon" />
          <span className="doc-name">{pdfName || "Document Context Active"}</span>
        </div>
        <button className="clear-btn" onClick={handleClear} title="Clear Chat History">
          <Trash2 size={12} />
          Clear Chat
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-wrapper ${msg.role}`}>
            <div className={`avatar ${msg.role}`}>
              {msg.role === 'assistant' ? <Cpu size={20} /> : <User size={20} />}
            </div>
            <div className="message-content markdown-body">
              <ReactMarkdown>{msg.text}</ReactMarkdown>
              {msg.uploadImage && (
                <div className="user-upload-preview">
                    <img src={msg.uploadImage} alt="User upload" onClick={() => setSelectedImage({ filename: null, title: 'Uploaded Image', url: msg.uploadImage, isUser: true })} />
                </div>
              )}
              {msg.image && (
                <div className="message-image-card">
                  <div className="image-header">
                    <ImageIcon size={14} />
                    <span>Relevant Diagram</span>
                  </div>
                  <img 
                    src={`/images/${msg.image.filename}`} 
                    alt={msg.image.title} 
                    className="message-image" 
                    onClick={() => setSelectedImage(msg.image)}
                  />
                  <div className="image-title">{msg.image.title}</div>
                  {msg.image.description && (
                    <div className="image-description">
                      {msg.image.description}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Image Modal (Lightbox) */}
        {selectedImage && (
          <div className="image-modal-overlay" onClick={() => setSelectedImage(null)}>
            <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedImage(null)}>
                <X size={24} />
              </button>
              <img 
                src={selectedImage.isUser ? selectedImage.url : `/images/${selectedImage.filename}`} 
                alt={selectedImage.title} 
                className="modal-image" 
              />
              <div className="modal-title">{selectedImage.title}</div>
            </div>
          </div>
        )}
        {loading && (
          <div className="message-wrapper assistant">
            <div className="avatar assistant"><Cpu size={20} /></div>
            <div className="message-content typing-indicator">
              <span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {uploadPreview && (
        <div className="upload-preview-bar">
            <div className="preview-container">
                <img src={uploadPreview} alt="upload preview" />
                <button onClick={clearUpload}><X size={14} /></button>
            </div>
        </div>
      )}

      <div className="chat-input-area">
        <input 
            type="file" 
            ref={imageInputRef} 
            onChange={handleImageChange} 
            accept="image/*" 
            hidden 
        />
        <button 
            className="image-upload-btn" 
            onClick={() => imageInputRef.current?.click()}
            title="Upload Image"
        >
            <ImagePlus size={20} />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={(!input.trim() && !uploadImage) || loading} className="send-btn">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatUI;
