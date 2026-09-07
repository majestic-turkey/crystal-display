import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { ditherImage } from '../src/render/dither.js'

/** Builds a uniform RGBA buffer, the shape Playwright screenshots arrive in. */
function solid(width: number, height: number, r: number, g: number, b: number): Buffer {
    const buf = Buffer.alloc(width * height * 4)
    for (let i = 0; i < width * height; i++) {
        buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255
    }
    return buf
}

const W = 32, H = 32

describe('ditherImage', () => {
    test('returns one value per pixel, always 0 or 1', () => {
        const out = ditherImage(solid(W, H, 128, 128, 128), W, H, 'dither')
        assert.equal(out.length, W * H)
        assert.ok(out.every(v => v === 0 || v === 1), 'output must be strictly bilevel')
    })

    test('maps pure white to 1 and pure black to 0', () => {
        for (const mode of ['threshold', 'dither'] as const) {
            assert.ok(ditherImage(solid(W, H, 255, 255, 255), W, H, mode).every(v => v === 1), `white/${mode}`)
            assert.ok(ditherImage(solid(W, H, 0, 0, 0), W, H, mode).every(v => v === 0), `black/${mode}`)
        }
    })

    test('threshold leaves flat mid-tones uniform; dither breaks them up', () => {
        // This is the whole point of the split: text pages must not acquire grain.
        const gray = solid(W, H, 128, 128, 128)

        const thresholded = ditherImage(gray, W, H, 'threshold')
        assert.equal(new Set(thresholded).size, 1, 'threshold must not diffuse error')

        const dithered = ditherImage(gray, W, H, 'dither')
        assert.equal(new Set(dithered).size, 2, 'dither must produce a mix of black and white')
    })

    test('defaults to threshold', () => {
        const gray = solid(W, H, 128, 128, 128)
        assert.deepEqual(
            Array.from(ditherImage(gray, W, H)),
            Array.from(ditherImage(gray, W, H, 'threshold')),
        )
    })

    test('weights channels by luminance, not a plain average', () => {
        // 0.299R + 0.587G + 0.114B: pure red lands below the midpoint, pure green above.
        assert.ok(ditherImage(solid(W, H, 255, 0, 0), W, H, 'threshold').every(v => v === 0), 'red -> black')
        assert.ok(ditherImage(solid(W, H, 0, 255, 0), W, H, 'threshold').every(v => v === 1), 'green -> white')
        assert.ok(ditherImage(solid(W, H, 0, 0, 255), W, H, 'threshold').every(v => v === 0), 'blue -> black')
    })

    test('preserves a hard edge under threshold', () => {
        const buf = Buffer.alloc(W * H * 4)
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const v = x < W / 2 ? 0 : 255
                const i = (y * W + x) * 4
                buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = 255
            }
        }
        const out = ditherImage(buf, W, H, 'threshold')
        assert.equal(out[0], 0, 'left half black')
        assert.equal(out[W - 1], 1, 'right half white')
        assert.equal(out[W / 2 - 1], 0, 'edge stays exactly at the midpoint')
        assert.equal(out[W / 2], 1)
    })
})
