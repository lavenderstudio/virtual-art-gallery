'use strict';

// Hàm tạo ảnh 1x1 pixel màu xám để làm placeholder khi ảnh thật chưa load xong
const emptyImage = (regl) => regl.texture({
    data: new Uint8Array([128, 128, 128, 255]), // RGBA: Màu xám
    width: 1,
    height: 1,
    format: 'rgba',
    type: 'uint8'
});

const cache = {};

module.exports = {
    fetch: async (regl, count, quality, loadCallback, finishCallback) => {
        try {
            // Thử nạp danh sách tranh từ Met Museum
            const response = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
            const data = await response.json();
            
            if (!data.objectIDs) return;
            const ids = data.objectIDs.slice(0, count);

            for (let id of ids) {
                const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                const obj = await objRes.json();

                if (obj.primaryImageSmall) {
                    const painting = {
                        id: id,
                        url: obj.primaryImageSmall,
                        aspect: 1.0, // Mặc định
                        loading: false,
                        tex: emptyImage(regl), // Gán ngay khung xám
                        textGen: (width) => {
                            // Tạo nhãn tên tranh
                            return {
                                title: obj.title || "Unknown",
                                artist: obj.artistDisplayName || "Unknown Artist"
                            };
                        }
                    };
                    loadCallback(painting);
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
        // KHÔNG dùng proxy Google nữa, thử nạp trực tiếp với Anonymous CORS
        img.crossOrigin = "anonymous"; 
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
            console.warn("Không nạp được ảnh trực tiếp, giữ khung xám:", p.url);
            p.loading = false;
            p.loaded = true; // Đánh dấu là xong để không nạp lại nữa
        };
    },

    unload: (p) => {
        if (p.tex && p.tex.destroy) p.tex.destroy();
        p.tex = null;
        p.loaded = false;
        p.loading = false;
    }
};
