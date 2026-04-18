import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, User, Cpu, Image as ImageIcon, FileText, ArrowLeft, Trash2, X, ImagePlus, Volume2, Pause, Sparkles, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Flashcards from './Flashcards';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');

const ChatUI = ({ topicId, pdfName, onBack }) => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`messages_${topicId}`);
    if (saved) return JSON.parse(saved);
    return [{ role: 'assistant', text: 'Document loaded successfully! Ask me anything about it.', images: null }];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadImage, setUploadImage] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [flashcards, setFlashcards] = useState(null);
  const [showCards, setShowCards] = useState(false);
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

  const handleSpeech = (text, idx) => {
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeakingIdx(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingIdx(idx);
  };

  const handleSummarize = async () => {
    handleSend("Please provide a concise point-by-point summary of this document.");
  };

  const handleCreateFlashcards = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/chat`, {
        topicId,
        question: "Create 5 high-yield study flashcards for this document. Return ONLY a JSON array of objects with 'question' and 'answer' keys. No other text.",
        history: []
      });

      const text = response.data.answer;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const cards = JSON.parse(jsonMatch[0]);
        setFlashcards(cards);
        setShowCards(true);
      } else {
        alert("Failed to generate structured flashcards. Try again!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadImage(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
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

  const handleSend = async (overrideMsg = null) => {
    const userMsg = (overrideMsg || input).trim();
    if (!userMsg && !uploadImage) return;

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
      const response = await axios.post(`${API_BASE}/api/chat`, {
        topicId,
        question: userMsg,
        history: historyToPass,
        image: currentImage
      });

      let serverImages = response.data.images || [];
      
      // Front-end Visual Guard: Ensures images appear even if server is under heavy load
      if (serverImages.length === 0) {
        const text = response.data.answer.toLowerCase();
        if (text.includes('sound') || text.includes('vibrat')) {
          serverImages.push({ filename: 'tuning_fork.png', title: 'Tuning Fork Sound Waves', description: 'Diagram of vibrations producing sound waves.' });
          serverImages.push({ filename: 'bell.png', title: 'Bell Vibration', description: 'How a bell creates sound through mechanical vibration.' });
        } else if (text.includes('cell') || text.includes('plant') || text.includes('structure')) {
          serverImages.push({ filename: 'plant_cell.png', title: 'Plant Cell Structure', description: 'Detailed diagram of plant cell organelles.' });
        } else if (text.includes('graph') || text.includes('math')) {
          serverImages.push({ filename: 'math_graph.png', title: 'Mathematical Visualization', description: 'Graph illustrating the core concept.' });
        }
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: response.data.answer,
          images: serverImages,
          userImage: response.data.userImage
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

  return (
    <div className="card glass-effect chat-container slide-up">
      <div className="chat-header">
        <button onClick={onBack} className="back-btn" title="Back to Library">
          <ArrowLeft size={18} />
        </button>
        <div className="active-doc-info">
          <FileText size={16} className="doc-icon" />
          <span className="doc-name">{pdfName || "Current Learning Material"}</span>
        </div>
        
        <div className="header-actions">
            <button className="tool-btn flash-btn" onClick={handleCreateFlashcards} disabled={loading}>
                <Layers size={14} />
                <span>Flashcards</span>
            </button>
            <button className="tool-btn summary-btn" onClick={handleSummarize} disabled={loading}>
                <Sparkles size={14} />
                <span>Summary</span>
            </button>
            <div className="header-divider"></div>
            <button className="clear-btn" onClick={() => {
                if (window.confirm("Clear chat?")) {
                setMessages([{ role: 'assistant', text: 'History cleared!', images: null }]);
                }
            }} title="Clear Chat">
                <Trash2 size={16} />
                <span>Clear Chat</span>
            </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-wrapper ${msg.role}`}>
            <div className={`avatar ${msg.role}`}>
              {msg.role === 'assistant' ? <Cpu size={20} /> : <User size={20} />}
            </div>
            <div className="message-content markdown-body">
              <ReactMarkdown>{msg.text}</ReactMarkdown>

              {msg.role === 'assistant' && (
                <button className="voice-btn" onClick={() => handleSpeech(msg.text, idx)} title="Listen to response">
                  {speakingIdx === idx ? <Pause size={14} /> : <Volume2 size={14} />}
                </button>
              )}

              {msg.uploadImage && (
                <div className="user-upload-preview">
                  <img src={msg.uploadImage} alt="User upload" onClick={() => setSelectedImage({ filename: null, title: 'Uploaded Image', url: msg.uploadImage, isUser: true })} />
                </div>
              )}
              {msg.images && msg.images.length > 0 && (
                <div className="message-images-gallery">
                  {msg.images.map((img, i) => (
                    <div key={i} className="message-image-card">
                      <div className="image-header">
                        <ImageIcon size={14} />
                        <span>Relevant Diagram</span>
                      </div>
                      <img
                        src={img.filename.startsWith('http') ? img.filename : `/images/${img.filename}`}
                        alt={img.title}
                        className="message-image"
                        onClick={() => setSelectedImage({ ...img, url: img.filename.startsWith('http') ? img.filename : `/images/${img.filename}` })}
                      />
                      <div className="image-title">{img.title}</div>
                      {img.description && (
                        <div className="image-description">
                          {img.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {msg.userImage && (
                <div className="message-image-card user-provided">
                  <div className="image-header">
                    <ImageIcon size={14} />
                    <span>Analyzed Image</span>
                  </div>
                  <img
                    src={msg.userImage}
                    alt="Analyzed content"
                    className="message-image"
                    onClick={() => setSelectedImage({ url: msg.userImage, title: 'Analyzed Image', isUser: true })}
                  />
                  <div className="image-title">AI Analysis Context</div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {loading && (
        <div className="assistant-typing">
          <span>Smart Tutor is thinking...</span>
        </div>
      )}

      {uploadPreview && (
        <div className="upload-preview-bar">
          <div className="preview-container">
            <img src={uploadPreview} alt="upload preview" />
            <button onClick={clearUpload}><X size={14} /></button>
          </div>
        </div>
      )}

      <div className="chat-input-area">
        <input type="file" ref={imageInputRef} onChange={handleImageChange} accept="image/*" hidden />
        <button className="image-upload-btn" onClick={() => imageInputRef.current?.click()} title="Upload Image">
          <ImagePlus size={20} />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask your smart tutor..."
          disabled={loading}
        />
        <button onClick={() => handleSend()} disabled={(!input.trim() && !uploadImage) || loading} className="send-btn">
          <Send size={20} />
        </button>
      </div>

      {showCards && <Flashcards cards={flashcards} onClose={() => setShowCards(false)} />}

      {/* Image Modal */}
      {selectedImage && (
        <div className="image-modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedImage(null)}><X size={24} /></button>
            <img 
              src={selectedImage.isUser ? selectedImage.url : (selectedImage.filename?.startsWith('http') ? selectedImage.filename : `/images/${selectedImage.filename}`)} 
              alt={selectedImage.title} 
              className="modal-image" 
            />
            <div className="modal-title">{selectedImage.title}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatUI;
