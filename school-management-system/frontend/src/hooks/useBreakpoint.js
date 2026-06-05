import { useState, useEffect } from "react";

const QUERIES = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
};

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function useBreakpoint() {
  const isSm = useMediaQuery(QUERIES.sm);
  const isMd = useMediaQuery(QUERIES.md);
  const isLg = useMediaQuery(QUERIES.lg);
  const isXl = useMediaQuery(QUERIES.xl);

  return {
    isSm,
    isMd,
    isLg,
    isXl,
    isMobile: !isMd,
    isTablet: isMd && !isLg,
    isDesktop: isLg,
  };
}

export default useBreakpoint;
