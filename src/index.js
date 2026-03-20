'use strict';

// 1. Cấu hình hiệu năng và đồ họa
var useReflexion = true; // Bật phản chiếu sàn (tắt nếu bị lag trên mobile)
var showStats = false;   // Hiện bảng FPS để theo dõi hiệu năng trên Railway

// Hàm tính toán FOV (tầm nhìn) dựa trên tỉ lệ màn hình
const mapVal = (value, min1, max1, min2, max2) => min2 + (value - min1) * (max2 - min2) / (max1 - min1);
var fovX = () => mapVal(window.innerWidth / window.innerHeight, 16/9, 9/16, 1.7, Math.PI / 3);

// Tối ưu cho thiết bị di động
if (navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i)) {
	useReflexion = false; // Tắt phản chiếu trên điện thoại để tránh giật lag
	fovX = () => mapVal(window.innerWidth / window.innerHeight, 16/9, 9/16, 1.5, Math.PI / 3);
}
var fovY = () => 2 * Math.atan(Math.tan(fovX() * 0.5) * window.innerHeight / window.innerWidth);

// 2. Cài đặt bộ đếm FPS (Stats.js)
const Stats = require('stats.js');
var stats = new Stats();
stats.showPanel(0);
if(showStats) {
	document.body.appendChild( stats.dom );
}

let regl, map, drawMap, placement, drawPainting, fps;

// 3. Khởi tạo REGL (WebGL Wrapper)
regl = require('regl')({
	extensions: [
		'OES_element_index_uint',
		'OES_standard_derivatives'
	],
	optionalExtensions: [
		'EXT_texture_filter_anisotropic'
	],
	attributes: { alpha : false }
});

// 4. Nạp các thành phần của Gallery
map = require('./map')(); // Tạo bản đồ không gian
const mesh = require('./mesh');
drawMap = mesh(regl, map, useReflexion);

// QUAN TRỌNG: placement sẽ gọi đến api.js (nơi bạn đã sửa thành "met")
placement = require('./placement')(regl, map); 

drawPainting = require('./painting')(regl);
fps = require('./fps')(map, fovY);

// 5. Thiết lập bối cảnh vẽ (Context)
const context = regl({
	cull: {
		enable: true,
		face: 'back'
	},
	uniforms: {
		view: fps.view,
		proj: fps.proj,
		yScale: 1.0
	}
});

// Thiết lập cho hình ảnh phản chiếu dưới sàn
const reflexion = regl({
	cull: {
		enable: true,
		face: 'front'
	},
	uniforms: {
		yScale: -1.0
	}
});

// 6. Vòng lặp Render (Cập nhật 60 khung hình/giây)
regl.frame(({
	time
}) => {
	stats.begin();
	
	// Cập nhật vị trí người chơi và xử lý va chạm
	fps.tick({
		time
	});

	// Cập nhật các bức tranh trong tầm nhìn (Culling)
	// placement.update sẽ gọi tải ảnh từ Met API nếu bạn ở gần bức tường
	placement.update(fps.pos, fps.fmouse[1], fovX());

	// Xóa màn hình trước khi vẽ khung hình mới
	regl.clear({
		color: [0, 0, 0, 1], // Nền đen sang trọng
		depth: 1
	});

	context(() => {
		// Vẽ phần phản chiếu (nếu bật)
		if(useReflexion) {
			reflexion(() => {
				drawMap();
				drawPainting(placement.batch());
			});
		}
		// Vẽ không gian chính và tranh
		drawMap();
		drawPainting(placement.batch());
	});
	
	stats.end();
});
