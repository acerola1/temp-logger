import { useEffect, useState, type RefObject } from 'react';

export function useElementWidth<T extends HTMLElement>(ref: RefObject<T | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const updateWidth = () => setWidth(element.getBoundingClientRect().width);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}
