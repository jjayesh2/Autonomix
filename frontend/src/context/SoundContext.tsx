import React, { createContext, useContext, useState, useEffect } from 'react';
import { soundEffects } from '../lib/audio.js';

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  playClick: () => void;
  playSuccess: () => void;
  playError: () => void;
  playProgress: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('autonomix_sound_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('autonomix_sound_enabled', String(soundEnabled));
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) soundEffects.playClick(true);
      return next;
    });
  };

  const playClick = () => soundEffects.playClick(soundEnabled);
  const playSuccess = () => soundEffects.playSuccess(soundEnabled);
  const playError = () => soundEffects.playError(soundEnabled);
  const playProgress = () => soundEffects.playProgress(soundEnabled);

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        toggleSound,
        playClick,
        playSuccess,
        playError,
        playProgress,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) throw new Error('useSound must be used within SoundProvider');
  return context;
};
