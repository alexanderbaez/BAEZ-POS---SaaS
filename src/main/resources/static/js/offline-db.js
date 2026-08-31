/**
 * ============================================================================
 * BÁEZ POS - BASE DE DATOS LOCAL INDEXEDDB (Arquitectura Offline-First)
 * Alexander Baez - 2026
 * ============================================================================
 */

const DB_NAME = 'BaezPOS';
const DB_VERSION = 1;
const STORE_PENDING_SALES = 'pending_sales';

let dbInstance = null;

/**
 * Abre o inicializa la conexión con IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
function openOfflineDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            return resolve(dbInstance);
        }

        if (!('indexedDB' in window)) {
            console.warn('[OfflineDB] IndexedDB no está soportado en este navegador.');
            return reject(new Error('IndexedDB no soportado'));
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_PENDING_SALES)) {
                const store = db.createObjectStore(STORE_PENDING_SALES, { keyPath: 'id', autoIncrement: true });
                store.createIndex('createdAt', 'createdAt', { unique: false });
                console.log(`[OfflineDB] ObjectStore '${STORE_PENDING_SALES}' creado exitosamente.`);
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('[OfflineDB] Error al abrir la base de datos:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Guarda una venta offline pendiente de sincronización en IndexedDB
 * @param {Object} saleData - Datos de la venta (payload)
 * @returns {Promise<number>} ID asignado a la venta offline
 */
async function savePendingSale(saleData) {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_PENDING_SALES], 'readwrite');
        const store = transaction.objectStore(STORE_PENDING_SALES);

        const record = {
            ...saleData,
            createdAt: new Date().toISOString(),
            offlineCreatedAt: Date.now(),
            synced: false
        };

        const request = store.add(record);

        request.onsuccess = (event) => {
            const generatedId = event.target.result;
            console.log(`[OfflineDB] Venta offline guardada con ID local #${generatedId}`);
            resolve(generatedId);
        };

        request.onerror = (event) => {
            console.error('[OfflineDB] Error al guardar venta offline:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Obtiene todas las ventas pendientes de sincronización
 * @returns {Promise<Array>} Lista de ventas pendientes con su ID local
 */
async function getPendingSales() {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_PENDING_SALES], 'readonly');
        const store = transaction.objectStore(STORE_PENDING_SALES);
        const request = store.getAll();

        request.onsuccess = (event) => {
            resolve(event.target.result || []);
        };

        request.onerror = (event) => {
            console.error('[OfflineDB] Error al obtener ventas pendientes:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Elimina una venta pendiente una vez sincronizada con el backend
 * @param {number|string} id - ID local de la venta
 * @returns {Promise<void>}
 */
async function deletePendingSale(id) {
    const db = await openOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_PENDING_SALES], 'readwrite');
        const store = transaction.objectStore(STORE_PENDING_SALES);
        const request = store.delete(Number(id));

        request.onsuccess = () => {
            console.log(`[OfflineDB] Venta local #${id} eliminada tras sincronización exitosa.`);
            resolve();
        };

        request.onerror = (event) => {
            console.error(`[OfflineDB] Error al eliminar venta local #${id}:`, event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Devuelve la cantidad de ventas pendientes en la base de datos local
 * @returns {Promise<number>}
 */
async function countPendingSales() {
    try {
        const db = await openOfflineDB();
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_PENDING_SALES], 'readonly');
            const store = transaction.objectStore(STORE_PENDING_SALES);
            const request = store.count();

            request.onsuccess = (event) => {
                resolve(event.target.result || 0);
            };

            request.onerror = () => {
                resolve(0);
            };
        });
    } catch (e) {
        return 0;
    }
}

// Exposición global
window.savePendingSale = savePendingSale;
window.getPendingSales = getPendingSales;
window.deletePendingSale = deletePendingSale;
window.countPendingSales = countPendingSales;
window.openOfflineDB = openOfflineDB;
