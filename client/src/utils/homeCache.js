/** Drop cached home rows (sessionStorage) so admin edits/deletes show on the next home visit. */
export const clearHomeCaches = () => {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('nk-home-')) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    // Ignore quota / private mode errors
  }
};
