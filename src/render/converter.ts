import pngjs from 'pngjs'
import { ditherImage, type DitherMode } from './dither.js'

export function reencodePng(png: { data: Buffer; width: number; height: number }, mode: DitherMode = 'threshold'): Buffer {
  const ditheredData = ditherImage(png.data, png.width, png.height, mode)

  const grayscale = Buffer.alloc(ditheredData.length)
  for (let i = 0; i < ditheredData.length; i++) {
    grayscale[i] = ditheredData[i] ? 255 : 0
  }

  return pngjs.PNG.sync.write({
    data: grayscale,
    width: png.width,
    height: png.height,
  } as pngjs.PNG,
    {
      colorType: 0,
      inputColorType: 0,
      inputHasAlpha: false,
      bitDepth: 8,
    })
}