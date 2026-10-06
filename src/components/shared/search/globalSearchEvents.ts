// src/components/shared/search/globalSearchEvents.ts
// Sökknapparna i headers och sidomenyer öppnar söklådan via ett fönsterevent,
// så att de inte behöver dela state med layouten.

export const OPEN_GLOBAL_SEARCH_EVENT = 'begone:open-global-search'

export function openGlobalSearch() {
  window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_SEARCH_EVENT))
}
