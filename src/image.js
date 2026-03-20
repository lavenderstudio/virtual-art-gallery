'use strict';

// Sửa lại đường dẫn để budo tìm thấy thư mục api bên trong src
const api = require('./api/api');
const selectedApi = new URLSearchParams(window.location.search).get("api");
const dataAccess = api[selectedApi] || api[api.default];
const text = require('./text');

let paintingCache = {};
let unusedTextures = [];

const resizeCanvas = document.createElement('canvas');
resizeCanvas.width = resizeCanvas.height = 1024; 
const ctx = resizeCanvas.getContext('2d');
let aniso = false;

const emptyImage = (regl) => [
	(unusedTextures.pop() || regl.texture)([[[200, 200, 200]]]),
	width => text.init((unusedTextures.pop() || regl.texture), "Loading...", width),
	1
];

async function loadImage(regl, url) {
	if (aniso === false) {
		aniso = regl.hasExtension('EXT_texture_filter_anisotropic') ? regl._gl.getParameter(
			regl._gl.getExtension('EXT_texture_filter_anisotropic').MAX_TEXTURE_MAX_ANISOTROPY_EXT
		) : 0;
	}
	
	try {
		return new Promise((resolve, reject) => {
			const img = new Image();
			// Khắc phục lỗi đen màn hình bằng cách cho phép tải ảnh từ Met Museum
			img.crossOrigin = "anonymous"; 
			img.src = url;
			img.onload = () => {
				ctx.drawImage(img, 0, 0, resizeCanvas.width, resizeCanvas.height);
				const tex = (unusedTextures.pop() || regl.texture)({
					data: resizeCanvas,
					min: 'mipmap',
					mipmap: 'nice',
					aniso,
					flipY: true
				});
				resolve([
					tex,
					width => text.init((unusedTextures.pop() || regl.texture), "Lavender Prime Art", width),
					img.width / img.height
				]);
			};
			img.onerror = () => {
				console.error("Không tải được ảnh:", url);
				resolve(emptyImage(regl));
			};
		});
	} catch(e) {
		return emptyImage(regl);
	}
}

module.exports = {
	fetch: (regl, count = 10, res = "low", cbOne, cbAll) => {
		// dataAccess chính là hàm async từ met.js
		dataAccess().then(urls => {
			if (!urls || urls.length === 0) return cbAll();
			let remaining = urls.length;
			
			urls.forEach((url) => {
				loadImage(regl, url).then(([tex, textGen, aspect]) => {
					cbOne({ image_id: url, tex, textGen, aspect });
					if (--remaining === 0) cbAll();
				}).catch(() => {
					if (--remaining === 0) cbAll();
				});
			});
		}).catch(err => {
			console.error("Lỗi API:", err);
			cbAll();
		});
	},
	load: (regl, p, res = "low") => {
		if (p.tex || p.loading) return;
		p.loading = true;
		loadImage(regl, p.image_id).then(([tex, textGen]) => {
			p.loading = false;
			p.tex = tex;
			p.text = textGen(p.width);
		});
	},
	unload: (p) => {
		if (p.tex) { unusedTextures.push(p.tex); p.tex = undefined; }
		if (p.text) { unusedTextures.push(p.text); p.text = undefined; }
	}
};
