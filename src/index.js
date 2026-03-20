'use strict';

const Stats = require('stats.js');

// 1. Ép Canvas hiển thị để tránh lỗi container trắng màn hình
const canvas = document.body.appendChild(document.createElement('canvas'));
canvas.style.position = 'fixed';
canvas.style.left = '0';
canvas.style.top = '0';
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.display = 'block';

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
        canvas: canvas, // Chỉ định rõ canvas đã tạo ở trên
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

// --- KHỞI TẠO CÁC MODULE ---
const map = require('./map')();
const mesh = require('./mesh');
const drawMap = mesh(regl, map, useReflexion);
const image = require('./image'); 
const placement = require('./placement')(regl, map, image); 
const drawPainting = require('./painting')(regl);
const fps = require('./fps')(map, fovY);

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

// --- VÒNG LẶP RENDER ---
regl.frame(({ time }) => {
    try {
        if (showStats) stats.begin();
        fps.tick({ time });
        
        if (placement && placement.update) {
            placement.update(fps.pos, fps.fmouse[1], fovX());
        }

        regl.clear({ color: [0.02, 0.02, 0.02, 1], depth: 1 });

        context(() => {
            const currentBatch = (placement && placement.batch) ? placement.batch() : [];
            
            if (useReflexion) {
                reflexion(() => {
                    drawMap();
                    if (currentBatch.length > 0) drawPainting(currentBatch);
                });
            }
            
            drawMap();
            
            if (currentBatch.length > 0) {
                drawPainting(currentBatch);
            }
        });
        
        if (showStats) stats.end();
    } catch (err) {
        // Log lỗi nhẹ nhàng để không làm treo loop
    }
});

// Xử lý khi resize cửa sổ
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}, false);
