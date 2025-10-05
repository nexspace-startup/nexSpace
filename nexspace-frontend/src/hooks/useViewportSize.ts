import { useEffect, useState } from 'react';

type ViewportSize = {
  width: number;
  height: number;
};

const getViewport = (): ViewportSize => {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }

  return { width: window.innerWidth, height: window.innerHeight };
};

export const useViewportSize = (): ViewportSize => {
  const [viewport, setViewport] = useState<ViewportSize>(() => getViewport());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setViewport(getViewport());
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return viewport;
};

export default useViewportSize;
