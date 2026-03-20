'use strict';

// DÁN TRỰC TIẾP LOGIC CỦA MET.JS VÀO ĐÂY
const dataAccess = async function () {
    try {
        const searchRes = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=landscape');
        const searchData = await searchRes.json();
        if (!searchData.objectIDs) return [];
        const ids = searchData.objectIDs.slice(0, 20);
        const imageUrls = [];
        for (let id of ids) {
            try {
                const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                const obj = await res.json();
                if (obj.primaryImageSmall) imageUrls.push(obj.primaryImageSmall);
            } catch (e) { continue; }
        }
        return imageUrls;
    } catch (e) { return []; }
};

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
		return new Promise((resolve) => {
			const img = new Image();
			img.crossOrigin = "anonymous"; 
			img.src = url;
			img.onload = () => {
				ctx.drawImage(img, 0, 0, resizeCanvas.width, resizeCanvas.height);
				resolve([(unusedTextures.pop() || regl.texture)({data: resizeCanvas, min: 'mipmap', mipmap: 'nice', aniso, flipY: true}),
				width => text.init((unusedTextures.pop() || regl.texture), "Lavender Prime", width),
				img.width / img.height]);
			};
			img.onerror = () => resolve(emptyImage(regl));
		});
	} catch(e) { return resolve(emptyImage(regl)); }
}

module.exports = {
	fetch: (regl, count = 10, res = "low", cbOne, cbAll) => {
		dataAccess().then(urls => {
			if (!urls || urls.length === 0) return cbAll();
			let remaining = urls.length;
			urls.forEach((url) => {
				loadImage(regl, url).then(([tex, textGen, aspect]) => {
					cbOne({ image_id: url, tex, textGen, aspect });
					if (--remaining === 0) cbAll();
				}).catch(() => { if (--remaining === 0) cbAll(); });
			});
		}).catch(() => cbAll());
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
