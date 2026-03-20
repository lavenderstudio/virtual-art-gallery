'use strict';

module.exports = {
    fetch: async (regl, count, quality, loadCallback, finishCallback) => {
        try {
            const response = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
            const data = await response.json();
            if (!data || !data.objectIDs) return;

            const ids = data.objectIDs.slice(0, Math.min(count, 50));
            
            for (let id of ids) {
                const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                const obj = await objRes.json();

                if (obj.primaryImageSmall) {
                    loadCallback({
                        id: id,
                        url: obj.primaryImageSmall,
                        aspect: 1,
                        loading: false,
                        loaded: false,
                        tex: null, // Ban đầu để null để painting.js dùng fallback xám
                        title: obj.title || "Untitled",
                        artist: obj.artistDisplayName || "Unknown Artist"
                    });
                }
            }
        } catch (e) {
            console.error("Met API Error:", e);
        } finally {
            if (finishCallback) finishCallback();
        }
    },

    load: (regl, p, quality) => {
        if (p.loading || p.loaded) return;
        p.loading = true;

        const img = new Image();
        img.crossOrigin = "anonymous"; 
        img.src = p.url;

        img.onload = () => {
            p.aspect = img.width / img.height;
            // TẠO MỚI TEXTURE (Thay vì cập nhật cái cũ)
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
