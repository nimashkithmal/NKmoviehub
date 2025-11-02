import React, { useRef, useEffect, useState } from 'react';
import './MoviePlayer.css';

// Helper function to detect video URL type
const getVideoType = (url) => {
  if (!url) return 'unknown';
  
  // Google Drive URLs
  if (url.includes('drive.google.com')) {
    return 'googledrive';
  }
  
  // YouTube URLs
  if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
    return 'youtube';
  }
  if (url.includes('youtube.com/embed')) {
    return 'youtube';
  }
  
  // Vimeo URLs
  if (url.includes('vimeo.com/')) {
    return 'vimeo';
  }
  if (url.includes('player.vimeo.com')) {
    return 'vimeo';
  }
  
  // Direct video file extensions
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.avi', '.mov', '.mkv', '.m3u8'];
  const lowerUrl = url.toLowerCase();
  if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
    return 'direct';
  }
  
  // If it starts with http/https and doesn't match above, try as direct video
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return 'direct';
  }
  
  return 'unknown';
};

// Helper function to extract Google Drive file ID and convert to playable URL
const getGoogleDrivePlayableUrl = (url) => {
  if (!url) return null;
  
  // Extract file ID from various Google Drive URL formats
  let fileId = null;
  
  // Format 1: https://drive.google.com/file/d/FILE_ID/view
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) {
    fileId = match1[1];
  }
  
  // Format 2: https://drive.google.com/open?id=FILE_ID
  if (!fileId) {
    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match2) {
      fileId = match2[1];
    }
  }
  
  // Format 3: https://drive.google.com/uc?id=FILE_ID
  if (!fileId) {
    const match3 = url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (match3) {
      fileId = match3[1];
    }
  }
  
  // Format 4: Direct file ID in URL path
  if (!fileId) {
    const match4 = url.match(/drive\.google\.com\/([a-zA-Z0-9_-]+)/);
    if (match4) {
      fileId = match4[1];
    }
  }
  
  if (fileId) {
    // Return object with both embed and direct URLs
    return {
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      directUrl: `https://drive.google.com/uc?export=download&id=${fileId}`
    };
  }
  
  return null;
};

// Helper function to extract YouTube video ID
const getYouTubeId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

