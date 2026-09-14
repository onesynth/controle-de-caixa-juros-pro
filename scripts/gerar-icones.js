import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.join(__dirname, '..')
const svgPath = path.join(projectDir, 'public', 'logo.svg')
const electronDir = path.join(projectDir, 'electron')

async function gerarIcones() {
  const svgBuffer = fs.readFileSync(svgPath)

  // Gerar PNGs em múltiplos tamanhos
  const tamanhos = [256, 128, 64, 48, 32, 16]
  const pngPaths = []

  for (const size of tamanhos) {
    const pngPath = path.join(electronDir, `icon-${size}.png`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(pngPath)
    pngPaths.push(pngPath)
    console.log(`PNG gerado: icon-${size}.png`)
  }

  // Copiar 256x256 como icon.png (referenciado no package.json build)
  const iconPngPath = path.join(electronDir, 'icon.png')
  fs.copyFileSync(path.join(electronDir, 'icon-256.png'), iconPngPath)
  console.log('icon.png criado (256x256)')

  // Gerar .ico com múltiplos tamanhos
  const icoPath = path.join(electronDir, 'icon.ico')
  const icoInput = [
    path.join(electronDir, 'icon-16.png'),
    path.join(electronDir, 'icon-32.png'),
    path.join(electronDir, 'icon-48.png'),
    path.join(electronDir, 'icon-256.png')
  ]
  const icoBuffer = await pngToIco(icoInput)
  fs.writeFileSync(icoPath, icoBuffer)
  console.log('icon.ico criado (16x16, 32x32, 48x48, 256x256)')

  // Limpar PNGs temporários
  for (const size of tamanhos) {
    const tempPath = path.join(electronDir, `icon-${size}.png`)
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
  }
  console.log('PNGs temporários removidos')

  console.log('\nÍcones gerados com sucesso!')
  console.log(`  icon.png  → ${iconPngPath}`)
  console.log(`  icon.ico  → ${icoPath}`)
}

gerarIcones().catch(err => {
  console.error('Erro ao gerar ícones:', err)
  process.exit(1)
})
