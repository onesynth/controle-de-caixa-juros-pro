import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const svgPath = path.join(__dirname, '..', 'public', 'logo.svg')
const outPath = path.join(__dirname, '..', 'public', 'logo.png')

await sharp(svgPath)
  .resize(300, 250, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(outPath)

console.log(`Logo PNG gerado: ${outPath} (300x250)`)
