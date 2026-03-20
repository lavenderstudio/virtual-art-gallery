'use strict';

// Tạo texture 1x1 màu xám chuẩn để WebGL không bao giờ thiếu dữ liệu
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
            if (!data || !data.objectIDs) return;

            // Lấy 50 tấm đầu tiên để test
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
                        tex: createPlaceholder(regl), // Có texture ngay lập tức
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
            // Cập nhật nội dung cho texture cũ, không tạo cái mới để tránh lỗi memory
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
            p.loaded = true; // Đánh dấu xong để không cố tải lại tấm lỗi này nữa
        };
    },

    unload: (p) => {
        // Giữ nguyên placeholder để không hỏng uniform WebGL
        p.loaded = false;
        p.loading = false;
    }
};
