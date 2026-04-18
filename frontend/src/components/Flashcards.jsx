import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';

const Flashcards = ({ cards, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) return null;

  const currentCard = cards[currentIdx];

  const nextCard = () => {
    setIsFlipped(false);
    setCurrentIdx((prev) => (prev + 1) % cards.length);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setCurrentIdx((prev) => (prev - 1 + cards.length) % cards.length);
  };

  return (
    <div className="flashcard-overlay" onClick={onClose}>
      <div className="flashcard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flashcard-header">
          <h3>Study Flashcards</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className={`flashcard-item ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
          <div className="flashcard-front">
            <span className="card-label">Question</span>
            <p>{currentCard.question}</p>
            <div className="flip-hint">Click to see answer <RefreshCw size={14} /></div>
          </div>
          <div className="flashcard-back">
            <span className="card-label">Answer</span>
            <p>{currentCard.answer}</p>
            <div className="flip-hint">Click to see question <RefreshCw size={14} /></div>
          </div>
        </div>

        <div className="flashcard-footer">
          <button onClick={prevCard} className="nav-btn"><ChevronLeft size={24} /></button>
          <span className="card-counter">{currentIdx + 1} / {cards.length}</span>
          <button onClick={nextCard} className="nav-btn"><ChevronRight size={24} /></button>
        </div>
      </div>
    </div>
  );
};

export default Flashcards;
