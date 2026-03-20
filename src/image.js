'use strict';

module.exports = {
    fetch: async (regl, count, quality, loadCallback, finishCallback) => {
        try {
            // Bước 1: Lấy danh sách ID
            const res = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
            const data = await res.json();
            if (!data || !data.objectIDs) return;

            // Lấy 20 tấm để nhẹ máy
            const ids = data.objectIDs.slice(0, 20);

            for (let id of ids) {
                try {
                    const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                    const obj = await objRes.json();

                    if (obj && obj.primaryImageSmall) {
                        loadCallback({
                            id: id,
                            url: obj.primaryImageSmall,
                            title: obj.title || "Untitled",
                            artist: obj.artistDisplayName || "Unknown",
                            aspect: 1,
                            tex: null,     // Để null để painting.js biết đường dùng màu xám
                            loaded: false,
                            loading: false
                        });
                    }
                } catch (e) {}
            }
        } catch (e) {
            console.error("API Error:", e);
        } finally {
            if (finishCallback) finishCallback();
        }
    },

    load: (regl, p, quality) => {
        if (p.loading || p.loaded) return;
        p.loading = true;

        const img = new Image();
        img.crossOrigin = "anonymous";
        // Thử dùng link trực tiếp trước, nếu lỗi ta tính tiếp sau
        img.src = p.url;

        img.onload = () => {
            p.aspect = img.width / img.height;
            p.tex = regl.texture({
                data: img,
                min: 'mipmap',
                mag: 'linear',
                flipY: true
            });
            p.loaded = true;
            p.loading = false;
        };

        img.onerror = () => {
            p.loading = false;
            p.loaded = true;
        };
    },

    unload: (p) => {
        if (p.tex) p.tex.destroy();
        p.tex = null;
        p.loaded = false;
        p.loading = false;
    }
};
