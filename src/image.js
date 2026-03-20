'use strict';

// Tạo một texture màu xám 1x1 pixel chuẩn WebGL để không bao giờ bị lỗi "missing uniform tex"
const createPlaceholder = (regl) => regl.texture({
    data: [128, 128, 128, 255],
    width: 1,
    height: 1,
    format: 'rgba',
    shape: [1, 1, 4]
});

module.exports = {
    fetch: async (regl, count, quality, loadCallback, finishCallback) => {
        try {
            const response = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
            const data = await response.json();
            if (!data.objectIDs) return;

            const ids = data.objectIDs.slice(0, count);
            for (let id of ids) {
                const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                const obj = await objRes.json();

                if (obj.primaryImageSmall) {
                    loadCallback({
                        id: id,
                        url: obj.primaryImageSmall, // URL ảnh từ Met
                        aspect: 1,
                        loading: false,
                        loaded: false,
                        tex: createPlaceholder(regl), // Ép có texture ngay lập tức
                        title: obj.title,
                        artist: obj.artistDisplayName
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
            // Ghi đè texture placeholder bằng ảnh thật
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
            p.loaded = true; // Dừng nạp nhưng vẫn giữ texture xám để không lỗi WebGL
        };
    },

    unload: (p) => {
        // Không destroy hoàn toàn để tránh lỗi uniform, chỉ trả về màu xám nếu cần
        p.loaded = false;
        p.loading = false;
    }
};
