import React, { useRef } from 'react';

/**
 * Horizontally scrolling content row (MovieAI / Netflix / TMDB pattern).
 * Optional tabs e.g. Today | This Week for TMDB Trending.
 */
const ContentRow = ({
  title,
  subtitle,
  onViewAll,
  tabs = null,
  activeTab = '',
  onTabChange,
  children
}) => {
  const scrollerRef = useRef(null);

  const scrollByPage = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section className="content-row">
      <div className="content-row-header">
        <div className="content-row-heading">
          <h2 className="content-row-title">{title}</h2>
          {Array.isArray(tabs) && tabs.length > 0 && (
            <div className="content-row-tabs" role="tablist" aria-label={`${title} period`}>
              {tabs.map((tab) => {
                const id = tab.id || tab.value || tab;
                const label = tab.label || tab;
                const selected = String(activeTab) === String(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={`content-row-tab${selected ? ' is-active' : ''}`}
                    onClick={() => onTabChange?.(id)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {subtitle && <p className="content-row-subtitle">{subtitle}</p>}
        </div>
        {onViewAll && (
          <button type="button" className="content-row-view-all" onClick={onViewAll}>
            View all
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        )}
      </div>

      <div className="content-row-track-wrap">
        <button
          type="button"
          className="content-row-nav content-row-nav-left"
          aria-label="Scroll left"
          onClick={() => scrollByPage('left')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        <div className="content-row-track" ref={scrollerRef}>
          {children}
        </div>

        <button
          type="button"
          className="content-row-nav content-row-nav-right"
          aria-label="Scroll right"
          onClick={() => scrollByPage('right')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>
    </section>
  );
};

export default ContentRow;
