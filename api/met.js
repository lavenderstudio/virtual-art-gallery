'use strict';
module.exports = async function () {
    try {
        // Tìm tranh phong cảnh (Landscape) cho Lavender Prime Studio của bạn
        const search = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=landscape');
        const searchData = await search.json();
        const ids = searchData.objectIDs.slice(0, 20); // Lấy ít thôi để test (20 cái)

        const images = [];
        for (let id of ids) {
            try {
                const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                const obj = await res.json();
                if (obj.primaryImageSmall) {
                    images.push({
                        url: obj.primaryImageSmall,
                        title: obj.title,
                        aspect: 1 // Tạm thời để 1, ảnh sẽ tự cập nhật khi load xong
                    });
                }
            } catch (e) { continue; }
        }
        return images;
    } catch (e) {
        return [];
    }
};
