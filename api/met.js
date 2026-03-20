'use strict';

module.exports = async function () {
    const searchUrl = 'https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=painting';
    const objectUrl = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/';

    try {
        const response = await fetch(searchUrl);
        const data = await response.json();
        // Lấy 40 bức tranh đầu tiên
        const ids = data.objectIDs.slice(0, 40);

        const promises = ids.map(id => 
            fetch(objectUrl + id)
                .then(res => res.json())
                .then(obj => obj.primaryImageSmall)
                .catch(() => null)
        );

        const images = await Promise.all(promises);
        return images.filter(url => url !== null && url !== "");
    } catch (e) {
        console.error("Lỗi Met API:", e);
        return [];
    }
};
