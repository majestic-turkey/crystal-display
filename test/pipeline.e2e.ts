import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Exercises the bytes the panel actually receives: boot render -> disk cache ->
// HTTP -> an independent decoder that shares no code with the encoder.

const PORT = 7099
const BASE = `http://127.0.0.1:${PORT}`
const BOOT_TIMEOUT_MS = 90_000

let server: ChildProcess
let dataDir: string
let log = ''

function killTree(child: ChildProcess): void {
    if (child.pid === undefined || child.exitCode !== null) return
    if (process.platform === 'win32') {
        spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' })
    } else {
        try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
    }
}

before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crystal-e2e-'))
    server = spawn('npx', ['tsx', 'src/index.ts'], {
        env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, BASE_URL: BASE, MODE: 'test' },
        shell: process.platform === 'win32',
        detached: process.platform !== 'win32',
    })
    server.stdout?.on('data', d => { log += d.toString() })
    server.stderr?.on('data', d => { log += d.toString() })

    const deadline = Date.now() + BOOT_TIMEOUT_MS
    while (!/Rendered |Render failed/.test(log)) {
        if (Date.now() > deadline) throw new Error(`server never completed a render:\n${log}`)
        if (server.exitCode !== null) throw new Error(`server exited early (${server.exitCode}):\n${log}`)
        await new Promise(r => setTimeout(r, 250))
    }
    assert.doesNotMatch(log, /Render failed/, `boot render failed:\n${log}`)
})

after(async () => {
    killTree(server)
    await new Promise(r => setTimeout(r, 1500))
    await fs.rm(dataDir, { recursive: true, force: true })
})

describe('GET /render.bmp', () => {
    test('serves a valid 800x480 1-bit BMP', async () => {
        const res = await fetch(`${BASE}/render.bmp`)
        assert.equal(res.status, 200)
        assert.equal(res.headers.get('content-type'), 'image/bmp')
        assert.ok(res.headers.get('etag'), 'ETag present')
        assert.ok(res.headers.get('last-modified'), 'Last-Modified present')

        const bmp = Buffer.from(await res.arrayBuffer())
        assert.equal(Number(res.headers.get('content-length')), bmp.length)
        assert.equal(bmp.toString('ascii', 0, 2), 'BM')
        assert.equal(bmp.length, 48062, '62-byte header + 100-byte rows x 480')
        assert.equal(bmp.readUInt32LE(2), bmp.length, 'declared size matches the body')
        assert.equal(bmp.readUInt32LE(10), 62, 'pixel offset clears the palette')
        assert.equal(bmp.readInt32LE(18), 800)
        assert.equal(bmp.readInt32LE(22), 480)
        assert.equal(bmp.readUInt16LE(28), 1, '1 bit per pixel')
        assert.equal(bmp.readUInt32LE(30), 0, 'uncompressed')
    })

    test('decodes to a plausible dashboard rather than a blank panel', async () => {
        const bmp = Buffer.from(await (await fetch(`${BASE}/render.bmp`)).arrayBuffer())
        const offset = bmp.readUInt32LE(10)
        const width = bmp.readInt32LE(18)
        const height = bmp.readInt32LE(22)
        const stride = ((width + 31) >> 5) << 2

        let white = 0
        for (let y = 0; y < height; y++) {
            const row = offset + (height - 1 - y) * stride
            for (let x = 0; x < width; x++) white += (bmp[row + (x >> 3)]! >> (7 - (x & 7))) & 1
        }
        const ratio = white / (width * height)
        assert.ok(ratio > 0.05 && ratio < 0.98, `ink coverage should look like a dashboard, got ${ratio.toFixed(3)} white`)
    })

    test('serves the cached bytes without re-rendering', async () => {
        const renders = () => (log.match(/Rendered /g) ?? []).length
        const before = renders()

        const bodies = await Promise.all(
            [1, 2, 3].map(async () => Buffer.from(await (await fetch(`${BASE}/render.bmp`)).arrayBuffer())),
        )

        assert.ok(bodies[0]!.equals(bodies[1]!) && bodies[1]!.equals(bodies[2]!), 'identical bytes each time')
        assert.equal(renders(), before, 'the device endpoint must never launch a browser')
    })

    test('writes the bitmap and its metadata to the data directory', async () => {
        const onDisk = await fs.readFile(path.join(dataDir, 'render.bmp'))
        const served = Buffer.from(await (await fetch(`${BASE}/render.bmp`)).arrayBuffer())
        assert.ok(onDisk.equals(served), 'cache file matches what is served')

        const meta = JSON.parse(await fs.readFile(path.join(dataDir, 'render.json'), 'utf-8'))
        assert.match(meta.generatedAt, /^\d{4}-\d{2}-\d{2}T/)
        assert.ok(['weather', 'calendar', 'photo', 'news'].includes(meta.page))
        assert.ok(Number.isInteger(meta.rotationIndex))
    })
})

describe('GET /preview', () => {
    test('serves every page type', async () => {
        for (const page of ['weather', 'calendar', 'photo', 'news']) {
            const res = await fetch(`${BASE}/preview?page=${page}`)
            assert.equal(res.status, 200, page)
            assert.match(await res.text(), /^<!DOCTYPE html>/, page)
        }
    })

    test('rejects an unknown page', async () => {
        assert.equal((await fetch(`${BASE}/preview?page=sports`)).status, 400)
    })

    test('reflects the request host in the base href', async () => {
        // fetch() refuses to set Host, so go through node:http to imitate nginx.
        const body = await new Promise<string>((resolve, reject) => {
            const req = http.request(
                { host: '127.0.0.1', port: PORT, path: '/preview?page=weather', headers: { Host: 'display.example.com' } },
                res => { let d = ''; res.on('data', c => { d += c }); res.on('end', () => resolve(d)) },
            )
            req.on('error', reject)
            req.end()
        })
        assert.match(body, /<base href="http:\/\/display\.example\.com\/">/)
    })

    test('sheds load instead of opening unbounded browser pages', async () => {
        const codes = await Promise.all(
            Array.from({ length: 14 }, async () => (await fetch(`${BASE}/preview?page=weather&mode=1bit`)).status),
        )
        const ok = codes.filter(c => c === 200).length
        const busy = codes.filter(c => c === 503).length

        assert.equal(ok + busy, codes.length, `unexpected statuses: ${codes.join(',')}`)
        assert.ok(ok <= 8, `at most 2 running + 6 queued should succeed, got ${ok}`)
        assert.ok(busy > 0, 'excess requests must be shed with 503')
    })
})
