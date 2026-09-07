import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// DATA_DIR is read when config.js is first evaluated, so point it at a scratch
// directory before anything imports the cache module.
const TMP_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'crystal-cache-'))
process.env.DATA_DIR = TMP_DIR

const { parseMeta, writeCache, loadCache, getCachedRender, getLastMeta } = await import('../src/render/cache.js')

const BMP_PATH = path.join(TMP_DIR, 'render.bmp')
const META_PATH = path.join(TMP_DIR, 'render.json')
const meta = { generatedAt: '2026-09-07T03:50:00.000Z', page: 'news' as const, rotationIndex: 2 }

after(async () => { await fs.rm(TMP_DIR, { recursive: true, force: true }) })

describe('parseMeta', () => {
    test('accepts well-formed metadata', () => {
        assert.deepEqual(parseMeta(JSON.stringify(meta)), meta)
    })

    test('wraps a rotation index that outran the page list', () => {
        const parsed = parseMeta(JSON.stringify({ ...meta, rotationIndex: 9 }))
        assert.equal(parsed?.rotationIndex, 1, '9 % 4 pages')
    })

    test('rejects anything malformed rather than half-trusting it', () => {
        const bad: Array<[string, string]> = [
            ['not json at all', 'garbage'],
            [JSON.stringify({ ...meta, page: 'sports' }), 'unknown page'],
            [JSON.stringify({ ...meta, generatedAt: 12345 }), 'non-string timestamp'],
            [JSON.stringify({ ...meta, rotationIndex: 'two' }), 'non-numeric index'],
            [JSON.stringify({ ...meta, rotationIndex: 1.5 }), 'fractional index'],
            ['null', 'null document'],
        ]
        for (const [raw, label] of bad) assert.equal(parseMeta(raw), null, label)
    })
})

describe('cache round trip', () => {
    before(async () => { await writeCache(Buffer.from('fake-bitmap-bytes'), meta) })

    test('writes both files and serves the buffer from memory', async () => {
        assert.deepEqual(JSON.parse(await fs.readFile(META_PATH, 'utf-8')), meta)
        assert.equal((await fs.readFile(BMP_PATH)).toString(), 'fake-bitmap-bytes')

        const cached = getCachedRender()
        assert.equal(cached?.buffer.toString(), 'fake-bitmap-bytes')
        assert.deepEqual(cached?.meta, meta)
    })

    test('leaves no temp files behind', async () => {
        const entries = await fs.readdir(TMP_DIR)
        assert.deepEqual(entries.sort(), ['render.bmp', 'render.json'], 'atomic writes must clean up .tmp')
    })

    test('reloads from disk', async () => {
        const loaded = await loadCache()
        assert.equal(loaded?.buffer.toString(), 'fake-bitmap-bytes')
        assert.deepEqual(loaded?.meta, meta)
    })

    test('keeps the rotation index when the bitmap is missing', async () => {
        // Regression: reading both files together meant a lost render.bmp also
        // reset the rotation, so every cold start replayed the first page.
        await fs.rm(BMP_PATH)

        assert.equal(await loadCache(), null, 'no bitmap means no servable render')
        assert.deepEqual(getLastMeta(), meta, 'but the rotation index survives')
    })

    test('survives unreadable metadata', async () => {
        await fs.writeFile(META_PATH, '{ this is not json')
        assert.equal(await loadCache(), null)
    })
})
