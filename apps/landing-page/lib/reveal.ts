import type { CSSProperties } from "react";

/** Stagger helper for scroll-reveal: <div data-reveal style={delay(120)}> */
export const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
