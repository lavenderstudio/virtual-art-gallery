'use strict';

module.exports = {
    fetch: async (regl, count, quality, loadCallback, finishCallback) => {
        try {
            // 1. Tìm kiếm danh sách tranh
            const response = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting');
            const data = await response.json();
            
            // Kiểm tra nếu không có dữ liệu hoặc objectIDs bị rỗng
            if (!data || !data.objectIDs || data.objectIDs.length === 0) {
                console.warn("Không tìm thấy tranh từ API.");
                return;
            }

            // Lấy danh sách ID an toàn
            const ids = data.objectIDs.slice(0, Math.min(count, 50));

            for (let id of ids) {
                // KIỂM TRA ID: Chỉ gọi API nếu ID là một số hợp lệ
                if (!id) continue;

                try {
                    const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                    const obj = await objRes.json();

                    // Nếu API trả về lỗi cho ID này, bỏ qua và đi tiếp
                    if (!obj || obj.message || !obj.primaryImageSmall) continue;

                    // Gửi dữ liệu về cho gallery
                    loadCallback({
                        id: id,
                        url: obj.primaryImageSmall, // Link ảnh từ Met
                        title: obj.title || "Untitled",
                        artist: obj.artistDisplayName || "Unknown",
                        aspect: 1,
                        tex: null,
                        loaded: false,
                        loading: false
                    });
                } catch (innerError) {
                    console.error(`Lỗi khi nạp object ${id}:`, innerError);
                }
            }
        } catch (e) {
            console.error("Lỗi Fetch tổng thể:", e);
        } finally {
            if (finishCallback) finishCallback();
        }
    },

    load: (regl, p, quality) => {
        if (p.loading || p.loaded) return;
        p.loading = true;

        const img = new Image();
        img.crossOrigin = "anonymous"; 
        
        // Sử dụng Proxy để tránh lỗi CORS và ép trình duyệt nhận diện file ảnh
        // Điều này giúp img.onload chạy được và thay thế ô xám bằng tranh thật
        img.src = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&resize_w=500&url=${encodeURIComponent(p.url)}`;

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
            console.error("Không thể tải ảnh từ URL:", p.url);
            p.loading = false;
            p.loaded = true; // Đánh dấu đã xong để không treo hệ thống
        };
    },

    unload: (p) => {
        if (p.tex && typeof p.tex.destroy === 'function') {
            p.tex.destroy();
        }
        p.tex = null;
        p.loaded = false;
        p.loading = false;
    }
};
