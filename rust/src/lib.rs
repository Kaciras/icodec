use lol_alloc::{AssumeSingleThreaded, FreeListAllocator};
use imagequant::RGBA;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[global_allocator]
static ALLOC: AssumeSingleThreaded<FreeListAllocator> = unsafe {
	AssumeSingleThreaded::new(FreeListAllocator::new())
};

#[derive(Serialize, Deserialize)]
pub struct QuantizeOptions {
	pub speed: i32,
	pub quality: u8,
	pub min_quality: u8,
	pub dithering: f32,
}

#[wasm_bindgen]
pub fn quantize(mut data: Vec<u8>, width: usize, height: usize, options: JsValue) -> Vec<u8> {
	let options: QuantizeOptions = serde_wasm_bindgen::from_value(options).unwrap_throw();

	let mut quantizer = imagequant::new();
	quantizer.set_speed(options.speed).unwrap_throw();
	quantizer.set_quality(options.min_quality, options.quality).unwrap_throw();

	let rgba: &mut [RGBA] = bytemuck::cast_slice_mut(data.as_mut_slice());
	let mut image = quantizer.new_image(&*rgba, width, height, 0.0).unwrap_throw();

	let mut res = match quantizer.quantize(&mut image) {
		Ok(res) => res,
		Err(err) => panic!("Quantization failed, because: {err:?}"),
	};

	// Enable dithering for subsequent remappings.
	res.set_dithering_level(options.dithering).unwrap_throw();

	// You can reuse the result to generate several images with the same palette.
	let (palette, pixels) = res.remapped(&mut image).unwrap_throw();

	// Convert RGBAs back from the palette and the color references.
	for i in 0..pixels.len() {
		rgba[i] = palette[pixels[i] as usize]
	}

	return data; // Modifications are not propagated to JS, so we need to return the data.
}

#[derive(Serialize, Deserialize)]
pub struct EncodeOptions {
	pub level: u8,
	pub interlace: bool,
}

#[wasm_bindgen]
pub fn png_encode(data: Vec<u8>, width: u32, height: u32, options: JsValue) -> Vec<u8> {
	let options: EncodeOptions = serde_wasm_bindgen::from_value(options).unwrap_throw();

	let mut optimization = oxipng::Options::from_preset(options.level);
	optimization.optimize_alpha = true;
	optimization.interlace = Some(if options.interlace {
		oxipng::Interlacing::Adam7
	} else {
		oxipng::Interlacing::None
	});

	let raw = oxipng::RawImage::new(
		width,
		height,
		oxipng::ColorType::RGBA,
		oxipng::BitDepth::Eight,
		data,
	);
	return raw.unwrap_throw().create_optimized_png(&optimization).unwrap_throw();
}

// Data needs to be copied between the managed JS heap and the WASM memory,
// so here we call two functions internally to avoid the copying overhead.
#[wasm_bindgen]
pub fn quantize_to_png(data: Vec<u8>, width: usize, height: usize, options: JsValue) -> Vec<u8> {
	let data = quantize(data, width, height, options.clone());
	return png_encode(data, width as u32, height as u32, options)
}
