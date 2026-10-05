// ShowFlix Service Worker
// Handles background requests and tab connection disconnects safely without infinite retry loops

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Stop infinite retries if frame or tab is detached
self.addEventListener('message', (event) => {
  if (!event || !event.data) return;
  
  if (event.data.type === 'PING') {
    if (event.ports && event.ports[0]) {
      try {
        event.ports[0].postMessage({ type: 'PONG', timestamp: Date.now() });
      } catch (e) {
        // Tab port closed - stop retrying
      }
    }
  }
});
