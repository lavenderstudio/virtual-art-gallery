'use strict';

module.exports = {
    // 1. Lấy danh sách ID và thông tin sơ bộ từ Met API
    fetch: async (regl, count, quality, loadCallback, finishCallback) => {
        try {
            const response = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
            const data = await response.json();
            
            if (!data || !data.objectIDs) return;

            // Lấy đúng số lượng tranh yêu cầu
            const ids = data.objectIDs.slice(0, count);

            for (let id of ids) {
                const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                const obj = await objRes.json();

                if (obj.primaryImageSmall) {
                    loadCallback({
                        id: id,
                        url: obj.primaryImageSmall,
                        title: obj.title || "Untitled",
                        artist: obj.artistDisplayName || "Unknown",
                        aspect: 1,
                        tex: null,     // Khởi tạo là null để painting.js dùng fallbackTex (màu xám)
                        loaded: false,
                        loading: false
                    });
                }
            }
        } catch (e) {
            console.error("Met API Fetch Error:", e);
        } finally {
            if (finishCallback) finishCallback();
        }
    },

    // 2. Hàm nạp ảnh thật và chuyển thành WebGL Texture
    load: (regl, p, quality) => {
        if (p.loading || p.loaded) return;
        p.loading = true;

        const img = new Image();
        img.crossOrigin = "anonymous"; // Rất quan trọng để tránh lỗi bảo mật WebGL
        img.src = p.url;

        img.onload = () => {
            p.aspect = img.width / img.height;
            
            // Tạo regl texture từ Image đã load xong
            // Sau dòng này, p.tex sẽ là một "function" -> painting.js sẽ nhận diện được
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
            console.warn("Failed to load image:", p.url);
            p.loading = false;
            p.loaded = true; // Đánh dấu là xong để không thử lại vô tận
        };
    },

    // 3. Giải phóng bộ nhớ khi đi xa khỏi bức tranh (tùy chọn tối ưu)
    unload: (p) => {
        if (p.tex && typeof p.tex.destroy === 'function') {
            p.tex.destroy();
        }
        p.tex = null;
        p.loaded = false;
        p.loading = false;
    }
};
