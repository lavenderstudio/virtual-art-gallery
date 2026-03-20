'use strict';

const Stats = require('stats.js');
const mapVal = (value, min1, max1, min2, max2) => min2 + (value - min1) * (max2 - min2) / (max1 - min1);

let showStats = false; // Đổi thành true nếu bạn muốn xem FPS
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
    alert("Trình duyệt của bạn không hỗ trợ WebGL hoặc đã xảy ra lỗi khởi tạo.");
}

// --- KHỞI TẠO CÁC MODULE ---
const map = require('./map')();
const mesh = require('./mesh');
const drawMap = mesh(regl, map, useReflexion);

// Nạp module image (Bản hợp nhất gọi trực tiếp Met Museum)
const image = require('./image'); 

// Khởi tạo placement và truyền module image vào làm tham số thứ 3
const placement = require('./placement')(regl, map, image); 

const drawPainting = require('./painting')(regl);
const fps = require('./fps')(map, fovY);

// Cấu hình Camera/Context
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

// --- VÒNG LẶP RENDER CHÍNH ---
regl.frame(({ time }) => {
    try {
        if (showStats) stats.begin();
        
        // 1. Cập nhật logic di chuyển và nạp ảnh
        fps.tick({ time });
        
        if (placement && placement.update) {
            placement.update(fps.pos, fps.fmouse[1], fovX());
        }

        // 2. Xóa màn hình chuẩn bị vẽ frame mới
        regl.clear({ color: [0.02, 0.02, 0.02, 1], depth: 1 });

        // 3. Vẽ thế giới
        context(() => {
            // Lấy danh sách tranh cần hiển thị (bao gồm cả các mockup đang load)
            const currentBatch = placement.batch() || [];
            
            // Vẽ phần phản chiếu dưới sàn (nếu có)
            if (useReflexion) {
                reflexion(() => {
                    drawMap();
                    if (currentBatch.length > 0) drawPainting(currentBatch);
                });
            }
            
            // Vẽ tường, sàn và trần nhà
            drawMap();
            
            // Vẽ các bức tranh chính thức
            if (currentBatch.length > 0) {
                drawPainting(currentBatch);
            }
        });
        
        if (showStats) stats.end();
    } catch (err) {
        console.error("Lỗi Render Loop:", err);
    }
});
