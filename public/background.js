// ShowFlix Background Service Worker
// CRITICAL: NEVER reference 'window' object in background worker scope! Use 'self' or 'clients'.

if (typeof self !== 'undefined') {
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });

  // Safe messaging to active browser tabs without infinite loops
  async function notifyActiveClients(data) {
    if (!self.clients) return;
    try {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        try {
          client.postMessage(data);
        } catch (err) {
          // Frame or tab was removed - stop retrying for this client
        }
      }
    } catch (e) {
      // Clients unavailable
    }
  }

  self.addEventListener('message', (event) => {
    if (!event || !event.data) return;
    if (event.data.type === 'CHECK_STATUS') {
      notifyActiveClients({ type: 'STATUS_RESPONSE', status: 'active', timestamp: Date.now() });
    }
  });
}
