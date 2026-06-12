import { BASE_URL } from '../services/api';

export const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case "present":
      return "#28a745";
    case "absent":
      return "#dc3545";
    case "late":
      return "#ffc107";
    default:
      return "#6c757d";
  }
};

export const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
          const apiBaseUrlObj = new URL(BASE_URL);
          urlObj.protocol = apiBaseUrlObj.protocol;
          urlObj.host = apiBaseUrlObj.host;
          return urlObj.toString();
        }
      } catch (e) {
        // fallback to original
      }
    }
    return url;
  }
  const apiBase = BASE_URL.replace(/\/api\/?$/, '');
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

