import React, { useState } from 'react';
import { useModelLoader } from '../hooks/useModelLoader';
import { saveProfile } from '../db';
import { hashPin, generateRandomHex } from '../services/crypto';
import type { UserProfile, Language } from '../types';

interface OnboardingProps {
  profile: UserProfile | null;
}

export default function Onboarding({ profile }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [language, setLanguage] = useState<Language>('english');
  
  const { progress, isComplete, loadAll } = useModelLoader();

  const handleNext = () => {
    if (step === 1 && name.trim()) setStep(2);
    else if (step === 2 && pin.length === 4) setStep(3);
    else if (step === 3) {
      setStep(4);
      loadAll();
    }
  };

  const handleFinish = async () => {
    const salt = generateRandomHex(16);
    const hashed = await hashPin(pin, salt);

    const newProfile: UserProfile = {
      name,
      pinHash: hashed,
      pinSalt: salt,
      language,
      rantMode: false,
      onboardingComplete: true,
      modelsDownloaded: true,
      cloudBackup: false,
      likedPatterns: [],
      dislikedPatterns: [],
      createdAt: Date.now()
    };

    await saveProfile(newProfile);
    window.location.reload(); // Refresh to trigger router redirect to Home
  };

  return (
    <>
      <div className="bg">
        <div className="blob a"></div>
        <div className="blob b"></div>
        <div className="blob c"></div>
      </div>
      
      <div className="app" style={{ justifyContent: 'center' }}>
        <div className="glass panel animate-slide-up">
          
          {step === 1 && (
            <>
              <h1 style={{ fontSize: '24px', margin: 0 }}>Welcome to Emoh</h1>
              <p className="opacity-70 text-sm" style={{ fontStyle: 'italic' }}>
                "A safe space for your mind. Meet your local buddy, Emoh"
              </p>
              
              <div className="mt-4">
                <label className="text-sm block mb-2 font-medium">What should I call you?</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Your name" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNext()}
                />
              </div>
              
              <button className="btn btn-primary mt-4" onClick={handleNext} disabled={!name.trim()}>
                Next
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ fontSize: '22px', margin: 0 }}>Set a PIN</h2>
              <p className="opacity-70 text-sm mb-4">
                Emoh is private and works entirely offline. Set a 4-digit PIN to encrypt your local backups.
              </p>
              
              <input 
                type="password" 
                className="input-field" 
                style={{ fontSize: '24px', letterSpacing: '12px' }}
                maxLength={4}
                placeholder="••••" 
                value={pin} 
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handleNext()}
              />
              
              <button className="btn btn-primary mt-4" onClick={handleNext} disabled={pin.length !== 4}>
                Next
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ fontSize: '22px', margin: 0 }}>How should we talk?</h2>
              <div className="flex flex-col gap-2 mt-4">
                {(['english', 'taglish', 'tagalog'] as Language[]).map(lang => (
                  <button 
                    key={lang}
                    className={`btn ${language === lang ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setLanguage(lang)}
                  >
                    {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </button>
                ))}
              </div>
              
              <button className="btn btn-primary mt-4" onClick={handleNext}>
                Start Downloading Emoh's Brain
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={{ fontSize: '22px', margin: 0 }}>Teaching Emoh to listen...</h2>
              <p className="opacity-70 text-sm mb-4">
                This downloads the AI models to your device. It only happens once. About ~1GB total.
              </p>
              
              <div className="flex flex-col gap-4 text-left">
                {progress.map((p, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs opacity-70 mb-2">
                      <span>{p.modelName}</span>
                      <span>{p.progress}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {isComplete && (
                <button className="btn btn-primary mt-4 animate-slide-up" onClick={handleFinish}>
                  Meet Emoh
                </button>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
