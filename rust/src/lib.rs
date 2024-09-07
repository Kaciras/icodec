use lol_alloc::{AssumeSingleThreaded, FreeListAllocator};
use std::cmp;
use bytemuck::Pod;
use rgb::alt::GrayAlpha;
use rgb::RGBA;
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::from_value;
use wasm_bindgen::prelude::*;

// Save ~5KB WASM size and has the same performance as std.
#[global_allocator]
static ALLOC: AssumeSingleThreaded<FreeListAllocator> =
	unsafe { AssumeSingleThreaded::new(FreeListAllocator::new()) };

#[derive(Serialize, Deserialize)]
pub struct QuantizeOptions {
	pub quality: u8,
	pub speed: i32,
	pub colors: u32,
	pub dithering: f32,
}

#[wasm_bindgen]
pub fn quantize(mut data: Vec<u8>, width: usize, height: usize, options: JsValue) -> Vec<u8> {
	let options: QuantizeOptions = from_value(options).unwrap_throw();

	let mut quantizer = imagequant::new();
	quantizer.set_speed(options.speed).unwrap_throw();
	quantizer.set_quality(0, options.quality).unwrap_throw();
	quantizer.set_max_colors(options.colors).unwrap_throw();

	let rgba: &mut [RGBA<u8>] = bytemuck::cast_slice_mut(data.as_mut_slice());
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

fn swap_endian(data: &mut Vec<u8>) {
	data.chunks_exact_mut(2).for_each(|c| c.swap(0, 1));
}

#[derive(Serialize, Deserialize)]
pub struct EncodeOptions {
	pub quantize: bool,
	pub level: u8,
	pub interlace: bool,
	pub bit_depth: u8,
}

pub fn png_encode(mut data: Vec<u8>, width: u32, height: u32, options: EncodeOptions) -> Vec<u8> {
	let mut optimization = oxipng::Options::from_preset(options.level);
	optimization.optimize_alpha = true;
	optimization.interlace = Some(if options.interlace {
		oxipng::Interlacing::Adam7
	} else {
		oxipng::Interlacing::None
	});

	let depth = if options.bit_depth == 8 {
		oxipng::BitDepth::Eight
	} else {
		swap_endian(&mut data);
		oxipng::BitDepth::Sixteen
	};

	let raw = oxipng::RawImage::new(
		width,
		height,
		oxipng::ColorType::RGBA,
		depth,
		data
	);
	return raw.unwrap_throw().create_optimized_png(&optimization).unwrap_throw();
}

// Data needs to be copied between the managed JS heap and the WASM memory,
// so here we call two functions internally to avoid the copying overhead.
#[wasm_bindgen]
pub fn optimize(mut data: Vec<u8>, width: usize, height: usize, options: JsValue) -> Vec<u8> {
	let config: EncodeOptions = from_value(options.clone()).unwrap_throw();
	if config.quantize {
		data = quantize(data, width, height, options);
	}
	return png_encode(data, width as u32, height as u32, config);
}

fn cast_pixels<T: Pod>(buf: &mut [u8]) {
	let rgba: &mut [RGBA<T>] = bytemuck::cast_slice_mut(buf);
	for i in (0..rgba.len()).rev() {
		let src: &[GrayAlpha<T>] = bytemuck::cast_slice(rgba);
		rgba[i] = src[i].into();
	}
}

/// Decode PNG image into 8-bit RGBA data, return only the buffer and width,
/// but height can be calculated by `data.byteLength / width / 4`
#[wasm_bindgen]
pub fn png_to_rgba(data: &[u8]) -> js_sys::Array {
	let mut decoder = png::Decoder::new(data);
	decoder.set_transformations(png::Transformations::ALPHA);
	let mut reader = decoder.read_info().unwrap_throw();

	let info = reader.info();
	let width = info.width;
	let color_type = info.color_type;
	let depth = cmp::max(8, info.bit_depth as u32);
	let length = (width * info.height * depth / 2) as usize;

	// Create the buffer without fill the default value.
	let mut buffer = Vec::<u8>::with_capacity(length);
	unsafe { buffer.set_len(length) }

	reader.next_frame(&mut buffer).unwrap();

	match color_type {
		png::ColorType::Grayscale | png::ColorType::GrayscaleAlpha => {
			if depth == 16 {
				cast_pixels::<u16>(&mut buffer);
			} else {
				cast_pixels::<u8>(&mut buffer);
			}
		}
		_ => { /* Transformations ensure RGB & platted image to RGBA */ }
	}

	// Pixels stored in PNG is big-endian, but icodec use little-endian.
	if depth == 16 {
		swap_endian(&mut buffer);
	}

	let data = js_sys::Uint8ClampedArray::from(buffer.as_slice());
	return js_sys::Array::of3(&data.into(), &width.into(), &depth.into());
}
