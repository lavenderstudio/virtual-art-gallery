'use strict';

const Stats = require('stats.js');
const mapVal = (value, min1, max1, min2, max2) => min2 + (value - min1) * (max2 - min2) / (max1 - min1);

let showStats = false;
let useReflexion = !navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i);

let fovX = () => mapVal(window.innerWidth / window.innerHeight, 16/9, 9/16, useReflexion ? 1.7 : 1.5, Math.PI / 3);
let fovY = () => 2 * Math.atan(Math.tan(fovX() * 0.5) * window.innerHeight / window.innerWidth);

const stats = new Stats();
if (showStats) {
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
}

let regl;
try {
    regl = require('regl')({
        extensions: ['OES_element_index_uint', 'OES_standard_derivatives'],
        optionalExtensions: ['EXT_texture_filter_anisotropic'],
        attributes: { 
            alpha: false,
            antialias: true, 
            preserveDrawingBuffer: true 
        }
    });
} catch (e) {
    console.error("WebGL Error:", e);
}

// --- PHẦN THAY ĐỔI QUAN TRỌNG Ở ĐÂY ---
const map = require('./map')();
const mesh = require('./mesh');
const drawMap = mesh(regl, map, useReflexion);

// Nạp module image (bản hợp nhất bạn đã sửa)
const image = require('./image'); 

// TRUYỀN THÊM 'image' VÀO placement
const placement = require('./placement')(regl, map, image); 

const drawPainting = require('./painting')(regl);
const fps = require('./fps')(map, fovY);
// ---------------------------------------

const context = regl({
    cull: { enable: true, face: 'back' },
    uniforms: {
        view: fps.view,
        proj: fps.proj,
        yScale: 1.0
    }
});

const reflexion = regl({
    cull: { enable: true, face: 'front' },
    uniforms: { yScale: -1.0 }
});

regl.frame(({ time }) => {
    try {
        if (showStats) stats.begin();
        fps.tick({ time });
        
        // Cập nhật vị trí và nạp ảnh mới khi di chuyển
        if (placement && placement.update) {
            placement.update(fps.pos, fps.fmouse[1], fovX());
        }

        regl.clear({ color: [0.02, 0.02, 0.02, 1], depth: 1 });

        context(() => {
            if (useReflexion) {
                reflexion(() => {
                    drawMap();
                    const b = placement.batch();
                    if (b && b.length > 0) drawPainting(b);
                });
            }
            drawMap();
            const b = placement.batch();
            // Vẽ các bức tranh đã được nạp
            if (b && b.length > 0) drawPainting(b);
        });
        
        if (showStats) stats.end();
    } catch (err) {
        // Tránh treo trình duyệt nếu có lỗi trong loop
        console.error("Render Loop Error:", err);
    }
});
