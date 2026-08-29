const AnalyticsEvent = require('../models/AnalyticsEvent');

const MS_DAY = 24 * 60 * 60 * 1000;

const parseRange = (query = {}) => {
  const preset = String(query.range || '30d').toLowerCase();
  const end = query.endDate ? new Date(query.endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  let start;
  if (query.startDate) {
    start = new Date(query.startDate);
  } else if (preset === '7d') {
    start = new Date(end.getTime() - 6 * MS_DAY);
  } else if (preset === '90d') {
    start = new Date(end.getTime() - 89 * MS_DAY);
  } else {
    start = new Date(end.getTime() - 29 * MS_DAY);
  }
  start.setHours(0, 0, 0, 0);

  return { start, end, preset };
};

const distinctVisitors = async (start, end) => {
  const rows = await AnalyticsEvent.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end }, visitorId: { $ne: '' } } },
    { $group: { _id: '$visitorId' } },
    { $count: 'total' }
  ]);
  return rows[0]?.total || 0;
};

const countEvents = async (start, end, filter = {}) => {
  return AnalyticsEvent.countDocuments({
    createdAt: { $gte: start, $lte: end },
    ...filter
  });
};

const visitorsOverTime = async (start, end) => {
  return AnalyticsEvent.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        pageViews: {
          $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] }
        },
        visitors: { $addToSet: '$visitorId' }
      }
    },
    {
      $project: {
        date: '$_id',
        pageViews: 1,
        visitors: { $size: '$visitors' },
        _id: 0
      }
    },
    { $sort: { date: 1 } }
  ]);
};

const topWatchedMovies = async (start, end, limit = 10) => {
  return AnalyticsEvent.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        type: 'watch_click',
        contentType: { $in: ['movie', 'tv_show', 'tv_episode'] }
      }
    },
    {
      $group: {
        _id: { itemName: '$itemName', contentType: '$contentType' },
        clicks: { $sum: 1 }
      }
    },
    { $sort: { clicks: -1 } },
    { $limit: limit },
    {
      $project: {
        name: '$_id.itemName',
        contentType: '$_id.contentType',
        clicks: 1,
        _id: 0
      }
    }
  ]);
};

const trafficSources = async (start, end, limit = 8) => {
  return AnalyticsEvent.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: '$trafficSource', users: { $addToSet: '$visitorId' }, views: { $sum: 1 } } },
    { $project: { source: '$_id', users: { $size: '$users' }, views: 1, _id: 0 } },
    { $sort: { users: -1 } },
    { $limit: limit }
  ]);
};

const countries = async (start, end, limit = 10) => {
  return AnalyticsEvent.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: '$countryHint.locale',
        users: { $addToSet: '$visitorId' },
        views: { $sum: 1 }
      }
    },
    { $project: { country: '$_id', users: { $size: '$users' }, views: 1, _id: 0 } },
    { $sort: { users: -1 } },
    { $limit: limit }
  ]);
};

async function getDashboard(query) {
  const { start, end, preset } = parseRange(query);
  const now = new Date();

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now.getTime() - 6 * MS_DAY);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getTime() - 29 * MS_DAY);
  monthStart.setHours(0, 0, 0, 0);

  const [
    dailyVisitors,
    weeklyVisitors,
    monthlyVisitors,
    rangeVisitors,
    pageViews,
    movieViews,
    tvViews,
    watchClicks,
    timeline,
    topMovies,
    sources,
    countryRows
  ] = await Promise.all([
    distinctVisitors(dayStart, now),
    distinctVisitors(weekStart, now),
    distinctVisitors(monthStart, now),
    distinctVisitors(start, end),
    countEvents(start, end, { type: 'page_view' }),
    countEvents(start, end, { type: 'view_content', contentType: 'movie' }),
    countEvents(start, end, { type: 'view_content', contentType: { $in: ['tv_show', 'tv_episode'] } }),
    countEvents(start, end, { type: 'watch_click' }),
    visitorsOverTime(start, end),
    topWatchedMovies(start, end),
    trafficSources(start, end),
    countries(start, end)
  ]);

  return {
    configured: true,
    ga4MeasurementId: process.env.GA4_MEASUREMENT_ID || process.env.REACT_APP_GA_MEASUREMENT_ID || '',
    range: {
      preset,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10)
    },
    summary: {
      visitors: {
        daily: dailyVisitors,
        weekly: weeklyVisitors,
        monthly: monthlyVisitors,
        range: rangeVisitors
      },
      pageViews,
      movieViews,
      tvViews,
      watchClicks
    },
    visitorsOverTime: timeline,
    topWatched: topMovies,
    trafficSources: sources,
    countries: countryRows
  };
}

module.exports = { getDashboard, parseRange };
