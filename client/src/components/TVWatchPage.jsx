import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';
import { trackWatchClick } from '../utils/analytics';
import { setDetailPageMeta } from '../utils/seo';
import {
  extractSeasonEpisodeFromUrl,
  findEpisodeInSeasons,
  getTvShowTmdbId,
  groupEpisodesBySeasons
} from '../utils/tvEpisodes';
import { getEmbedPlayableUrl, buildTvEmbedSources } from '../utils/embedSources';
import { goBackOr } from '../utils/navigation';
import { readTvWatchCache, writeTvWatchCache } from '../utils/tvWatchCache';
import { fetchSeasonEpisodeStills, getEpisodeStillUrl } from '../utils/tvEpisodeStills';
import './TVWatchPage.css';

const PLAYER_LOADING_TIMEOUT_MS = 10000;
const PRECONNECT_HOSTS = [
  'https://www.2embed.cc',
  'https://vidsrc.to',
  'https://vidsrc.me',
  'https://image.tmdb.org'
];

const TVWatchPage = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [tvShow, setTVShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSourceId, setActiveSourceId] = useState('server-1');
  const [playerLoading, setPlayerLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [episodeStills, setEpisodeStills] = useState({});
  const trackedShowRef = useRef('');
  const preconnectedRef = useRef(false);
  const lastEmbedUrlRef = useRef('');

  const seasonNumber = Math.max(1, parseInt(searchParams.get('season') || '1', 10) || 1);
  const episodeNumber = Math.max(1, parseInt(searchParams.get('episode') || '1', 10) || 1);

  useEffect(() => {
    if (preconnectedRef.current) return;
    preconnectedRef.current = true;
    PRECONNECT_HOSTS.forEach((href) => {
      if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyShow = (show) => {
      if (!cancelled && show) {
        setTVShow(show);
        setLoading(false);
      }
    };

    const cached = readTvWatchCache(id);
    if (cached) {
      applyShow(cached);
    } else {
      setLoading(true);
    }

    const fetchShow = async () => {
      try {
        setError(null);
        let response = await fetch(`/api/tvshows/${id}/watch`);
        if (!response.ok && response.status === 404) {
          response = await fetch(`/api/tvshows/${id}`);
        }
        if (!response.ok) throw new Error('TV Show not found');
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to load TV show');
        writeTvWatchCache(id, result.data.tvShow);
        applyShow(result.data.tvShow);
      } catch (err) {
        if (!cancelled && !cached) {
          setError(err.message || 'Failed to load TV show');
          setLoading(false);
        }
      }
    };

    fetchShow();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const seasons = useMemo(() => {
    if (!tvShow) return [];
    const numberOfSeasons =
      tvShow.numberOfSeasons ||
      (tvShow.episodes?.length ? Math.max(1, tvShow.numberOfSeasons || 1) : 0);
    return groupEpisodesBySeasons(tvShow.episodes || [], numberOfSeasons || 1);
  }, [tvShow]);

  const currentSeason =
    seasons.find((season) => season.seasonNumber === seasonNumber) || seasons[0];

  const currentEpisode = useMemo(
    () => findEpisodeInSeasons(seasons, seasonNumber, episodeNumber),
    [seasons, seasonNumber, episodeNumber]
  );

  const tmdbId = useMemo(() => (tvShow ? getTvShowTmdbId(tvShow) : null), [tvShow]);

  useEffect(() => {
    if (!tmdbId || !seasonNumber) {
      setEpisodeStills({});
      return undefined;
    }

    let cancelled = false;
    fetchSeasonEpisodeStills(tmdbId, seasonNumber).then((stills) => {
      if (!cancelled) setEpisodeStills(stills);
    });

    return () => {
      cancelled = true;
    };
  }, [tmdbId, seasonNumber]);

  const embedSources = useMemo(() => {
    if (!tvShow || !tmdbId) return [];
    const episodeUrl = getEmbedPlayableUrl(currentEpisode?.episodeUrl || '');
    return buildTvEmbedSources({
      tmdbId,
      season: seasonNumber,
      episode: episodeNumber,
      episodeUrl
    });
  }, [tvShow, tmdbId, seasonNumber, episodeNumber, currentEpisode]);

  const activeSource = useMemo(() => {
    if (!embedSources.length) return null;
    return embedSources.find((source) => source.id === activeSourceId) || embedSources[0];
  }, [embedSources, activeSourceId]);

  const embedUrl = activeSource?.url || '';

  useEffect(() => {
    if (!embedSources.length) return;
    const hasActive = embedSources.some((source) => source.id === activeSourceId);
    if (!hasActive) {
      setActiveSourceId(embedSources[0].id);
      return;
    }
    if (embedUrl && embedUrl !== lastEmbedUrlRef.current) {
      lastEmbedUrlRef.current = embedUrl;
      setPlayerLoading(true);
    }
  }, [embedSources, activeSourceId, embedUrl]);

  useEffect(() => {
    if (!playerLoading) return undefined;
    const timeoutId = window.setTimeout(() => {
      setPlayerLoading(false);
    }, PLAYER_LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [playerLoading, embedUrl, seasonNumber, episodeNumber, activeSourceId]);

  useEffect(() => {
    if (!tvShow?._id) return;
    const epLabel = currentEpisode?.episodeTitle || `S${seasonNumber}E${episodeNumber}`;
    setDetailPageMeta({
      title: `${tvShow.title} — ${epLabel}`,
      description: tvShow.description,
      image: tvShow.bannerUrl || tvShow.imageUrl,
      pathname: `/watch/tv/${id}?season=${seasonNumber}&episode=${episodeNumber}`,
      type: 'video.tv_show'
    });
    if (trackedShowRef.current === tvShow._id) return;
    trackedShowRef.current = tvShow._id;
    trackWatchClick({
      contentType: 'tv_episode',
      itemId: tvShow._id,
      itemName: tvShow.title
    });
  }, [
    tvShow?._id,
    tvShow?.title,
    tvShow?.description,
    tvShow?.bannerUrl,
    tvShow?.imageUrl,
    id,
    seasonNumber,
    episodeNumber,
    currentEpisode?.episodeTitle
  ]);

  const goToEpisode = (season, episode) => {
    setSearchParams({ season: String(season), episode: String(episode) });
  };

  const handleBack = () => {
    goBackOr(navigate, location, `/tvshow/${id}`);
  };

  const switchSource = (source) => {
    if (!source || source.id === activeSourceId) return;
    setActiveSourceId(source.id);
    setPlayerLoading(true);
  };

  const reloadPlayer = () => {
    setPlayerLoading(true);
    setReloadToken((value) => value + 1);
  };

  if (loading && !tvShow) {
    return (
      <div className="tv-watch-page">
        <div className="tv-watch-loading">
          <div className="loading-spinner" />
          <p>Loading show…</p>
        </div>
      </div>
    );
  }

  if (error || !tvShow) {
    return (
      <div className="tv-watch-page">
        <div className="tv-watch-error">
          <h2>Unable to load TV show</h2>
          <p>{error || 'TV Show not found'}</p>
          <button type="button" className="tv-watch-back-btn" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (tvShow.status === 'coming_soon') {
    return (
      <div className="tv-watch-page">
        <div className="tv-watch-error">
          <h2>{tvShow.title}</h2>
          <p>This series is coming soon.</p>
          <button type="button" className="tv-watch-back-btn" onClick={handleBack}>
            Back to details
          </button>
        </div>
      </div>
    );
  }

  const posterSrc =
    tvShow.imageUrl || tvShow.images?.[0] || getMoviePlaceholder(tvShow.title);
  const episodeTitle = currentEpisode?.episodeTitle || `Episode ${episodeNumber}`;
  const ratingValue = Number(tvShow.imdbRating) || 0;

  return (
    <div className="tv-watch-page">
      <header className="tv-watch-topbar">
        <button
          type="button"
          className="tv-watch-back-btn"
          onClick={handleBack}
        >
          ← Back
        </button>

        <div className="tv-watch-topbar-center">
          <h1>{tvShow.title}</h1>
          <p>
            Season {seasonNumber} · Episode {episodeNumber}
            {episodeTitle ? ` · ${episodeTitle}` : ''}
          </p>
        </div>

        <div className="tv-watch-topbar-right">
          <label className="tv-watch-server-select">
            <span>Server:</span>
            <select
              value={activeSourceId}
              onChange={(e) => {
                const source = embedSources.find((s) => s.id === e.target.value);
                if (source) switchSource(source);
              }}
            >
              {embedSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="tv-watch-refresh-btn" onClick={reloadPlayer} aria-label="Reload player">
            ↻
          </button>
        </div>
      </header>

      <div className="tv-watch-layout">
        <main className="tv-watch-main">
          <div className="tv-watch-player-shell">
            {playerLoading && embedUrl && (
              <div className="tv-watch-player-loading">
                <div className="loading-spinner" />
                <p>Loading player…</p>
              </div>
            )}

            {!embedUrl ? (
              <div className="tv-watch-player-empty">
                <p>No playable stream found for this episode.</p>
              </div>
            ) : (
              <iframe
                key={`${activeSourceId}-${reloadToken}`}
                title={`${tvShow.title} S${seasonNumber}E${episodeNumber}`}
                src={embedUrl}
                className={`tv-watch-iframe${playerLoading ? ' is-loading' : ''}`}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                onLoad={() => setPlayerLoading(false)}
              />
            )}
          </div>

          <div className="tv-watch-show-bar">
            <div>
              <h2>{tvShow.title}</h2>
              <p>
                {tvShow.year || ''}
                {ratingValue > 0 && (
                  <>
                    {' '}
                    · ★ {ratingValue.toFixed(1)}
                  </>
                )}
                {tvShow.numberOfSeasons > 0 && ` · ${tvShow.numberOfSeasons} seasons`}
              </p>
            </div>
            <button type="button" className="tv-watch-details-btn" onClick={handleBack}>
              View Details
            </button>
          </div>

          <article className="tv-watch-episode-card">
            <img
              src={posterSrc}
              alt=""
              onError={(e) => handleImageError(e, tvShow.title)}
            />
            <div>
              <h3>
                S{seasonNumber} E{episodeNumber} {episodeTitle}
              </h3>
              <p>{tvShow.description}</p>
            </div>
          </article>

          <div className="tv-watch-server-panel">
            <p className="tv-watch-server-try">Try another server:</p>
            <div className="tv-watch-server-list">
              {embedSources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`tv-watch-server-btn${
                    activeSourceId === source.id ? ' is-active' : ''
                  }`}
                  onClick={() => switchSource(source)}
                >
                  {activeSourceId === source.id ? '★ ' : ''}
                  {source.label}
                </button>
              ))}
            </div>
            <p className="tv-watch-server-tip">
              If a server doesn&apos;t load, try another. Install uBlock Origin to block ads.
            </p>
          </div>
        </main>

        <aside className="tv-watch-sidebar">
          <h2 className="tv-watch-sidebar-title">
            <span aria-hidden="true">📺</span> EPISODES
          </h2>

          {seasons.length > 0 ? (
            <>
              <label className="tv-watch-season-select">
                <select
                  value={currentSeason?.seasonNumber || 1}
                  onChange={(e) => goToEpisode(parseInt(e.target.value, 10), 1)}
                >
                  {seasons.map((season) => (
                    <option key={season.seasonNumber} value={season.seasonNumber}>
                      Season {season.seasonNumber} · {season.episodes.length} eps
                    </option>
                  ))}
                </select>
              </label>

              <div className="tv-watch-episode-list">
                {(currentSeason?.episodes || []).map((episode, index) => {
                  const fromUrl = extractSeasonEpisodeFromUrl(episode.episodeUrl || '');
                  const epNum =
                    episode.seasonEpisodeNumber || fromUrl.episode || index + 1;
                  const epSeason =
                    episode.seasonNumber || fromUrl.season || currentSeason?.seasonNumber || 1;
                  const isActive =
                    seasonNumber === epSeason && episodeNumber === epNum;
                  const title = episode.episodeTitle || `Episode ${epNum}`;
                  const thumbSrc = getEpisodeStillUrl(episodeStills, epNum, posterSrc);

                  return (
                    <button
                      key={episode._id || `${epSeason}-${epNum}`}
                      type="button"
                      className={`tv-watch-episode-row${isActive ? ' is-active' : ''}`}
                      onClick={() => goToEpisode(epSeason, epNum)}
                    >
                      <div className="tv-watch-episode-thumb" aria-hidden="true">
                        <img
                          src={thumbSrc}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            if (e.currentTarget.src !== posterSrc) {
                              e.currentTarget.src = posterSrc;
                              return;
                            }
                            handleImageError(e, tvShow.title);
                          }}
                        />
                        <span className="tv-watch-episode-num">E{epNum}</span>
                        {isActive && <span className="tv-watch-episode-play">▶</span>}
                      </div>
                      <div className="tv-watch-episode-copy">
                        <div className="tv-watch-episode-head">
                          <strong>E{epNum}</strong>
                          <span>{title}</span>
                        </div>
                        {ratingValue > 0 && (
                          <span className="tv-watch-episode-rating">★ {ratingValue.toFixed(1)}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="tv-watch-no-episodes">No episodes found</p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default TVWatchPage;
