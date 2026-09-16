import puppeteer from 'puppeteer'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const HTML_PATH = resolve(ROOT, 'manual', 'index.html')
const PDF_DIR = resolve(ROOT, 'manual')
const PDF_PATH = resolve(PDF_DIR, 'Manual-Controle-de-Caixa-Juros-Pro.pdf')

async function gerarManual() {
  if (!existsSync(HTML_PATH)) {
    console.error(`Arquivo HTML não encontrado: ${HTML_PATH}`)
    process.exit(1)
  }

  if (!existsSync(PDF_DIR)) {
    mkdirSync(PDF_DIR, { recursive: true })
  }

  console.log('Iniciando geração do manual...')
  console.log(`HTML: ${HTML_PATH}`)
  console.log(`PDF:  ${PDF_PATH}`)

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()

    const fileUrl = `file:///${HTML_PATH.replace(/\\/g, '/')}`
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 })

    await page.pdf({
      path: PDF_PATH,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%; text-align:center; font-size:9px; color:#9ca3af; padding:0 60px; font-family:'Segoe UI',system-ui,sans-serif;">
          <span>Controle de Caixa & Juros Pro — Manual do Cliente</span>
          <span style="float:right;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: '0mm',
        bottom: '20mm',
        left: '0mm',
        right: '0mm'
      }
    })

    console.log(`\nPDF gerado com sucesso!`)
    console.log(`Local: ${PDF_PATH}`)
  } finally {
    await browser.close()
  }
}

gerarManual().catch(err => {
  console.error('Erro ao gerar manual:', err)
  process.exit(1)
})
