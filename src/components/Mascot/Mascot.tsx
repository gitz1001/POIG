import React from 'react';
import type { MascotState } from '../../types';
import './Mascot.css';

interface MascotProps {
  state: MascotState;
}

export function Mascot({ state }: MascotProps) {
  const renderEyes = () => {
    if (state === 'thinking') {
      return (
        <g className="mascot-eyes-thinking" transform="translate(0, 5)">
          <circle cx="85" cy="110" r="4.5" fill="#3b2a63" className="thinking-dot" />
          <circle cx="100" cy="110" r="4.5" fill="#3b2a63" className="thinking-dot" />
          <circle cx="115" cy="110" r="4.5" fill="#3b2a63" className="thinking-dot" />
        </g>
      );
    }

    return (
      <g className="mascot-eyes-normal">
        <circle cx="72" cy="110" r="9" fill="#3b2a63" />
        <circle cx="128" cy="110" r="9" fill="#3b2a63" />
        {/* Specular highlights on eyes */}
        <circle cx="69" cy="107" r="3" fill="#FFFFFF" />
        <circle cx="125" cy="107" r="3" fill="#FFFFFF" />
      </g>
    );
  };

  const renderMouth = () => {
    if (state === 'talking') {
      return (
        <path
          d="M 90 126 Q 100 138 110 126"
          fill="none"
          stroke="#3b2a63"
          strokeWidth="4"
          strokeLinecap="round"
        />
      );
    }
    
    return (
      <path
        d="M 94 126 Q 100 130 106 126"
        fill="none"
        stroke="#3b2a63"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    );
  };

  return (
    <div className={`mascot-container mascot-state-${state}`}>
      <svg
        className="mascot-svg fade-in"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="bodyGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#fdfcff" />
            <stop offset="100%" stopColor="#e8e2f4" />
          </radialGradient>
          <radialGradient id="blushGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 168, 200, 0.7)" />
            <stop offset="100%" stopColor="rgba(255, 168, 200, 0)" />
          </radialGradient>
          <linearGradient id="glassHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <g className="mascot-body">
          {/* Back glow */}
          <circle cx="100" cy="115" r="75" fill="rgba(255,255,255,0.4)" filter="blur(20px)" />

          {/* Left Ear */}
          <path
            className="mascot-ear-left"
            d="M 55 65 Q 10 40 25 110 Q 30 140 55 105 Z"
            fill="url(#bodyGrad)"
          />
          
          {/* Right Ear */}
          <path
            className="mascot-ear-right"
            d="M 145 65 Q 190 40 175 110 Q 170 140 145 105 Z"
            fill="url(#bodyGrad)"
          />

          {/* Main Body (extra round) */}
          <circle cx="100" cy="115" r="65" fill="url(#bodyGrad)" />
          
          {/* Glassy top highlight for 3D feel */}
          <circle cx="100" cy="115" r="65" fill="url(#glassHighlight)" />

          {/* Blush */}
          <circle cx="58" cy="122" r="16" fill="url(#blushGrad)" />
          <circle cx="142" cy="122" r="16" fill="url(#blushGrad)" />

          {/* Eyes & Mouth */}
          {renderEyes()}
          {renderMouth()}
        </g>
      </svg>
    </div>
  );
}
