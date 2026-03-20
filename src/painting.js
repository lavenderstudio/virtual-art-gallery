'use strict';

const text = require('./text');

module.exports = (regl) => {
    // 1. Tạo một texture 1x1 màu xám mặc định cực nhẹ
    // Dùng cái này làm "vật thế thân" khi ảnh thật chưa tải xong
    const fallbackTex = regl.texture({
        data: [180, 180, 180, 255],
        width: 1,
        height: 1,
        format: 'rgba'
    });

    const drawText = text.draw(regl);

    const painting = regl({
        frag: `
        precision lowp float;
        uniform sampler2D tex;
        varying vec3 uv;

        // Hàm xấp xỉ lỗi Gaussian để tạo bóng đổ mịn
        vec4 erf(vec4 x) {
            vec4 s = sign(x), a = abs(x);
            x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
            x *= x;
            return s - s / (x * x);
        }

        float boxShadow(vec2 lower, vec2 upper, vec2 point, float sigma) {
            vec4 query = vec4(point - lower, upper - point);
            vec4 integral = 0.5 + 0.5 * erf(query * (sqrt(0.5) / sigma));
            return (integral.z - integral.x) * (integral.w - integral.y);
        }

        void main () {
            // Xác định các vùng: mặt trước, cạnh bên, và bóng đổ
            float frontMask = smoothstep(0.9, 1.0, uv.z);
            float paintingMask = step(0.001, uv.z);
            float shadowAlpha = boxShadow(vec2(.5), vec2(.7), abs(uv.xy-vec2(.5)), 0.02);
            
            // Hiệu ứng bao quanh nhẹ ở mép tranh
            float wrapping = 0.005 * sign(uv.x-.5) * (1.-uv.z);
            float sideShading = pow(uv.z/4.0, 0.1);
            
            // Lấy màu từ texture (ảnh thật hoặc ảnh xám dự phòng)
            vec3 col = texture2D(tex, uv.xy - vec2(wrapping, 0.)).rgb;
            
            // Ánh sáng cho cạnh bên
            col *= mix(sideShading, 1., frontMask);
            
            // Trộn giữa bóng đổ (đen) và màu tranh dựa trên paintingMask
            gl_FragColor = mix(vec4(0., 0., 0., shadowAlpha), vec4(col, 1.), paintingMask);
        }`,

        vert: `
        precision highp float;
        uniform mat4 proj, view, model;
        uniform float yScale;
        attribute vec3 pos;
        varying vec3 uv;
        void main () {
            uv = pos;
            vec4 mpos = model * vec4(pos, 1);
            mpos.y *= yScale;
            gl_Position = proj * view * mpos;
        }`,

        attributes: {
            pos: [
                // Front Face
                0, 0, 1,  1, 0, 1,  0, 1, 1,  1, 1, 1, 
                // Contour/Sides
                0, 0, 0,  1, 0, 0,  0, 1, 0,  1, 1, 0, 
                // Shadow Plane
                -0.1, -0.1, 0,  1.1, -0.1, 0,  -0.1, 1.1, 0,  1.1, 1.1, 0 
            ]
        },

        elements: [
            0, 1, 2, 3, 2, 1,       // Front
            1, 0, 5, 4, 5, 0,       // Bottom Side
            3, 1, 7, 5, 7, 1,       // Right Side
            0, 2, 4, 6, 4, 2,       // Left Side
            8, 9, 4, 5, 4, 9,       // Shadow Bottom
            9, 11, 5, 7, 5, 11,     // Shadow Right
            11, 10, 7, 6, 7, 10,    // Shadow Top
            10, 8, 6, 4, 6, 8       // Shadow Left
        ],

        uniforms: {
            model: regl.prop('model'),
            yScale: regl.prop('yScale'),
            // KIỂM TRA NGHIÊM NGẶT: Chỉ truyền props.tex nếu nó là một texture hợp lệ
            // Nếu không, trả về fallbackTex để tránh lỗi 'invalid texture type'
            tex: (context, props) => {
                if (props.tex && typeof props.tex === 'function') {
                    return props.tex;
                }
                return fallbackTex;
            }
        },

        blend: {
            enable: true,
            func: {
                srcRGB: 'src alpha',
                srcAlpha: 'one minus src alpha',
                dstRGB: 'one minus src alpha',
                dstAlpha: 1
            },
            color: [0, 0, 0, 0]
        }
    });

    return function (batch) {
        // Chỉ vẽ khi có dữ liệu batch hợp lệ
        const validBatch = batch.filter(p => p && p.model && p.tex);
        
        if (validBatch.length > 0) {
            // Vẽ các tấm canvas (tranh)
            painting(validBatch);
            
            // Vẽ phần chữ (Title/Artist) bên dưới
            try {
                drawText(validBatch);
            } catch (e) {
                // Tránh việc lỗi font chữ làm đứng cả luồng render tranh
                console.warn("Text render skipped due to asset loading.");
            }
        }
    };
};
