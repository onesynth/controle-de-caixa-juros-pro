// v1.1.3 — @neondatabase/serverless
import express from 'express'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  initDB,
  carregarChaves,
  buscarChave,
  criarChave,
  adicionarMaquina,
  resetarMaquinas,
  bloquearChave,
  buscarConfig,
  salvarConfig
} from './database.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const APP_NAME = process.env.APP_NAME || 'Controle Financeiro Pro'
const KEY_PREFIX = process.env.KEY_PREFIX || 'CFP'
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin-dev-123'
const SEGREDO = process.env.SEGREDO || 'segredo-dev-trocar-em-producao'
const LIMITE_MAQUINAS = 1
const VALIDADE_TOKEN_DIAS = 15

function gerarChave() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bloco = () => Array.from({ length: 4 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('')
  return `${KEY_PREFIX}-${bloco()}-${bloco()}-${bloco()}`
}

function assinar(payload) {
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = crypto.createHmac('sha256', SEGREDO).update(corpo).digest('base64url')
  return `${corpo}.${mac}`
}

function verificar(token) {
  try {
    const [corpo, mac] = String(token || '').split('.')
    const esperado = crypto.createHmac('sha256', SEGREDO).update(corpo).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(esperado))) return null
    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString())
    if (new Date(payload.validoAte) < new Date()) return null
    return payload
  } catch { return null }
}

const app = express()
app.use(express.json())

// ---- API do app ----
app.post('/ativar', async (req, res) => {
  try {
    const { chave, idMaquina } = req.body || {}
    if (!chave || !idMaquina) return res.status(400).json({ erro: 'Informe a chave de licença.' })

    const lic = await buscarChave(String(chave).trim().toUpperCase())
    if (!lic) return res.status(404).json({ erro: 'Chave inválida. Verifique e tente novamente.' })
    if (lic.bloqueada) return res.status(403).json({ erro: 'Esta chave está bloqueada. Fale com o suporte.' })

    const maquinas = Array.isArray(lic.maquinas) ? lic.maquinas : []
    if (!maquinas.includes(idMaquina)) {
      if (maquinas.length >= LIMITE_MAQUINAS)
        return res.status(403).json({ erro: `Esta chave já está ativa em ${LIMITE_MAQUINAS} máquina(s). Fale com o suporte para transferir a licença.` })
      await adicionarMaquina(lic.chave, idMaquina)
    }

    const payload = {
      chave: lic.chave,
      idMaquina,
      validoAte: new Date(Date.now() + VALIDADE_TOKEN_DIAS * 864e5).toISOString()
    }
    const cfg = await buscarConfig()
    res.json({ ok: true, token: assinar(payload), revalidarEmDias: 7, ...cfg })
  } catch (e) {
    console.error('Erro ao ativar:', e)
    res.status(500).json({ erro: 'Erro interno do servidor.' })
  }
})

app.post('/validar', async (req, res) => {
  try {
    const { token } = req.body || {}
    const p = verificar(token)
    if (!p) return res.status(403).json({ erro: 'Licença expirada ou inválida. Conecte-se à internet para revalidar.' })

    const lic = await buscarChave(p.chave)
    const maquinas = lic ? (Array.isArray(lic.maquinas) ? lic.maquinas : []) : []
    if (!lic || lic.bloqueada || !maquinas.includes(p.idMaquina))
      return res.status(403).json({ erro: 'Licença desativada. Fale com o suporte.' })

    const payload = {
      chave: p.chave,
      idMaquina: p.idMaquina,
      validoAte: new Date(Date.now() + VALIDADE_TOKEN_DIAS * 864e5).toISOString()
    }
    const cfg = await buscarConfig()
    res.json({ ok: true, token: assinar(payload), ...cfg })
  } catch (e) {
    console.error('Erro ao validar:', e)
    res.status(500).json({ erro: 'Erro interno do servidor.' })
  }
})

// ---- Admin ----
const admin = express.Router()
admin.use((req, res, next) => {
  if (req.get('x-admin-key') !== ADMIN_KEY) return res.status(401).json({ erro: 'Não autorizado' })
  next()
})

admin.get('/info', (req, res) => {
  res.json({ appName: APP_NAME, keyPrefix: KEY_PREFIX })
})

admin.post('/gerar', async (req, res) => {
  try {
    const nova = await criarChave(gerarChave(), req.body?.obs || '')
    res.json(nova)
  } catch (e) {
    console.error('Erro ao gerar chave:', e)
    res.status(500).json({ erro: 'Erro ao gerar chave.' })
  }
})

admin.get('/chaves', async (req, res) => {
  try {
    const chaves = await carregarChaves()
    res.json(chaves.map(c => ({
      chave: c.chave,
      maquinas: Array.isArray(c.maquinas) ? c.maquinas.length : 0,
      bloqueada: c.bloqueada,
      criadaEm: c.criadaEm,
      ativadaEm: c.ativadaEm || null,
      obs: c.obs
    })))
  } catch (e) {
    console.error('Erro ao carregar chaves:', e)
    res.status(500).json({ erro: 'Erro ao carregar chaves.' })
  }
})

admin.post('/resetar', async (req, res) => {
  try {
    const lic = await buscarChave(req.body?.chave)
    if (!lic) return res.status(404).json({ erro: 'Chave não encontrada' })
    await resetarMaquinas(lic.chave)
    res.json({ ok: true })
  } catch (e) {
    console.error('Erro ao resetar:', e)
    res.status(500).json({ erro: 'Erro ao resetar.' })
  }
})

admin.post('/bloquear', async (req, res) => {
  try {
    const lic = await buscarChave(req.body?.chave)
    if (!lic) return res.status(404).json({ erro: 'Chave não encontrada' })
    const bloqueada = await bloquearChave(lic.chave)
    res.json({ ok: true, bloqueada })
  } catch (e) {
    console.error('Erro ao bloquear:', e)
    res.status(500).json({ erro: 'Erro ao bloquear.' })
  }
})

admin.get('/config', async (req, res) => {
  try {
    res.json(await buscarConfig())
  } catch (e) {
    console.error('Erro ao buscar config:', e)
    res.status(500).json({ erro: 'Erro ao buscar config.' })
  }
})

admin.post('/config', async (req, res) => {
  try {
    const atual = await buscarConfig()
    const { versao, downloadUrl } = req.body || {}
    if (versao !== undefined) atual.versao = String(versao).trim()
    if (downloadUrl !== undefined) atual.downloadUrl = String(downloadUrl).trim()
    await salvarConfig(atual)
    res.json({ ok: true, config: atual })
  } catch (e) {
    console.error('Erro ao salvar config:', e)
    res.status(500).json({ erro: 'Erro ao salvar config.' })
  }
})

app.use('/admin/api', admin)
app.use(express.static(__dirname))
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')))

const PORT = process.env.PORT || 4000

async function iniciar() {
  await initDB()
  console.log(`[${APP_NAME}] Banco de dados inicializado.`)
  app.listen(PORT, () => console.log(`[${APP_NAME}] Servidor de licenças em http://localhost:${PORT}`))
}

iniciar().catch(e => {
  console.error('Falha ao iniciar servidor:', e)
  process.exit(1)
})
