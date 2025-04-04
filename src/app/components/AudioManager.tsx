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
  const [easterEggActive, setEasterEggActive] = useState(false);

  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const easterEggSoundRef = useRef<HTMLAudioElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Use refs to store event handlers for cleanup
  const updateMediaSessionStateRef = useRef<(() => void) | null>(null);
  const mediaSessionPlayHandlerRef = useRef<(() => void) | null>(null);
  const mediaSessionPauseHandlerRef = useRef<(() => void) | null>(null);
  const attemptPlayOnInteractionRef = useRef<(() => void) | null>(null);
  const firstToggleDoneRef = useRef<boolean>(false);
  
  // Add refs to track state without adding dependencies
  const isMutedRef = useRef(isMuted);
  const isPlayingRef = useRef(isPlaying);
  
  // Keep the refs in sync with the state
  useEffect(() => {
    isMutedRef.current = isMuted;
    isPlayingRef.current = isPlaying;
  }, [isMuted, isPlaying]);

   
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
        // Let the audio element directly control state
        // This ensures our React state always reflects the true state of the audio element
        backgroundMusicRef.current.addEventListener('playing', () => {
          console.log('Audio playing event fired');
          setIsPlaying(true);
          startVisualization();
        });

        backgroundMusicRef.current.addEventListener('pause', () => {
          console.log('Audio pause event fired');
          setIsPlaying(false);
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

      // Define handlers and store in refs for cleanup
      updateMediaSessionStateRef.current = () => {
        if (!('mediaSession' in navigator)) return;
        
        if (isPlaying) {
          navigator.mediaSession.playbackState = 'playing';
        } else {
          navigator.mediaSession.playbackState = 'paused';
        }
      };
      
      mediaSessionPlayHandlerRef.current = () => {
        if (backgroundMusicRef.current?.paused) {
          togglePlayPause();
        }
      };
      
      mediaSessionPauseHandlerRef.current = () => {
        if (!backgroundMusicRef.current?.paused) {
          togglePlayPause();
        }
      };
      
      attemptPlayOnInteractionRef.current = () => {
        // Only attempt to play on interaction if we haven't manually paused (firstToggle)
        // This fixes the issue where pressing any button after first pause starts playing again
        if (backgroundMusicRef.current && !isPlayingRef.current && !isMutedRef.current && !firstToggleDoneRef.current) {
          console.log('Attempting to play on user interaction');
          const playPromise = backgroundMusicRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              console.log('Play on interaction succeeded');
              setIsPlaying(true);
              if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
              }
              document.removeEventListener('click', attemptPlayOnInteractionRef.current!);
              document.removeEventListener('keydown', attemptPlayOnInteractionRef.current!);
              document.removeEventListener('touchstart', attemptPlayOnInteractionRef.current!);
            }).catch(e => {
              console.error("Play on interaction failed:", e);
            });
          }
        }
      };

      // Set up MediaSession API for OS media controls
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Lofi Beats',
          artist: 'Next.js Twilight',
          album: 'Background Music',
          artwork: [
            { src: '/logo.png', sizes: '512x512', type: 'image/png' }
          ]
        });

        // Initial state
        updateMediaSessionStateRef.current();

        // Listen for our own state changes
        document.addEventListener('audio-playpause-toggled', updateMediaSessionStateRef.current);
        
        // Set up the action handlers
        navigator.mediaSession.setActionHandler('play', mediaSessionPlayHandlerRef.current);
        navigator.mediaSession.setActionHandler('pause', mediaSessionPauseHandlerRef.current);
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
              console.log("Initial autoplay succeeded");
              setIsPlaying(true);
              if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
              }
            }).catch(e => {
              if (e.name === 'NotAllowedError') {
                console.log("Auto-play prevented. User interaction needed to start audio.");
                setIsPlaying(false);
                if ('mediaSession' in navigator) {
                  navigator.mediaSession.playbackState = 'paused';
                }
              } else if (e.name !== 'AbortError') {
                console.log("Audio playback error:", e);
                setIsPlaying(false);
                if ('mediaSession' in navigator) {
                  navigator.mediaSession.playbackState = 'paused';
                }
              }
            });
          }
        }
      }, 100);

      document.addEventListener('click', attemptPlayOnInteractionRef.current);
      document.addEventListener('keydown', attemptPlayOnInteractionRef.current);
      document.addEventListener('touchstart', attemptPlayOnInteractionRef.current);

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

      if ('mediaSession' in navigator && updateMediaSessionStateRef.current) {
        // Clean up MediaSession handlers
        document.removeEventListener('audio-playpause-toggled', updateMediaSessionStateRef.current);
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      }

      if (attemptPlayOnInteractionRef.current) {
        document.removeEventListener('click', attemptPlayOnInteractionRef.current);
        document.removeEventListener('keydown', attemptPlayOnInteractionRef.current);
        document.removeEventListener('touchstart', attemptPlayOnInteractionRef.current);
      }
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
      
      // Only set Easter egg sound volume if it's active
      if (easterEggActive && !easterEggSoundRef.current.paused) {
        easterEggSoundRef.current.volume = 1.0;
      }

      // Resume audio context if suspended
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    }
  }, [isMuted, easterEggActive]);

  // Handle play/pause state changes without causing circular updates
   
  useEffect(() => {
    // This effect shouldn't run on initial render
    const audio = backgroundMusicRef.current;
    if (!audio) return;

    // Only update the audio element if its current state doesn't match our React state
    // This prevents cycles since the audio element's events will update the React state
    const currentlyPlaying = !audio.paused;
    
    console.log('Play/pause effect triggered:', { isPlaying, currentlyPlaying });
    
    if (isPlaying !== currentlyPlaying) {
      if (isPlaying) {
        // We want to be playing, but audio is paused
        console.log('State wants playing, audio is paused - playing now');
        if (audio.loop === false) {
          audio.loop = true;
        }
        
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        
        // Play the audio without capturing the promise
        // This will trigger the 'playing' event which will update the state
        audio.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Play failed in effect:", e);
          }
        });
      } else {
        // We want to be paused, but audio is playing
        console.log('State wants paused, audio is playing - pausing now');
        // This will trigger the 'pause' event which will update the state
        audio.pause();
      }
    }
    // We intentionally omit isMuted from the dependencies
  }, [isPlaying]);

  // Toggle audio mute (affects ALL audio)
  const toggleMute = () => {
    document.dispatchEvent(new CustomEvent('audio-mute-toggled'));
    setIsMuted(prev => !prev);
  };

  // Toggle play/pause (only affects background music)
  const togglePlayPause = () => {
    if (!backgroundMusicRef.current) return;

    console.log('Toggle play/pause called, current paused state:', backgroundMusicRef.current.paused, 'firstToggleDone:', firstToggleDoneRef.current);
    
    // Special handling for the first toggle (first pause action)
    if (!firstToggleDoneRef.current && !backgroundMusicRef.current.paused) {
      console.log('First toggle detected - ensuring pause works correctly');
      backgroundMusicRef.current.pause();
      setIsPlaying(false);
      firstToggleDoneRef.current = true;
      
      // Update MediaSession API state
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      
      // Notify other components about the change
      document.dispatchEvent(new CustomEvent('audio-playpause-toggled'));
      return;
    }
    
    // After first toggle, this is normal behavior
    // Directly control the audio element based on its current state
    // The audio element events will update the React state
    if (backgroundMusicRef.current.paused) {
      // Audio is paused, so play it
      console.log('Audio is paused, attempting to play');
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      backgroundMusicRef.current.play().catch(e => {
        if (e.name !== 'AbortError') {
          console.error("Play failed:", e);
          
          // Update MediaSession API state
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
        }
      });
    } else {
      // Audio is playing, so pause it
      console.log('Audio is playing, pausing now');
      backgroundMusicRef.current.pause();
      // Force React state update in case the pause event doesn't fire properly
      setIsPlaying(false);
      
      // Update MediaSession API state
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
    
    firstToggleDoneRef.current = true;
    
    // Notify other components about the change
    document.dispatchEvent(new CustomEvent('audio-playpause-toggled'));
  };

  const playEasterEggSound = async (): Promise<void> => {
    // Don't return early if muted, just adjust volume
    if (!easterEggSoundRef.current) return Promise.resolve();
    
    // Set Easter egg as active
    setEasterEggActive(true);

    // Pause background music but remember its state
    const wasPlaying = isPlaying;
    if (backgroundMusicRef.current && isPlaying) {
      backgroundMusicRef.current.pause();
      
      // Update MediaSession to show we're playing a different audio
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Easter Egg Sound',
          artist: 'Next.js Twilight',
          artwork: [
            { src: '/logo.png', sizes: '512x512', type: 'image/png' }
          ]
        });
        
        // Create a temporary handler just for the Easter egg sound
        const easterEggPauseHandler = () => {
          if (easterEggSoundRef.current && !easterEggSoundRef.current.paused) {
            stopEasterEggSound(false);
          }
        };
        
        // Store the Easter egg handlers for cleanup and set action handler
        mediaSessionPauseHandlerRef.current = easterEggPauseHandler;
        navigator.mediaSession.setActionHandler('pause', easterEggPauseHandler);
        
        navigator.mediaSession.playbackState = 'playing';
      }
    }

    try {
      // Set volume based on mute state
      easterEggSoundRef.current.volume = isMuted ? 0 : 1.0;
      easterEggSoundRef.current.currentTime = 0;
      const playPromise = easterEggSoundRef.current.play();

      if (playPromise !== undefined) {
        return playPromise.catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Easter egg sound play failed:", e);
          }
          // Resume background music if it was playing before
          if (wasPlaying) resumeBackgroundMusic();
          setEasterEggActive(false);
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error("Easter egg sound error:", e);
      }
      // Resume background music if it was playing before
      if (wasPlaying) resumeBackgroundMusic();
      setEasterEggActive(false);
    }

    return Promise.resolve();
  };

  const stopEasterEggSound = (fadeOut: boolean = true) => {
    if (!easterEggSoundRef.current) return;

    if (fadeOut) {
      const fadeInterval = setInterval(() => {
        if (!easterEggSoundRef.current) {
          clearInterval(fadeInterval);
          setEasterEggActive(false);
          return;
        }

        if (easterEggSoundRef.current.volume > 0.05 && !isMuted) {
          easterEggSoundRef.current.volume -= 0.05;
        } else {
          easterEggSoundRef.current.pause();
          if (!isMuted) easterEggSoundRef.current.volume = 1.0; // Reset volume if not muted
          clearInterval(fadeInterval);
          resumeBackgroundMusic();
          setEasterEggActive(false);
          
          // Restore MediaSession to background music after easter egg sound stops
          restoreBackgroundMusicMediaSession();
        }
      }, 50);
    } else {
      easterEggSoundRef.current.pause();
      easterEggSoundRef.current.currentTime = 0;
      resumeBackgroundMusic();
      setEasterEggActive(false);
      
      // Restore MediaSession to background music after easter egg sound stops
      restoreBackgroundMusicMediaSession();
    }
  };
  
  // Helper function to restore MediaSession for background music
  const restoreBackgroundMusicMediaSession = () => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Lofi Beats',
        artist: 'Next.js Twilight',
        album: 'Background Music',
        artwork: [
          { src: '/logo.png', sizes: '512x512', type: 'image/png' }
        ]
      });
      
      // Restore the original MediaSession handlers
      if (mediaSessionPlayHandlerRef.current && mediaSessionPauseHandlerRef.current) {
        navigator.mediaSession.setActionHandler('play', mediaSessionPlayHandlerRef.current);
        navigator.mediaSession.setActionHandler('pause', mediaSessionPauseHandlerRef.current);
      } else {
        // Fallback if refs are not available
        navigator.mediaSession.setActionHandler('play', () => {
          if (backgroundMusicRef.current && backgroundMusicRef.current.paused) {
            togglePlayPause();
          }
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
          if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
            togglePlayPause();
          }
        });
      }
      
      // Update playback state based on actual audio element state
      if (backgroundMusicRef.current) {
        navigator.mediaSession.playbackState = backgroundMusicRef.current.paused ? 'paused' : 'playing';
      } else {
        navigator.mediaSession.playbackState = 'paused';
      }
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
        playPromise.then(() => {
          // Update MediaSession state on successful playback resumption
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        }).catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Background music resume failed:", e);
            // Update state if playback failed
            setIsPlaying(false);
            
            // Update MediaSession state on failure
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'paused';
            }
          }
        });
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error("Background music resume error:", e);
        // Update state if playback failed
        setIsPlaying(false);
        
        // Update MediaSession state on error
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
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
