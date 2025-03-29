"use client";

import { createContext, useContext, useEffect, useRef, useState } from 'react';

// Define types for audio context
type AudioContextType = {
  isMuted: boolean;
  isPlaying: boolean;
  toggleMute: () => void;
  togglePlayPause: () => void;
  playEasterEggSound: () => Promise<void>;
  stopEasterEggSound: (fadeOut?: boolean) => void;
  resumeBackgroundMusic: () => void;
  audioData: Uint8Array | null;
};

// Create context with default values
const AudioContext = createContext<AudioContextType>({
  isMuted: false,
  isPlaying: false,
  toggleMute: () => {},
  togglePlayPause: () => {},
  playEasterEggSound: async () => {},
  stopEasterEggSound: () => {},
  resumeBackgroundMusic: () => {},
  audioData: null,
});

// Custom event for audio mute toggle
export const audioMuteToggledEvent = new CustomEvent('audio-mute-toggled');
// Custom event for play/pause toggle
export const audioPlayPauseToggledEvent = new CustomEvent('audio-playpause-toggled');

// Custom hook for using audio context
export const useAudio = () => useContext(AudioContext);

export default function AudioManager({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);

  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const easterEggSoundRef = useRef<HTMLAudioElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      backgroundMusicRef.current = new Audio('/sounds/lofi.mp3');
      backgroundMusicRef.current.loop = true;
      backgroundMusicRef.current.volume = 0.5;

      easterEggSoundRef.current = new Audio('/sounds/chicks_cheeps.mp3');
      easterEggSoundRef.current.loop = false;

      audioContextRef.current = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;

      if (backgroundMusicRef.current && analyserRef.current && audioContextRef.current) {
        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(backgroundMusicRef.current);
        sourceNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }

      backgroundMusicRef.current.load();
      easterEggSoundRef.current.load();

      if (backgroundMusicRef.current) {
        // We need to add event listeners before attempting to play
        // But they should not directly update state to avoid circular updates
        backgroundMusicRef.current.addEventListener('playing', () => {
          // Don't update React state from HTML audio events
          // This just enables visualization when audio is playing
          startVisualization();
        });

        backgroundMusicRef.current.addEventListener('pause', () => {
          // Don't update React state from HTML audio events
          // This just disables visualization when audio is paused
          stopVisualization();
        });

        backgroundMusicRef.current.addEventListener('ended', () => {
          if (backgroundMusicRef.current && !isMuted) {
            backgroundMusicRef.current.currentTime = 0;
            backgroundMusicRef.current.play().catch(e => {
              if (e.name !== 'AbortError') {
                console.error('Fallback play failed:', e);
              }
            });
          }
        });
      }

      setTimeout(() => {
        if (backgroundMusicRef.current) {
          if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume().catch(e => {
              console.log("Audio context resume failed:", e);
            });
          }

          const playPromise = backgroundMusicRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              setIsPlaying(true);
            }).catch(e => {
              if (e.name === 'NotAllowedError') {
                console.log("Auto-play prevented. User interaction needed to start audio.");
                setIsPlaying(false);
              } else if (e.name !== 'AbortError') {
                console.log("Audio playback error:", e);
                setIsPlaying(false);
              }
            });
          }
        }
      }, 100);

      const attemptPlayOnInteraction = () => {
        if (backgroundMusicRef.current && !isPlaying && !isMuted) {
          const playPromise = backgroundMusicRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              setIsPlaying(true);
              document.removeEventListener('click', attemptPlayOnInteraction);
              document.removeEventListener('keydown', attemptPlayOnInteraction);
              document.removeEventListener('touchstart', attemptPlayOnInteraction);
            }).catch(e => {
              console.error("Play on interaction failed:", e);
            });
          }
        }
      };

      document.addEventListener('click', attemptPlayOnInteraction);
      document.addEventListener('keydown', attemptPlayOnInteraction);
      document.addEventListener('touchstart', attemptPlayOnInteraction);

    } catch (error) {
      console.error("Failed to initialize audio:", error);
    }

    return () => {
      stopVisualization();

      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current = null;
      }

      if (easterEggSoundRef.current) {
        easterEggSoundRef.current.pause();
        easterEggSoundRef.current = null;
      }

      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => console.error('Error closing audio context:', e));
        audioContextRef.current = null;
      }

      document.removeEventListener('click', () => {});
      document.removeEventListener('keydown', () => {});
      document.removeEventListener('touchstart', () => {});
    };
  }, []);

  const startVisualization = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVisualization = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      setAudioData(new Uint8Array(dataArray));

      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    };

    updateVisualization();
  };

  const stopVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioData(null);
  };

  // Handle mute state changes - affects ALL audio
  useEffect(() => {
    if (!backgroundMusicRef.current || !easterEggSoundRef.current) return;

    if (isMuted) {
      // Mute affects volume, not playback state
      backgroundMusicRef.current.volume = 0;
      easterEggSoundRef.current.volume = 0;
    } else {
      // Restore volumes
      backgroundMusicRef.current.volume = 0.5;
      easterEggSoundRef.current.volume = 1.0;

      // Resume audio context if suspended
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    }
  }, [isMuted]);

  // Handle play/pause state changes without causing circular updates
  useEffect(() => {
    // This effect shouldn't run on initial render
    const audio = backgroundMusicRef.current;
    if (!audio) return;

    // This effect only syncs the audio element with our React state
    // It should not trigger state changes itself
    
    const currentlyPlaying = !audio.paused;
    
    // Only take action if there's a mismatch between desired state and current audio state
    if (isPlaying !== currentlyPlaying) {
      if (isPlaying) {
        // We want to be playing, but audio is paused
        if (audio.loop === false) {
          audio.loop = true;
        }
        
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        
        // Explicitly avoid capturing the promise to prevent unwanted state updates
        audio.play().catch(e => {
          // Only log errors, don't update state here to avoid cycles
          if (e.name !== 'AbortError') {
            console.error("Play failed in effect:", e);
          }
        });
      } else {
        // We want to be paused, but audio is playing
        audio.pause();
      }
    }
  }, [isPlaying]);

  // Toggle audio mute (affects ALL audio)
  const toggleMute = () => {
    document.dispatchEvent(new CustomEvent('audio-mute-toggled'));
    setIsMuted(prev => !prev);
  };

  // Toggle play/pause (only affects background music)
  const togglePlayPause = () => {
    if (!backgroundMusicRef.current) return;

    // Determine current state and desired new state
    const currentlyPlaying = !backgroundMusicRef.current.paused;
    const shouldPlay = !currentlyPlaying;
    
    // First update state to match what we want
    setIsPlaying(shouldPlay);
    
    // Then perform the audio operation
    if (shouldPlay) {
      // Need to play the audio
      if (backgroundMusicRef.current.paused) {
        // Play if it's currently paused
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        
        const playPromise = backgroundMusicRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.error("Play failed:", e);
              // If failed, revert state
              setIsPlaying(false);
            }
          });
        }
      }
    } else {
      // Need to pause the audio
      if (!backgroundMusicRef.current.paused) {
        backgroundMusicRef.current.pause();
      }
    }
    
    // Notify other components about the change
    document.dispatchEvent(new CustomEvent('audio-playpause-toggled'));
  };

  const playEasterEggSound = async (): Promise<void> => {
    if (isMuted || !easterEggSoundRef.current) return Promise.resolve();

    // Pause background music but remember its state
    const wasPlaying = isPlaying;
    if (backgroundMusicRef.current && isPlaying) {
      backgroundMusicRef.current.pause();
    }

    try {
      easterEggSoundRef.current.currentTime = 0;
      const playPromise = easterEggSoundRef.current.play();

      if (playPromise !== undefined) {
        return playPromise.catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Easter egg sound play failed:", e);
          }
          // Resume background music if it was playing before
          if (wasPlaying) resumeBackgroundMusic();
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error("Easter egg sound error:", e);
      }
      // Resume background music if it was playing before
      if (wasPlaying) resumeBackgroundMusic();
    }

    return Promise.resolve();
  };

  const stopEasterEggSound = (fadeOut: boolean = true) => {
    if (!easterEggSoundRef.current) return;

    if (fadeOut) {
      const fadeInterval = setInterval(() => {
        if (!easterEggSoundRef.current) {
          clearInterval(fadeInterval);
          return;
        }

        if (easterEggSoundRef.current.volume > 0.05 && !isMuted) {
          easterEggSoundRef.current.volume -= 0.05;
        } else {
          easterEggSoundRef.current.pause();
          if (!isMuted) easterEggSoundRef.current.volume = 1.0; // Reset volume if not muted
          clearInterval(fadeInterval);
          resumeBackgroundMusic();
        }
      }, 50);
    } else {
      easterEggSoundRef.current.pause();
      easterEggSoundRef.current.currentTime = 0;
      resumeBackgroundMusic();
    }
  };

  const resumeBackgroundMusic = () => {
    // Only resume if the audio should be playing and isn't already
    if (!backgroundMusicRef.current || !isPlaying) return;
    
    // Check if it's already playing - no need to trigger again
    if (!backgroundMusicRef.current.paused) return;

    try {
      // Ensure loop property is set correctly
      if (backgroundMusicRef.current.loop === false) {
        backgroundMusicRef.current.loop = true;
      }
      
      // Resume audio context if needed
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }

      const playPromise = backgroundMusicRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Background music resume failed:", e);
            // Update state if playback failed
            setIsPlaying(false);
          }
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error("Background music resume error:", e);
        // Update state if playback failed
        setIsPlaying(false);
      }
    }
  };

  return (
    <AudioContext.Provider
      value={{
        isMuted,
        isPlaying,
        toggleMute,
        togglePlayPause,
        playEasterEggSound,
        stopEasterEggSound,
        resumeBackgroundMusic,
        audioData,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}
