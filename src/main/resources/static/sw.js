/**
 * ============================================================================
 * BÁEZ POS - SERVICE WORKER (Arquitectura Offline-First)
 * Alexander Baez - 2026
 * ============================================================================
 */

const CACHE_NAME = 'baezpos-cache-v1';

// Recursos críticos para operar el Punto de Venta sin conexión a Internet
const STATIC_ASSETS = [
    './ventas.html',
    './ventas.js',
    './auth.js',
    './sidebar.js',
    './css/saas-ui-core.css',
    './js/ui-helpers.js',
    './js/offline-db.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

/**
 * Evento Install: Pre-cache de recursos estáticos críticos
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando recursos críticos del POS...');
                return cache.addAll(STATIC_ASSETS).catch((err) => {
                    console.warn('[SW] Algunos recursos externos no pudieron ser pre-cacheados:', err);
                });
            })
            .then(() => self.skipWaiting())
    );
});

/**
 * Evento Activate: Limpieza de cachés antiguas
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Eliminando caché obsoleta:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

/**
 * Evento Fetch: Estrategia Network First, falling back to Cache
 */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Para peticiones a la API o métodos no-GET, dejar que pasen por la red directamente
    if (event.request.method !== 'GET' || url.pathname.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Si la red responde correctamente, actualizamos la caché con la copia fresca
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Si falla la red (Modo Offline), recuperamos desde la caché
                console.log('[SW] Red no disponible. Sirviendo desde caché:', event.request.url);
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Si se solicita una página HTML desconocida offline, devolver ventas.html como fallback
                    if (event.request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('./ventas.html');
                    }
                    return new Response('Recurso no disponible offline', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: new Headers({ 'Content-Type': 'text/plain' })
                    });
                });
            })
    );
});
