'use strict';
const mat4 = require('gl-mat4');

// Chúng ta sẽ không require trực tiếp ở đây để tránh xung đột đường dẫn
// Thay vào đó dùng textureProvider được truyền vào từ index.js

const renderDist = 20;
const loadDist = 20;
const unloadDist = 40;
const fovxMargin = Math.PI/32;

const culling = (ppos, pangle, fovx, {vseg, angle}) => {
    if (!vseg) return true; 
    const sx1 = vseg[0][0] - ppos[0];
    const sy1 = vseg[0][1] - ppos[2];
    const sx2 = vseg[1][0] - ppos[0];
    const sy2 = vseg[1][1] - ppos[2];
    const angles = [angle, pangle - fovx/2 - fovxMargin + Math.PI/2, pangle + fovx/2 + fovxMargin - Math.PI/2];
    for(let a of angles) {
        const nx = Math.sin(a);
        const ny = -Math.cos(a);
        if(nx * sx1 + ny * sy1 < 0 && nx * sx2 + ny * sy2 < 0)
            return false;
    }
    return true;
};

module.exports = (regl, {placements, getAreaIndex}, imageModule) => {
    // Ưu tiên module được truyền vào từ index.js
    const textureProvider = imageModule; 
    let batch = [], shownBatch = [];
    let fetching = false;

    const loadPainting = (p) => {
        // KIỂM TRA: Nếu không có vị trí đặt tranh thì dừng
        if (batch.length >= placements.length) return;
        
        const seg = placements[batch.length];
        const dir = [seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]];
        const norm = [seg[1][1] - seg[0][1], seg[0][0] - seg[1][0]];
        const segLen = Math.hypot(dir[0], dir[1]);
        
        let globalScale = 4.5 / (3 + p.aspect);
        globalScale = Math.min(globalScale, segLen / p.aspect / 2.2);
        globalScale = Math.min(globalScale, 2 / 1.2);
        
        const pos = [(seg[0][0] + seg[1][0]) / 2, 2.1 - globalScale, (seg[0][1] + seg[1][1]) / 2];
        const angle = Math.atan2(dir[1], dir[0]);
        const horiz = Math.abs(angle % 3) < 1 ? 1 : 0;
        const vert = 1 - horiz;
        const width = globalScale * p.aspect;
        
        const scale = [
            2 * width * horiz + 0.1 * vert,
            2 * globalScale,
            2 * width * vert + 0.1 * horiz];
            
        // Quan trọng: textGen phải được gọi để tạo texture chữ
        const text = p.textGen ? p.textGen(width) : null;
        
        const d1 = width / segLen;
        const d2 = 0.005 / Math.hypot(norm[0], norm[1]);
        
        const vseg = [
            [pos[0] - dir[0] * d1 * 2, pos[2] - dir[1] * d1],
            [pos[0] + dir[0] * d1 * 2, pos[2] + dir[1] * d1]
        ];
        
        pos[0] -= dir[0] * d1 + norm[0] * d2;
        pos[2] -= dir[1] * d1 + norm[1] * d2;
        
        const model = [];
        mat4.fromTranslation(model, pos);
        mat4.scale(model, model, scale);
        mat4.rotateY(model, model, -angle);
        
        const textmodel = [];
        mat4.fromTranslation(textmodel, [pos[0], 1.7 - globalScale, pos[2]]);
        mat4.scale(textmodel, textmodel, [0.5, 0.5, 0.5]); // Thu nhỏ nhãn chữ
        mat4.rotateY(textmodel, textmodel, -angle);
        
        batch.push({ ...p, vseg, angle, model, textmodel, text, width });
    };

    // Khởi tạo lấy dữ liệu ngay lập tức
    if (textureProvider && textureProvider.fetch) {
        fetching = true;
        textureProvider.fetch(regl, 20, "low", loadPainting, () => {
            fetching = false;
        });
    }

    return {
        update: (pos, angle, fovX) => {
            let index = getAreaIndex(pos[0], pos[2], 4);
            if (index === -1) index = 0; 

            // Duyệt qua tất cả tranh đã có trong batch
            for (let i = 0; i < batch.length; i++) {
                const p = batch[i];
                if (i < index - unloadDist || i > index + unloadDist) {
                    textureProvider.unload(p);
                } else if (i > index - renderDist && i < index + renderDist) {
                    // Chỉ load nếu chưa có tex
                    if (!p.tex && !p.loading) {
                        textureProvider.load(regl, p, "low");
                    }
                }
            }

            // Lọc hiển thị: Chỉ cần nằm trong tầm nhìn là vẽ (không đợi p.tex)
            shownBatch = batch.filter(t => culling(pos, angle, fovX, t));

            // Fetch thêm tranh nếu sắp hết danh sách
            if (batch.length < index + loadDist && !fetching && batch.length < placements.length) {
                fetching = true;
                textureProvider.fetch(regl, 10, "low", loadPainting, () => fetching = false);
            }
        },
        batch: () => shownBatch
    };
};
