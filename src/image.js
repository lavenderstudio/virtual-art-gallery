'use strict';

module.exports = {
    fetch: async (regl, count, quality, loadCallback, finishCallback) => {
        try {
            const response = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
            const data = await response.json();
            if (!data || !data.objectIDs) return;

            const ids = data.objectIDs.slice(0, Math.min(count, 40));
            
            for (let id of ids) {
                const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                const obj = await objRes.json();

                if (obj.primaryImageSmall) {
                    // TẠO TEXTURE TRỐNG NGAY LẬP TỨC
                    const tex = regl.texture({
                        data: [200, 200, 200, 255], // Màu xám khởi tạo
                        width: 1,
                        height: 1
                    });

                    loadCallback({
                        id: id,
                        url: obj.primaryImageSmall,
                        aspect: 1,
                        loading: false,
                        loaded: false,
                        tex: tex, // Đưa đối tượng texture vào đây
                        title: obj.title || "Untitled",
                        artist: obj.artistDisplayName || "Unknown"
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
            // CẬP NHẬT DỮ LIỆU VÀO TEXTURE ĐÃ CÓ
            p.tex({
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
        p.loaded = false;
        p.loading = false;
    }
};
