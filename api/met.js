'use strict';

module.exports = async function () {
    try {
        // 1. Tìm kiếm tranh phong cảnh có ảnh
        const searchRes = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=landscape');
        const searchData = await searchRes.json();
        
        if (!searchData.objectIDs) return [];

        // 2. Lấy 20 ID đầu tiên
        const ids = searchData.objectIDs.slice(0, 20);
        const imageUrls = [];

        // 3. Chạy vòng lặp lấy chi tiết từng ảnh
        for (let id of ids) {
            try {
                const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                const obj = await res.json();
                
                // Quan trọng: Chỉ lấy link ảnh (chuỗi string) để khớp với image/index.js
                if (obj.primaryImageSmall) {
                    imageUrls.push(obj.primaryImageSmall);
                }
            } catch (e) {
                continue; // Bỏ qua nếu một ảnh bị lỗi
            }
        }

        console.log(`Đã tải thành công ${imageUrls.length} ảnh từ Met Museum`);
        return imageUrls; 
    } catch (e) {
        console.error("Lỗi Met API:", e);
        return [];
    }
};
