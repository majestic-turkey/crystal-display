const DIB_END = 54;      // 14-byte file header + 40-byte DIB header
const PIXEL_OFFSET = 62; // DIB_END + 8-byte palette

// BGRA, in palette-index order. A set bit selects index 1.
// If the panel comes up inverted during bring-up, swap these two.
const PALETTE_INDEX_0 = 0x00000000; // black
const PALETTE_INDEX_1 = 0x00FFFFFF; // white

export function encodeMonoBmp(bits: Float32Array, width: number, height: number): Buffer {
    if (!width || !height) {
        throw new Error('Invalid image dimensions');
    }
    if (bits.length !== width * height) {
        throw new Error('Invalid image data');
    }

    const rowSize = ((width + 31) >> 5) << 2; // rows are padded to a 4-byte boundary
    const dataSize = rowSize * height;
    const buffer = Buffer.alloc(PIXEL_OFFSET + dataSize);

    // BMP header
    buffer.write('BM', 0); // Signature
    buffer.writeUInt32LE(PIXEL_OFFSET + dataSize, 2); // File size
    buffer.writeUInt32LE(0, 6); // Reserved
    buffer.writeUInt32LE(PIXEL_OFFSET, 10); // Data offset

    // DIB header
    buffer.writeUInt32LE(40, 14); // DIB header size
    buffer.writeInt32LE(width, 18); // Width
    buffer.writeInt32LE(height, 22); // Height (positive, so rows are stored bottom-up)
    buffer.writeUInt16LE(1, 26); // Color planes
    buffer.writeUInt16LE(1, 28); // Bits per pixel
    buffer.writeUInt32LE(0, 30); // Compression (none)
    buffer.writeUInt32LE(dataSize, 34); // Image size
    buffer.writeInt32LE(2835, 38); // Horizontal resolution (pixels/meter)
    buffer.writeInt32LE(2835, 42); // Vertical resolution (pixels/meter)
    buffer.writeUInt32LE(2, 46); // Number of colors in palette
    buffer.writeUInt32LE(0, 50); // Important colors

    // Color palette (black and white)
    buffer.writeUInt32LE(PALETTE_INDEX_0, DIB_END);
    buffer.writeUInt32LE(PALETTE_INDEX_1, DIB_END + 4);

    // Bitmap data, bottom-up: source row 0 is the last row in the file.
    for (let y = 0; y < height; y++) {
        const rowStart = PIXEL_OFFSET + (height - 1 - y) * rowSize;
        for (let x = 0; x < width; x++) {
            const pixel = (bits[y * width + x] ?? 0) > 0.5 ? 1 : 0;
            if (!pixel) continue;
            const outIndex = rowStart + (x >> 3);
            buffer[outIndex] = (buffer[outIndex] ?? 0) | (1 << (7 - (x & 7)));
        }
    }

    return buffer;
}
