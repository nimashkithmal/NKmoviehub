export const currentPath = (location) =>
  `${location.pathname}${location.search || ''}`;

export const withReturnPath = (location, extraState = {}) => ({
  state: {
    from: currentPath(location),
    ...extraState
  }
});

export const goBackOr = (navigate, location, fallback) => {
  const current = currentPath(location);
  const from = location.state?.from;
  if (typeof from === 'string' && from && from !== current) {
    navigate(from, { replace: true });
    return;
  }
  const historyIdx = window.history.state?.idx;
  if (typeof historyIdx === 'number' && historyIdx > 0) {
    navigate(-1);
    return;
  }
  navigate(fallback, { replace: true });
};
