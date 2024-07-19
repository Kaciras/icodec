use imagequant::RGBA;
use wasm_bindgen::prelude::*;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn quantize(data: Vec<u8>, width: usize, height: usize) -> Vec<u32> {
    // Configure the library
    let mut quantizer = imagequant::new();
    quantizer.set_speed(5).unwrap();
    quantizer.set_quality(70, 99).unwrap();

	let pixels: &[RGBA] = bytemuck::cast_slice(data.as_slice());
    let mut image = quantizer.new_image(pixels, width, height, 0.0).unwrap();

    // The magic happens in quantize()
    let mut res = match quantizer.quantize(&mut image) {
        Ok(res) => res,
        Err(err) => panic!("Quantization failed, because: {err:?}"),
    };

    // Enable dithering for subsequent remappings
    res.set_dithering_level(1.0).unwrap();

    // You can reuse the result to generate several images with the same palette
    let (palette, pixels) = res.remapped(&mut image).unwrap();
	let mut output: Vec<u32> = Vec::with_capacity(pixels.len());
	for i in pixels {
		output.push(bytemuck::cast(palette[i as usize]));
	}
	return output;
}

#[wasm_bindgen]
pub fn encodePNG(data: Vec<u8>, width: u32, height: u32, level: u8, interlace: bool) -> Vec<u8> {
	let mut options = oxipng::Options::from_preset(level);
    options.optimize_alpha = true;
    options.interlace = Some(if interlace {
		oxipng::Interlacing::Adam7
    } else {
		oxipng::Interlacing::None
    });

    let raw = oxipng::RawImage::new(
		width, height, 
		oxipng::ColorType::RGBA, 
		oxipng::BitDepth::Eight, data).unwrap_throw();

    return raw.create_optimized_png(&options).unwrap_throw()
}
