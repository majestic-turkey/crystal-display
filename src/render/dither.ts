import pngjs from 'pngjs'

export function ditherImage(imageData: Buffer, width: number, height: number): Float32Array {
    const luminanceBuffer = new Float32Array(width * height)
    const ditheredData = new Float32Array(width * height)

    const addError = (i: number, value: number): void => {
        luminanceBuffer[i] = (luminanceBuffer[i] ?? 0) + value
    }

    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4
            const r = imageData[index] ?? 0
            const g = imageData[index + 1] ?? 0
            const b = imageData[index + 2] ?? 0
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b
            luminanceBuffer[y * width + x] = luminance / 255
        }
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x
            const oldPixel = luminanceBuffer[index] ?? 0
            const newPixel = oldPixel < 0.5 ? 0 : 1
            ditheredData[index] = newPixel
            const error = oldPixel - newPixel
            if (x + 1 < width) addError(index + 1, error * 7 / 16)
            if (x - 1 >= 0 && y + 1 < height) addError(index + width - 1, error * 3 / 16)
            if (y + 1 < height) addError(index + width, error * 5 / 16)
            if (x + 1 < width && y + 1 < height) addError(index + width + 1, error * 1 / 16)
        }
    }

    return ditheredData
}