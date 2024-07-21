use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use imagequant::RGBA;

#[derive(Serialize, Deserialize)]
pub struct QuantizeOptions {
	pub speed: i32,
	pub quality: u8,
	pub min_quality: u8,
	pub dithering: f32,
}

#[wasm_bindgen]
pub fn quantize(data: Vec<u8>, width: usize, height: usize, options: JsValue) -> Vec<u32> {
	let options: QuantizeOptions = serde_wasm_bindgen::from_value(options).unwrap();

    // Configure the library
    let mut quantizer = imagequant::new();
    quantizer.set_speed(options.speed).unwrap();
    quantizer.set_quality(options.min_quality, options.quality).unwrap();

	let rgba: &[RGBA] = bytemuck::cast_slice(data.as_slice());
    let mut image = quantizer.new_image(rgba, width, height, 0.0).unwrap();

    let mut res: imagequant::QuantizationResult = match quantizer.quantize(&mut image) {
        Ok(res) => res,
        Err(err) => panic!("Quantization failed, because: {err:?}"),
    };

    // Enable dithering for subsequent remappings
    res.set_dithering_level(options.dithering).unwrap();

    // You can reuse the result to generate several images with the same palette
    let (palette, pixels) = res.remapped(&mut image).unwrap();
	let mut output: Vec<u32> = Vec::with_capacity(pixels.len());
	for i in pixels {
		output.push(bytemuck::cast(palette[i as usize]));
	}
	return output;
}

#[derive(Serialize, Deserialize)]
pub struct EncodeOptions {
	pub level: u8,
	pub interlace: bool,
}

#[wasm_bindgen]
pub fn encode_png(data: Vec<u8>, width: u32, height: u32, options: JsValue) -> Vec<u8> {
	let options: EncodeOptions = serde_wasm_bindgen::from_value(options).unwrap();

	let mut optimization = oxipng::Options::from_preset(options.level);
    optimization.optimize_alpha = true;
    optimization.interlace = Some(if options.interlace {
		oxipng::Interlacing::Adam7
    } else {
		oxipng::Interlacing::None
    });

    let raw = oxipng::RawImage::new(
		width, height,
		oxipng::ColorType::RGBA,
		oxipng::BitDepth::Eight, data).unwrap_throw();

    return raw.create_optimized_png(&optimization).unwrap_throw()
}
