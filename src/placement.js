'use strict';
// Lưu ý: Module image sẽ được truyền từ index.js vào, 
// nhưng ta vẫn giữ require để tránh lỗi reference nếu file khác gọi.
const texture = require('./image'); 
const mat4 = require('gl-mat4');

const renderDist = 20;
const loadDist = 20;
const unloadDist = 40;
const fovxMargin = Math.PI/32;

const culling = (ppos, pangle, fovx, {vseg, angle}) => {
    if (!vseg) return true; // Nếu chưa tính xong vseg thì cứ cho hiển thị
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

// Nhận thêm tham số 'imageModule' được truyền từ index.js
module.exports = (regl, {placements, getAreaIndex}, imageModule) => {
    const textureProvider = imageModule || texture;
    let batch = [], shownBatch = [];
    let fetching = false;

    const loadPainting = (p) => {
        // Sử dụng batch.length để xác định vị trí tranh tiếp theo trên tường
        const seg = placements[batch.length];
        if (!seg) return;

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
            
        const text = p.textGen(width);
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
        mat4.scale(textmodel, textmodel, [2,2,2]);
        mat4.rotateY(textmodel, textmodel, -angle);
        
        batch.push({ ...p, vseg, angle, model, textmodel, text, width });
    };

    // Khởi tạo fetch lần đầu
    fetching = true;
    textureProvider.fetch(regl, 20, "high", loadPainting, () => fetching = false);

    return {
        update: (pos, angle, fovX) => {
            let index = getAreaIndex(pos[0], pos[2], 4);
            if (index === -1) index = 0;

            // Quản lý nạp/hủy texture để tiết kiệm RAM
            batch.forEach((t, i) => {
                if (i < index - unloadDist || i > index + unloadDist) {
                    textureProvider.unload(t);
                } else if (i > index - renderDist && i < index + renderDist) {
                    textureProvider.load(regl, t, "high");
                }
            });

            // LỌC HIỂN THỊ: Cho phép vẽ ngay cả khi t.tex chưa có (để hiện mockup)
            shownBatch = batch.filter(t => culling(pos, angle, fovX, t));

            // Fetch thêm tranh khi đi gần đến cuối danh sách hiện tại
            if (batch.length < index + loadDist && !fetching) {
                fetching = true;
                textureProvider.fetch(regl, 10, "high", loadPainting, () => fetching = false);
            }
        },
        batch: () => shownBatch
    };
};
