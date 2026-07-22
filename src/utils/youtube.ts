export function getYouTubeVideoId(value: string): string {
  const input = value.trim();
  if (!input) return '';
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v') || '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || '';
    }
  } catch {
    return /^[a-zA-Z0-9_-]{11}$/.test(input) ? input : '';
  }
  return '';
}

export function getYouTubeEmbedUrl(value: string): string {
  const id = getYouTubeVideoId(value);
  return id ? `https://www.youtube.com/embed/${id}` : '';
}

export function getYouTubeThumbnail(value: string): string {
  const id = getYouTubeVideoId(value);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}
