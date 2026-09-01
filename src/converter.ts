import pngjs from 'pngjs'

export function reencodePng(png: { data: Buffer; width: number; height: number }): Buffer {
  return pngjs.PNG.sync.write(png as pngjs.PNG)
}