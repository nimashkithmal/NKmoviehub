import React, { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import './MoviePlayer.css';

const isHlsUrl = (url = '') => /\.m3u8(\?|$)/i.test(url);

const getDirectSources = (movie) => {
  if (!movie?.movieUrl) return [];
  if (Array.isArray(movie.qualitySources) && movie.qualitySources.length) {
    return movie.qualitySources
      .filter((source) => source?.url)
      .map((source, index) => ({
        id: source.id || `q-${index}`,
        label: source.label || `Quality ${index + 1}`,
        url: source.url
      }));
  }
  return [{ id: 'default', label: 'Auto', url: movie.movieUrl }];
};
const getVideoType = (url) => {
  if (!url) return 'unknown';

  // 2Embed / similar iframe embeds
  if (
    url.includes('2embed.') ||
    url.includes('2embed.cc') ||
    url.includes('/embed/') ||
    url.includes('/embedtv/')
  ) {
    return 'embed';
  }
  
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

/** Convert 2embed library links to the playable iframe src */
const getEmbedPlayableUrl = (url) => {
  if (!url) return null;
  // https://www.2embed.skin/movie/969681  →  https://www.2embed.cc/embed/969681
  const movieMatch = url.match(/2embed\.[^/]+\/movie\/(\d+)/i);
  if (movieMatch) return `https://www.2embed.cc/embed/${movieMatch[1]}`;

  // https://www.2embed.cc/embedtv/60735&s=2&e=1  →  .../embedtv/60735?s=2&e=1
  const tvEmbedMatch = url.match(
    /2embed\.[^/]+\/embedtv\/(\d+)(?:[?&]s=(\d+)(?:[?&]e=(\d+))?)?/i
  );
  if (tvEmbedMatch) {
    const id = tvEmbedMatch[1];
    const s = tvEmbedMatch[2];
    const e = tvEmbedMatch[3];
    if (s && e) return `https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}`;
    if (s) return `https://www.2embed.cc/embedtv/${id}?s=${s}`;
    return `https://www.2embed.cc/embedtv/${id}`;
  }

  const tvMatch = url.match(/2embed\.[^/]+\/tv\/(\d+)/i);
  if (tvMatch) return `https://www.2embed.cc/embedtv/${tvMatch[1]}`;

  // Already an embed URL — normalize odd &s= form
  if (url.includes('/embedtv/') && url.includes('&s=') && !url.includes('?')) {
    return url.replace(/\/embedtv\/(\d+)&/, '/embedtv/$1?');
  }
  if (url.includes('/embed/') || url.includes('/embedtv/')) return url;
  return url;
};

/** Build alternate iframe sources when 2embed has no stream for a title */
const buildEmbedSources = (url) => {
  const primary = getEmbedPlayableUrl(url);
  if (!primary) return [];

  const sources = [{ id: '2embed', label: 'Server 1', url: primary }];

  const tmdbMovie = primary.match(/2embed\.[^/]+\/embed\/(\d+)/i);
  const imdbMovie = primary.match(/2embed\.[^/]+\/embed\/(tt\d+)/i);
  const tvMatch = primary.match(
    /2embed\.[^/]+\/embedtv\/(\d+)(?:\?s=(\d+)(?:&e=(\d+))?)?/i
  );

  if (tmdbMovie) {
    const id = tmdbMovie[1];
    sources.push({
      id: 'vidsrc',
      label: 'Server 2',
      url: `https://vidsrc.to/embed/movie/${id}`
    });
    sources.push({
      id: 'vidsrcme',
      label: 'Server 3',
      url: `https://vidsrc.me/embed/movie/${id}`
    });
  } else if (imdbMovie) {
    const id = imdbMovie[1];
    sources.push({
      id: 'vidsrc-imdb',
      label: 'Server 2',
      url: `https://vidsrc.to/embed/movie?imdb=${id}`
    });
  } else if (tvMatch) {
    const id = tvMatch[1];
    const s = tvMatch[2] || '1';
    const e = tvMatch[3] || '1';
    sources.push({
      id: 'vidsrc-tv',
      label: 'Server 2',
      url: `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
    });
  }

  // De-dupe by URL
  const seen = new Set();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
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
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoType, setVideoType] = useState('unknown');
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedSources, setEmbedSources] = useState([]);
  const [activeSourceId, setActiveSourceId] = useState('');
  const [googleDriveUrls, setGoogleDriveUrls] = useState(null);
  const [directSources, setDirectSources] = useState([]);
  const [activeDirectSourceId, setActiveDirectSourceId] = useState('');
  const [directPlayUrl, setDirectPlayUrl] = useState('');
  const [hlsQualities, setHlsQualities] = useState([]);
  const [activeHlsLevel, setActiveHlsLevel] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showEmbedQualityTip, setShowEmbedQualityTip] = useState(false);

  // Determine video type and prepare embed URL
  useEffect(() => {
    if (!movie || !movie.movieUrl) return;
    
    const type = getVideoType(movie.movieUrl);
    setVideoType(type);
    setHasError(false);
    setErrorMessage('');
    
    if (type === 'googledrive') {
      setEmbedSources([]);
      setActiveSourceId('');
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
    } else if (type === 'embed') {
      const sources = buildEmbedSources(movie.movieUrl);
      if (sources.length) {
        setEmbedSources(sources);
        setActiveSourceId(sources[0].id);
        setEmbedUrl(sources[0].url);
        setIsLoading(false);
        setIsPlaying(true);
      } else {
        setEmbedSources([]);
        setActiveSourceId('');
        setHasError(true);
        setErrorMessage('Invalid embed URL');
        setIsLoading(false);
      }
    } else if (type === 'youtube') {
      setEmbedSources([]);
      setActiveSourceId('');
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
      setEmbedSources([]);
      setActiveSourceId('');
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
      setEmbedSources([]);
      setActiveSourceId('');
      const sources = getDirectSources(movie);
      setDirectSources(sources);
      setActiveDirectSourceId(sources[0]?.id || '');
      setDirectPlayUrl(sources[0]?.url || movie.movieUrl);
      setHlsQualities([]);
      setActiveHlsLevel(-1);
      setIsLoading(true);
    } else {
      setEmbedSources([]);
      setActiveSourceId('');
      setHasError(true);
      setErrorMessage('Unsupported video URL format');
      setIsLoading(false);
    }
  }, [movie?.movieUrl]);

  const switchEmbedSource = (source) => {
    if (!source || source.id === activeSourceId) return;
    setActiveSourceId(source.id);
    setEmbedUrl(source.url);
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
    setIsPlaying(true);
  };

  const switchDirectSource = (source) => {
    if (!source || source.id === activeDirectSourceId) return;
    setActiveDirectSourceId(source.id);
    setDirectPlayUrl(source.url);
    setHlsQualities([]);
    setActiveHlsLevel(-1);
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
    setIsPlaying(false);
  };

  const changeHlsQuality = useCallback((levelIndex) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = levelIndex;
    setActiveHlsLevel(levelIndex);
    setShowQualityMenu(false);
  }, []);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // Block embed ad popups / redirects while the player is open
  useEffect(() => {
    const previousOpen = window.open;
    window.open = () => null;

    const previousBlur = window.onblur;
    let blurArmed = false;
    const onBlur = () => {
      // Pop-under pattern: blur then try to open — keep focus if possible
      blurArmed = true;
      window.focus();
    };
    window.addEventListener('blur', onBlur);

    const onVisibility = () => {
      if (document.hidden && blurArmed) {
        window.focus();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Stop auxiliary clicks that spawn tabs from our UI chrome
    const blockAux = (event) => {
      if (event.button === 1) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('auxclick', blockAux, true);

    return () => {
      window.open = previousOpen;
      window.onblur = previousBlur;
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('auxclick', blockAux, true);
    };
  }, []);

  useEffect(() => {
    if (videoType !== 'direct' || !directPlayUrl) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    destroyHls();
    setHlsQualities([]);
    setActiveHlsLevel(-1);

    if (isHlsUrl(directPlayUrl)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(directPlayUrl);
        hls.attachMedia(video);

        const onManifest = () => {
          const levels = hls.levels.map((level, index) => ({
            index,
            label: level.height ? `${level.height}p` : `Stream ${index + 1}`
          }));
          setHlsQualities([{ index: -1, label: 'Auto' }, ...levels]);
          setActiveHlsLevel(hls.currentLevel);
        };

        hls.on(Hls.Events.MANIFEST_PARSED, onManifest);
        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          setActiveHlsLevel(hls.currentLevel);
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (!data?.fatal) return;
          setHasError(true);
          setErrorMessage('Unable to load this stream quality.');
          setIsLoading(false);
        });

        return () => {
          hls.off(Hls.Events.MANIFEST_PARSED, onManifest);
          destroyHls();
        };
      }

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = directPlayUrl;
      } else {
        setHasError(true);
        setErrorMessage('HLS playback is not supported in this browser.');
        setIsLoading(false);
      }
      return undefined;
    }

    video.src = directPlayUrl;
    return undefined;
  }, [videoType, directPlayUrl, destroyHls]);

  useEffect(() => {
    // Only handle direct video files (Google Drive uses iframe)
    if (videoType !== 'direct' || !directPlayUrl) return;
    
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
        video.removeAttribute('src');
        video.load();
      }
      destroyHls();
    };
  }, [videoType, directPlayUrl, destroyHls]);

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

  const isEmbedPlayer = ['youtube', 'vimeo', 'googledrive', 'embed'].includes(videoType);
  const showDirectQualityMenu = videoType === 'direct' && (hlsQualities.length > 1 || directSources.length > 1);
  const activeHlsLabel =
    hlsQualities.find((item) => item.index === activeHlsLevel)?.label || 'Auto';
  const activeDirectLabel =
    directSources.find((item) => item.id === activeDirectSourceId)?.label || 'Auto';

  return (
    <div className="movie-player-overlay" onClick={onClose}>
      <div className="movie-player-container" onClick={(e) => e.stopPropagation()}>
        <div className="movie-player-header">
          <h2 className="movie-player-title">{movie.title}</h2>
          {embedSources.length > 1 && (
            <div className="movie-player-servers" role="group" aria-label="Streaming servers">
              {embedSources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`movie-player-server-btn${
                    activeSourceId === source.id ? ' is-active' : ''
                  }`}
                  onClick={() => switchEmbedSource(source)}
                >
                  {source.label}
                </button>
              ))}
            </div>
          )}
          {showDirectQualityMenu && (
            <div className="movie-player-quality">
              <button
                type="button"
                className="movie-player-quality-btn"
                onClick={() => setShowQualityMenu((open) => !open)}
                aria-expanded={showQualityMenu}
                aria-haspopup="listbox"
              >
                Quality: {hlsQualities.length > 1 ? activeHlsLabel : activeDirectLabel}
              </button>
              {showQualityMenu && (
                <div className="movie-player-quality-menu" role="listbox">
                  {hlsQualities.length > 1
                    ? hlsQualities.map((item) => (
                        <button
                          key={item.index}
                          type="button"
                          role="option"
                          className={`movie-player-quality-option${
                            activeHlsLevel === item.index ? ' is-active' : ''
                          }`}
                          onClick={() => changeHlsQuality(item.index)}
                        >
                          {item.label}
                        </button>
                      ))
                    : directSources.map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          role="option"
                          className={`movie-player-quality-option${
                            activeDirectSourceId === source.id ? ' is-active' : ''
                          }`}
                          onClick={() => switchDirectSource(source)}
                        >
                          {source.label}
                        </button>
                      ))}
                </div>
              )}
            </div>
          )}
          {isEmbedPlayer && (
            <div className="movie-player-quality">
              <button
                type="button"
                className="movie-player-quality-btn"
                onClick={() => setShowEmbedQualityTip((open) => !open)}
                aria-expanded={showEmbedQualityTip}
              >
                Quality
              </button>
              {showEmbedQualityTip && (
                <div className="movie-player-quality-tip">
                  Use the settings icon inside the video player to change quality
                  (Auto / 1080p / 720p). Different servers may also offer different
                  stream quality.
                </div>
              )}
            </div>
          )}
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
          ) : videoType === 'youtube' || videoType === 'vimeo' || videoType === 'googledrive' || videoType === 'embed' ? (
            <>
              <iframe
                key={embedUrl}
                ref={iframeRef}
                className="movie-player-video"
                src={embedUrl}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="no-referrer"
                loading="eager"
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
                crossOrigin="anonymous"
                onLoadedData={() => setIsLoading(false)}
              >
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

          {!isLoading && !hasError && (
            <div className="movie-player-brand" aria-hidden="true">
              NK Movie Hub
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoviePlayer;

