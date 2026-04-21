import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Override smooth scrolling to ensure instant scroll on route change
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    // Restore after a tick
    requestAnimationFrame(() => {
      html.style.scrollBehavior = prev;
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;