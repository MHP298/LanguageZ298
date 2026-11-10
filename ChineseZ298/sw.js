// SERVICE WORKER - TỰ ĐỘNG CẬP NHẬT & DỌN SẠCH CACHE CŨ
const CACHE_NAME = 'chinesez-cache-v20261111_1';

self.addEventListener('install', (event) => {
    // Ép Service Worker mới kích hoạt ngay lập tức mà không cần chờ người dùng đóng tab
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        // Quét và xóa sạch các cache cũ của phiên bản trước
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Chiến lược Network First: Luôn ưu tiên tải mới nhất từ Internet, chỉ dùng cache khi mất mạng hoàn toàn
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
