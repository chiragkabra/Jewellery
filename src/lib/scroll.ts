import type Lenis from "lenis";

// Single Lenis instance shared by modals/drawers that need to pause page scroll.
let instance: Lenis | null = null;
let locks = 0;

export const setLenis = (l: Lenis | null) => {
  instance = l;
};
export const getLenis = () => instance;

export function lockScroll() {
  locks++;
  instance?.stop();
  document.documentElement.style.overflow = "hidden";
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    instance?.start();
    document.documentElement.style.overflow = "";
  }
}
