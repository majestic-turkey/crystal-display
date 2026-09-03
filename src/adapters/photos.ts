import type { DataAdapter, PhotoData } from "../types.js"
import fs from "fs/promises"
import path from "path"

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"])
const imagesDir = path.join(process.cwd(), "public/assets/images")

export async function getPhotoData(): Promise<DataAdapter<PhotoData>> {
    try {
        const entries = await fs.readdir(imagesDir, { withFileTypes: true })
        const images = entries
            .filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
            .map(entry => entry.name)

        if (images.length === 0) throw new Error(`No images found in ${imagesDir}`)

        const chosen = images[Math.floor(Math.random() * images.length)]
        return {
            name: "Photo",
            fetchedAt: new Date().toISOString(),
            data: { src: `/assets/images/${chosen}` }
        }
    } catch (error) {
        console.error("Failed to load photo data:", error)
        return {
            name: "Photo",
            fetchedAt: new Date().toISOString(),
            data: null
        }
    }
}
