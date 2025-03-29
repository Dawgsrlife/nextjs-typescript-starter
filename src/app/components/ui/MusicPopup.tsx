"use client";

import { useAudio } from '../AudioManager';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { toggleMusicPlayerEvent } from '../HotKeys';

// Create custom events for popup state management
export const musicPopupStateEvent = new CustomEvent('musicPopupStateChanged', { detail: false });
export const musicPopupClosedEvent = new CustomEvent('musicPopupClosed');
export const requestCloseAllPopupsEvent = new CustomEvent('requestCloseAllPopups');

export default function MusicPopup() {
  const { isPlaying, isMuted, toggleMute, audioData } = useAudio();
  const [showPopup, setShowPopup] = useState(false);
  const [autoHide, setAutoHide] = useState(true);
  const [trackInfo, setTrackInfo] = useState({
    title: "Chill Lofi Beats",
    artist: "Next.js Twilight",
    duration: "∞",
  });

  // Track current beat for animation
  const [beat, setBeat] = useState(0);
  
  // Show popup when music status changes, only if autoHide is enabled
  useEffect(() => {
    if (!autoHide) return; // Skip auto-show/hide if disabled
    
    // Any change in playback status should trigger the popup
    setShowPopup(true);
    
    // Hide popup after 8 seconds
    const timer = setTimeout(() => {
      setShowPopup(false);
    }, 8000);
    
    return () => clearTimeout(timer);
  }, [isPlaying, isMuted, autoHide]);

  // Toggle popup visibility
  const togglePopup = useCallback(() => {
    const newState = !showPopup;
    setShowPopup(newState);
    setAutoHide(false); // Disable auto-hide when manually toggled
    
    // Dispatch event to notify other components
    document.dispatchEvent(new CustomEvent('musicPopupStateChanged', { detail: newState }));
  }, [showPopup]);
  
  // Listen for Escape key to close popups
  useEffect(() => {
    const handleCloseAllPopups = () => {
      if (showPopup) {
        setShowPopup(false);
        document.dispatchEvent(musicPopupClosedEvent);
      }
    };
    
    document.addEventListener('requestCloseAllPopups', handleCloseAllPopups);
    
    return () => {
      document.removeEventListener('requestCloseAllPopups', handleCloseAllPopups);
    };
  }, [showPopup]);
  
  // Listen for toggle event from keyboard shortcut
  useEffect(() => {
    const handleToggleEvent = () => {
      togglePopup();
    };
    
    document.addEventListener('toggleMusicPlayer', handleToggleEvent);
    return () => document.removeEventListener('toggleMusicPlayer', handleToggleEvent);
  }, [togglePopup]);
  
  // Create beat animation
  useEffect(() => {
    if (!isPlaying || isMuted) return;

    const interval = setInterval(() => {
      setBeat(prev => (prev + 1) % 4);
    }, 600); // 100 BPM
    
    return () => clearInterval(interval);
  }, [isPlaying, isMuted]);

  // Process audio data for visualization
  const barHeights = useMemo(() => {
    if (!audioData || audioData.length === 0) {
      // Default animation when no audio data is available
      return [0.4, 0.6, 0.8].map(() => ({
        height: Math.random() * 20 + 5,
        value: 0
      }));
    }

    // Sample a few frequency bands for the visualization
    // Focus on lower and mid frequencies which are more prominent in lofi music
    const lowIdx = Math.floor(audioData.length * 0.1);  // Low frequencies
    const midIdx = Math.floor(audioData.length * 0.3);  // Mid frequencies
    const highIdx = Math.floor(audioData.length * 0.6); // Higher-mid frequencies

    return [
      {
        height: (audioData[lowIdx] / 255) * 24 + 4, // Scale to reasonable height
        value: audioData[lowIdx]
      },
      {
        height: (audioData[midIdx] / 255) * 24 + 4,
        value: audioData[midIdx]
      },
      {
        height: (audioData[highIdx] / 255) * 20 + 4,
        value: audioData[highIdx]
      }
    ];
  }, [audioData]);

  // Fixed positions for popup and button
  const popupPosition = "bottom-24";
  const buttonPosition = "bottom-8";

  return (
    <>
      {/* Music Player Popup */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            className={`fixed right-24 z-40 bg-[rgb(var(--card))] shadow-lg rounded-lg border border-[rgb(var(--border))] overflow-hidden ${popupPosition}`}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            layout
          >
            {/* Purple gradient top bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 to-pink-500" />
            
            <div className="p-4 flex items-center space-x-4">
              {/* Vinyl Album Cover Animation */}
              <motion.div 
                className="h-14 w-14 rounded-md bg-gradient-to-br from-purple-900 via-violet-800 to-indigo-900 overflow-hidden flex items-center justify-center shadow-inner"
                animate={{ rotate: 360 }}
                transition={{ 
                  duration: 10, 
                  repeat: Infinity, 
                  ease: "linear"
                }}
                style={{
                  backgroundImage: "radial-gradient(circle at center, transparent 30%, rgba(255,255,255,0.07) 31%, rgba(255,255,255,0.07) 32%, transparent 33%, transparent 50%, rgba(255,255,255,0.05) 51%, rgba(255,255,255,0.05) 52%, transparent 53%)"
                }}
              >
                <div className="w-3 h-3 bg-[rgb(var(--background))] rounded-full" />
              </motion.div>
              
              <div className="flex-1 flex flex-col min-w-32">
                <div className="flex justify-between items-center">
                  <p className="font-medium truncate">{trackInfo.title}</p>
                  
                  {/* Close button */}
                  <button 
                    onClick={() => {
                      setShowPopup(false);
                      document.dispatchEvent(new CustomEvent('musicPopupStateChanged', { detail: false }));
                    }}
                    className="p-1 -mr-2 -mt-1 rounded-md hover:bg-[rgb(var(--muted))] transition-colors"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <p className="text-xs text-[rgb(var(--muted-foreground))] truncate">{trackInfo.artist}</p>
                
                {/* Status indicator */}
                <div className="mt-1 flex items-center">
                  <span className="text-xs font-medium flex items-center">
                    <motion.span 
                      className={`inline-block w-2 h-2 rounded-full mr-1.5 ${!isMuted ? 'bg-green-500' : 'bg-red-500'}`}
                      animate={!isMuted ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    {!isMuted ? 'Playing' : 'Paused'}
                  </span>
                  
                  {/* Keyboard hint */}
                  <span className="text-xs text-[rgb(var(--muted-foreground))] ml-2">
                    Press <kbd className="px-1 py-0.5 bg-[rgb(var(--muted))] rounded text-[10px] border border-[rgb(var(--border))]">Space</kbd> to toggle
                  </span>
                </div>
                
                {/* Progress Dots */}
                <div className="mt-1 flex items-center space-x-1">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div 
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i === beat ? 'bg-[rgb(var(--primary))]' : 'bg-[rgb(var(--muted))]'
                      }`}
                      animate={i === beat && !isMuted ? { scale: [1, 1.5, 1] } : {}}
                      transition={{ duration: 0.3 }}
                    />
                  ))}
                  <div className="text-xs text-[rgb(var(--muted-foreground))] ml-2 flex items-center">
                    {/* Infinity loop symbol */}
                    <motion.svg 
                      xmlns="http://www.w3.org/2000/svg"
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="mr-1"
                      animate={{ 
                        rotate: [0, 360],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{
                        rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                        scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                      }}
                    >
                      <path d="M18.1784 8C23.2784 8 23.2784 16 18.1784 16C13.0784 16 10.9784 8 5.87842 8C0.778418 8 0.778418 16 5.87842 16C10.9784 16 13.0784 8 18.1784 8Z" />
                    </motion.svg>
                    Looping
                  </div>
                </div>
              </div>
              
              {/* Live Audio Waveform Visualization */}
              <div className="relative h-10 w-8 flex items-end justify-center space-x-px">
                {barHeights.map((bar, i) => (
                  <motion.div
                    key={i}
                    className="w-2 bg-gradient-to-t from-purple-500 to-pink-500 rounded-t-sm"
                    style={{ 
                      height: `${bar.height}px`,
                      opacity: Math.max(0.4, bar.value / 255) // Ensure minimum visibility
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                ))}
              </div>
              
              {/* Mute/Unmute Button */}
              <motion.button
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-[rgb(var(--muted))] transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={1.5} 
                  stroke="currentColor" 
                  className="w-5 h-5"
                >
                  {!isMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  )}
                </svg>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Music Player Toggle Button */}
      {!showPopup && (
        <motion.button
          className={`fixed right-24 z-50 p-3 bg-[rgb(var(--card))] rounded-full shadow-md border border-[rgb(var(--border))] hover:bg-[rgb(var(--muted))] transition-colors ${buttonPosition}`}
          onClick={togglePopup}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          title="Show music player (CTRL+J)"
          layout
        >
          <motion.div className="relative">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 19a7 7 0 1 0 0-14"></path>
            </svg>
            {!isMuted && (
              <motion.span 
                className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.div>
        </motion.button>
      )}
    </>
  );
} 