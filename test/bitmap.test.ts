import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { encodeMonoBmp } from '../src/render/bitmap.js'

const W = 800, H = 480
const PIXEL_OFFSET = 62          // 14-byte file header + 40-byte DIB header + 8-byte palette
const STRIDE = 100               // ((800 + 31) >> 5) << 2
const FILE_SIZE = PIXEL_OFFSET + STRIDE * H

/** Reads a pixel back out of an encoded BMP using only its own header fields. */
function readPixel(bmp: Buffer, x: number, y: number): number {
    const offset = bmp.readUInt32LE(10)
    const width = bmp.readInt32LE(18)
    const height = bmp.readInt32LE(22)
    const stride = ((width + 31) >> 5) << 2
    const row = offset + (height - 1 - y) * stride // positive height => bottom-up
    return (bmp[row + (x >> 3)]! >> (7 - (x & 7))) & 1
}

describe('encodeMonoBmp', () => {
    test('writes a well-formed 1-bit BMP header', () => {
        const bmp = encodeMonoBmp(new Float32Array(W * H), W, H)

        assert.equal(bmp.toString('ascii', 0, 2), 'BM')
        assert.equal(bmp.readUInt32LE(2), FILE_SIZE, 'file size field')
        assert.equal(bmp.length, FILE_SIZE, 'actual buffer length')
        assert.equal(bmp.readUInt32LE(10), PIXEL_OFFSET, 'pixel data offset')
        assert.equal(bmp.readUInt32LE(14), 40, 'DIB header size')
        assert.equal(bmp.readInt32LE(18), W)
        assert.equal(bmp.readInt32LE(22), H)
        assert.equal(bmp.readUInt16LE(26), 1, 'color planes')
        assert.equal(bmp.readUInt16LE(28), 1, 'bits per pixel')
        assert.equal(bmp.readUInt32LE(30), 0, 'compression must be BI_RGB')
        assert.equal(bmp.readUInt32LE(34), STRIDE * H, 'image size')
    })

    test('palette does not collide with pixel data', () => {
        // Regression: the palette was once written at offset 54 while the header
        // claimed pixels began there too, silently clobbering the first 8 bytes.
        const bmp = encodeMonoBmp(new Float32Array(W * H), W, H)

        assert.equal(bmp.readUInt32LE(54), 0x00000000, 'palette index 0 = black')
        assert.equal(bmp.readUInt32LE(58), 0x00FFFFFF, 'palette index 1 = white')
        assert.ok(bmp.readUInt32LE(10) >= 62, 'pixel data must start after the palette')
    })

    test('stores rows bottom-up so the image is not flipped', () => {
        // Regression: rows were written top-down under a positive biHeight.
        const bits = new Float32Array(W * H)
        bits[0] = 1 // top-left pixel only

        const bmp = encodeMonoBmp(bits, W, H)
        const offset = bmp.readUInt32LE(10)

        assert.equal(bmp[offset + (H - 1) * STRIDE], 0x80, 'last file row holds the top-left pixel')
        assert.equal(bmp[offset], 0x00, 'first file row is empty')
        assert.equal(readPixel(bmp, 0, 0), 1)
        assert.equal(readPixel(bmp, 0, H - 1), 0)
    })

    test('pads rows to a 4-byte boundary', () => {
        // Regression: ceil(width/8) happens to be aligned at 800px but not elsewhere.
        for (const [width, expected] of [[800, 100], [100, 16], [300, 40], [1, 4]] as const) {
            const bmp = encodeMonoBmp(new Float32Array(width * 2), width, 2)
            const stride = (bmp.length - bmp.readUInt32LE(10)) / 2
            assert.equal(stride, expected, `stride for width ${width}`)
            assert.equal(stride % 4, 0, `stride for width ${width} must be 4-byte aligned`)
        }
    })

    test('packs bits MSB-first within each byte', () => {
        const bits = new Float32Array(W * H)
        for (const x of [0, 1, 7, 8]) bits[x] = 1

        const bmp = encodeMonoBmp(bits, W, H)
        const row = bmp.readUInt32LE(10) + (H - 1) * STRIDE

        assert.equal(bmp[row], 0b11000001, 'x=0,1,7 occupy bits 7,6,0')
        assert.equal(bmp[row + 1], 0b10000000, 'x=8 starts the next byte')
    })

    test('round-trips arbitrary pixels', () => {
        const bits = new Float32Array(W * H)
        const set: Array<[number, number]> = [[0, 0], [799, 0], [0, 479], [799, 479], [123, 456]]
        for (const [x, y] of set) bits[y * W + x] = 1

        const bmp = encodeMonoBmp(bits, W, H)
        for (const [x, y] of set) assert.equal(readPixel(bmp, x, y), 1, `pixel ${x},${y} set`)
        assert.equal(readPixel(bmp, 400, 240), 0, 'unset pixel stays clear')
    })

    test('rejects bad input instead of emitting a corrupt file', () => {
        assert.throws(() => encodeMonoBmp(new Float32Array(0), 0, 10), /Invalid image dimensions/)
        assert.throws(() => encodeMonoBmp(new Float32Array(10), 800, 480), /Invalid image data/)
    })
})
