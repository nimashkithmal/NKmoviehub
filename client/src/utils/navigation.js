export const currentPath = (location) =>
  `${location.pathname}${location.search || ''}`;

export const withReturnPath = (location, extraState = {}) => ({
  state: {
    from: currentPath(location),
    ...extraState
  }
});

export const goBackOr = (navigate, location, fallback) => {
  const from = location.state?.from;
  if (typeof from === 'string' && from && from !== location.pathname) {
    navigate(from);
    return;
  }
  navigate(fallback);
};
