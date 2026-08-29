import React, { useCallback, useEffect, useState } from 'react';
import './AnalyticsDashboard.css';

const RANGE_OPTIONS = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' }
];

const formatNumber = (n) => Number(n || 0).toLocaleString();

const BarChart = ({ data, valueKey, labelKey, maxBars = 12 }) => {
  const rows = (data || []).slice(0, maxBars);
  const max = Math.max(...rows.map((r) => r[valueKey] || 0), 1);

  if (!rows.length) {
    return <p className="analytics-empty-chart">No data for this period.</p>;
  }

  return (
    <div className="analytics-bars">
      {rows.map((row) => (
        <div key={`${row[labelKey]}-${row[valueKey]}`} className="analytics-bar-row">
          <span className="analytics-bar-label" title={row[labelKey]}>
            {row[labelKey]}
          </span>
          <div className="analytics-bar-track">
            <div
              className="analytics-bar-fill"
              style={{ width: `${((row[valueKey] || 0) / max) * 100}%` }}
            />
          </div>
          <span className="analytics-bar-value">{formatNumber(row[valueKey])}</span>
        </div>
      ))}
    </div>
  );
};

const AnalyticsDashboard = ({ token }) => {
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/analytics/dashboard?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to load analytics');
      }
      setData(result.data);
    } catch (err) {
      console.error('Analytics load error:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [range, token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="analytics-root">
        <div className="analytics-loading">
          <div className="loading-spinner" />
          <p>Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-root">
        <div className="analytics-error">{error}</div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const visitors = summary.visitors || {};

  return (
    <div className="analytics-root">
      <header className="analytics-header">
        <div>
          <h2>Analytics</h2>
          <p>
            GA4 events mirrored to your dashboard
            {data?.ga4MeasurementId ? ` · Measurement ID ${data.ga4MeasurementId}` : ''}
          </p>
        </div>
        <div className="analytics-filters">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`analytics-filter-btn${range === opt.id ? ' is-active' : ''}`}
              onClick={() => setRange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      <div className="analytics-stat-grid">
        <article className="analytics-stat-card">
          <span className="analytics-stat-label">Daily visitors</span>
          <strong>{formatNumber(visitors.daily)}</strong>
        </article>
        <article className="analytics-stat-card">
          <span className="analytics-stat-label">Weekly visitors</span>
          <strong>{formatNumber(visitors.weekly)}</strong>
        </article>
        <article className="analytics-stat-card">
          <span className="analytics-stat-label">Monthly visitors</span>
          <strong>{formatNumber(visitors.monthly)}</strong>
        </article>
        <article className="analytics-stat-card">
          <span className="analytics-stat-label">Page views</span>
          <strong>{formatNumber(summary.pageViews)}</strong>
        </article>
        <article className="analytics-stat-card">
          <span className="analytics-stat-label">Movie views</span>
          <strong>{formatNumber(summary.movieViews)}</strong>
        </article>
        <article className="analytics-stat-card">
          <span className="analytics-stat-label">TV show views</span>
          <strong>{formatNumber(summary.tvViews)}</strong>
        </article>
        <article className="analytics-stat-card">
          <span className="analytics-stat-label">Watch clicks</span>
          <strong>{formatNumber(summary.watchClicks)}</strong>
        </article>
        <article className="analytics-stat-card">
          <span className="analytics-stat-label">Visitors (range)</span>
          <strong>{formatNumber(visitors.range)}</strong>
        </article>
      </div>

      <div className="analytics-panels">
        <section className="analytics-panel analytics-panel-wide">
          <h3>Visitors & page views</h3>
          <BarChart
            data={(data?.visitorsOverTime || []).map((row) => ({
              date: row.date,
              value: row.visitors,
              pageViews: row.pageViews
            }))}
            valueKey="value"
            labelKey="date"
          />
        </section>

        <section className="analytics-panel">
          <h3>Top watched titles</h3>
          <BarChart
            data={(data?.topWatched || []).map((row) => ({
              name: row.name || 'Unknown',
              clicks: row.clicks
            }))}
            valueKey="clicks"
            labelKey="name"
          />
        </section>

        <section className="analytics-panel">
          <h3>Traffic sources</h3>
          <BarChart
            data={(data?.trafficSources || []).map((row) => ({
              source: row.source || 'direct',
              users: row.users
            }))}
            valueKey="users"
            labelKey="source"
          />
        </section>

        <section className="analytics-panel">
          <h3>Countries / locales</h3>
          <BarChart
            data={(data?.countries || []).map((row) => ({
              country: row.country || 'Unknown',
              users: row.users
            }))}
            valueKey="users"
            labelKey="country"
          />
        </section>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