// Helper function to extract Vimeo video ID
const getVimeoId = (url) => {
  const regExp = /(?:vimeo)\.com.*(?:videos|video|channels|)\/([\d]+)/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

const MoviePlayer = ({ movie, onClose }) => {
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoType, setVideoType] = useState('unknown');
  const [embedUrl, setEmbedUrl] = useState('');
  const [googleDriveUrls, setGoogleDriveUrls] = useState(null);

  // Determine video type and prepare embed URL
  useEffect(() => {
    if (!movie || !movie.movieUrl) return;
    
    const type = getVideoType(movie.movieUrl);
    setVideoType(type);
    
    if (type === 'googledrive') {
      const driveUrls = getGoogleDrivePlayableUrl(movie.movieUrl);
      if (driveUrls) {
        // Google Drive videos should use iframe embed viewer
        setGoogleDriveUrls(driveUrls);
        setEmbedUrl(driveUrls.embedUrl);
        setIsLoading(true);
      } else {
        setHasError(true);
        setErrorMessage('Invalid Google Drive URL. Note: Google Drive videos have embedding restrictions. The file must be: 1) Shared with "Anyone with the link can view", 2) A supported video format, 3) You may need to open it directly in a new tab.');
        setIsLoading(false);
      }
    } else if (type === 'youtube') {
      const videoId = getYouTubeId(movie.movieUrl);
      if (videoId) {
        setEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`);
        setIsLoading(false);
        setIsPlaying(true);
      } else {
        setHasError(true);
        setErrorMessage('Invalid YouTube URL');
        setIsLoading(false);
      }
    } else if (type === 'vimeo') {
      const videoId = getVimeoId(movie.movieUrl);
      if (videoId) {
        setEmbedUrl(`https://player.vimeo.com/video/${videoId}?autoplay=1`);
        setIsLoading(false);
        setIsPlaying(true);
      } else {
        setHasError(true);
        setErrorMessage('Invalid Vimeo URL');
        setIsLoading(false);
      }
    } else if (type === 'direct') {
      // Will be handled by video element
      setIsLoading(true);
    } else {
      setHasError(true);
      setErrorMessage('Unsupported video URL format');
      setIsLoading(false);
    }
  }, [movie?.movieUrl]);

  useEffect(() => {
    // Only handle direct video files (Google Drive uses iframe)
    if (videoType !== 'direct') return;
    
    const video = videoRef.current;
    if (!video) return;

    // Try to play video immediately
    const attemptPlay = async () => {
      // First try unmuted autoplay
      try {
        video.muted = false;
        video.volume = 1.0;
        await video.play();
        setIsPlaying(true);
        setShowPlayButton(false);
        setIsLoading(false);
        return;
      } catch (err) {
        console.log('Unmuted autoplay failed, trying muted autoplay...', err);
      }
      
      // Fallback to muted autoplay (browsers allow muted autoplay)
      try {
        video.muted = true;
        await video.play();
        setIsPlaying(true);
        setShowPlayButton(false);
        setIsLoading(false);
        // Unmute after a short delay
        setTimeout(() => {
          if (video) {
            video.muted = false;
            video.volume = 1.0;
          }
        }, 300);
        return;
      } catch (mutedErr) {
        console.error('Muted autoplay also failed:', mutedErr);
        // Show play button if both attempts fail
        setShowPlayButton(true);
        setIsLoading(false);
        video.muted = false; // Reset mute state
      }
    };

    // Set up event listeners
    const handlePlay = () => {
      setIsPlaying(true);
      setShowPlayButton(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleLoadedData = () => {
      setIsLoading(false);
      attemptPlay();
    };

    const handleError = (e) => {
      console.error('Video error:', e);
      setHasError(true);
      setIsLoading(false);
      
      const error = video.error;
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            setErrorMessage('Video loading was aborted.');
            break;
          case error.MEDIA_ERR_NETWORK:
            setErrorMessage('Network error while loading video.');
            break;
          case error.MEDIA_ERR_DECODE:
            setErrorMessage('Video decoding error.');
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            setErrorMessage('Video format not supported or URL is invalid.');
            break;
          default:
            setErrorMessage('An unknown error occurred.');
        }
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('canplay', handleCanPlay);

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Cleanup
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('canplay', handleCanPlay);
      document.body.style.overflow = 'unset';
      
      // Pause video on cleanup
      if (video) {
        video.pause();
        video.src = '';
      }
    };
  }, [videoType, movie?.movieUrl]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const handlePlayClick = async () => {
    const video = videoRef.current;
    if (video) {
      try {
        await video.play();
        setShowPlayButton(false);
      } catch (err) {
        console.error('Manual play failed:', err);
      }
    }
  };

  if (!movie || !movie.movieUrl) {
    return null;
  }

  return (
    <div className="movie-player-overlay" onClick={onClose}>
      <div className="movie-player-container" onClick={(e) => e.stopPropagation()}>
        <div className="movie-player-header">
          <h2 className="movie-player-title">{movie.title}</h2>
          <button className="movie-player-close" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="movie-player-video-wrapper">
          {isLoading && (
            <div className="video-loading-overlay">
              <div className="loading-spinner"></div>
              <p>Loading video...</p>
            </div>
          )}
          
          {hasError ? (
            <div className="video-error-overlay">
              <div className="error-icon">⚠️</div>
              <h3>Unable to play video</h3>
              <p>{errorMessage || 'An error occurred while loading the video.'}</p>
              {videoType === 'googledrive' && (
                <div className="google-drive-info">
                  <p><strong>Google Drive Video Limitations:</strong></p>
                  <ul>
                    <li>Google Drive videos cannot be embedded in iframes due to security restrictions</li>
                    <li>The file must be shared publicly with "Anyone with the link can view"</li>
                    <li>Use YouTube, Vimeo, or direct video URLs for better compatibility</li>
                    <li>You can click "Open Link" below to watch in Google Drive directly</li>
                  </ul>
                  <a 
                    href={movie.movieUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="open-link-button"
                    style={{
                      display: 'inline-block',
                      marginTop: '15px',
                      padding: '10px 20px',
                      background: '#4285f4',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      fontWeight: '600'
                    }}
                  >
                    Open Link in New Tab
                  </a>
                </div>
              )}
              <div className="error-url-info">
                <small>URL: {movie.movieUrl}</small>
              </div>
              <button 
                className="retry-button"
                onClick={() => {
                  setHasError(false);
                  setErrorMessage('');
                  setIsLoading(true);
                  
                  if (videoType === 'direct') {
                    const video = videoRef.current;
                    if (video) {
                      video.load();
                    }
                  } else {
                    // Reload iframe
                    const type = getVideoType(movie.movieUrl);
                    setVideoType('unknown');
                    setTimeout(() => {
                      const newType = getVideoType(movie.movieUrl);
                      setVideoType(newType);
                    }, 100);
                  }
                }}
              >
                Retry
              </button>
            </div>
          ) : videoType === 'youtube' || videoType === 'vimeo' || videoType === 'googledrive' ? (
            <>
              <iframe
                ref={iframeRef}
                className="movie-player-video"
                src={embedUrl}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                title={movie.title}
                onLoad={() => {
                  setIsLoading(false);
                  setIsPlaying(true);
                }}
                onError={() => {
                  setHasError(true);
                  setErrorMessage('Google Drive videos cannot be embedded due to security restrictions. Please ensure the file is: 1) Shared publicly with "Anyone with the link can view" permission, 2) A video file format (MP4, WebM, etc.), and 3) Try opening the link directly in a new tab instead.');
                  setIsLoading(false);
                }}
              />
            </>
          ) : (
            <>
              <video
                ref={videoRef}
                className="movie-player-video"
                controls
                autoPlay
                playsInline
                preload="auto"
                src={movie.movieUrl}
                crossOrigin="anonymous"
                onLoadedData={() => setIsLoading(false)}
              >
                <source 
                  src={movie.movieUrl} 
                  type="video/mp4" 
                />
                <source 
                  src={movie.movieUrl} 
                  type="video/webm" 
                />
                <source 
                  src={movie.movieUrl} 
                  type="video/ogg" 
                />
                Your browser does not support the video tag.
              </video>
              
              {showPlayButton && !isPlaying && (
                <div className="video-play-overlay" onClick={(e) => e.stopPropagation()}>
                  <button className="play-button-large" onClick={handlePlayClick}>
                    ▶
                  </button>
                  <p>Click to play</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoviePlayer;

