// Minimal loader for Google Identity Services SDK
let googleLoaded = false;

export function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (googleLoaded && (window as any).google?.accounts?.oauth2) return resolve();

    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => { googleLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
