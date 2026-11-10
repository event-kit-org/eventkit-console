/**
 * Glides to a section on this page (jumps when the visitor prefers reduced
 * motion) and puts its #hash in the address bar. `top` is the page's top.
 */
export function scrollToSection(id: string) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
  if (id === 'top') window.scrollTo({ top: 0, behavior });
  else document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' });
  history.replaceState(history.state, '', `#${id}`);
}
