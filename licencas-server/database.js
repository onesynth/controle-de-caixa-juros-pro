import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ARQ_JSON = path.join(__dirname, 'licencas.json')

let sql = null
let usaBanco = false

const DATABASE_URL = process.env.DATABASE_URL || ''

// ---- Fallback JSON ----
function carregarJSON() {
  try {
    if (!fs.existsSync(ARQ_JSON)) return { chaves: [] }
    return JSON.parse(fs.readFileSync(ARQ_JSON, 'utf-8'))
  } catch { return { chaves: [] } }
}

function salvarJSON(d) {
  fs.writeFileSync(ARQ_JSON, JSON.stringify(d, null, 2), 'utf-8')
}

// ---- Init DB ----
export async function initDB() {
  if (!DATABASE_URL) {
    console.log('DATABASE_URL não configurada. Usando licencas.json como backup.')
    return
  }
  const { neon } = await import('@neondatabase/serverless')
  sql = neon(DATABASE_URL)
  usaBanco = true
  await sql`CREATE TABLE IF NOT EXISTS chaves (
    chave VARCHAR(19) PRIMARY KEY,
    maquinas JSONB DEFAULT '[]'::jsonb,
    bloqueada BOOLEAN DEFAULT false,
    criada_em TIMESTAMPTZ DEFAULT NOW(),
    ativada_em TIMESTAMPTZ,
    obs TEXT DEFAULT ''
  )`
  await sql`CREATE TABLE IF NOT EXISTS config (
    chave VARCHAR(50) PRIMARY KEY,
    valor TEXT
  )`
  console.log('Banco Neon inicializado com sucesso.')
}

// ---- Chaves ----
export async function carregarChaves() {
  if (!usaBanco) {
    const d = carregarJSON()
    return d.chaves || []
  }
  const rows = await sql`SELECT * FROM chaves ORDER BY criada_em DESC`
  return rows.map(r => ({
    chave: r.chave,
    maquinas: r.maquinas || [],
    bloqueada: r.bloqueada,
    criadaEm: r.criada_em,
    ativadaEm: r.ativada_em,
    obs: r.obs
  }))
}

export async function buscarChave(chave) {
  if (!usaBanco) {
    const d = carregarJSON()
    return d.chaves.find(c => c.chave === chave) || null
  }
  const rows = await sql`SELECT * FROM chaves WHERE chave = ${chave}`
  return rows[0] || null
}

export async function criarChave(chave, obs = '') {
  if (!usaBanco) {
    const d = carregarJSON()
    const nova = { chave, maquinas: [], bloqueada: false, criadaEm: new Date().toISOString(), obs }
    d.chaves.push(nova)
    salvarJSON(d)
    return nova
  }
  await sql`INSERT INTO chaves (chave, obs) VALUES (${chave}, ${obs})`
  return { chave, maquinas: [], bloqueada: false, criadaEm: new Date().toISOString(), obs }
}

export async function adicionarMaquina(chave, idMaquina) {
  if (!usaBanco) {
    const d = carregarJSON()
    const lic = d.chaves.find(c => c.chave === chave)
    if (lic) {
      if (!lic.maquinas.includes(idMaquina)) lic.maquinas.push(idMaquina)
      lic.ativadaEm = new Date().toISOString()
      salvarJSON(d)
    }
    return
  }
  await sql`UPDATE chaves SET maquinas = maquinas || ${JSON.stringify([idMaquina])}::jsonb, ativada_em = NOW() WHERE chave = ${chave}`
}

export async function resetarMaquinas(chave) {
  if (!usaBanco) {
    const d = carregarJSON()
    const lic = d.chaves.find(c => c.chave === chave)
    if (lic) {
      lic.maquinas = []
      lic.ativadaEm = null
      salvarJSON(d)
    }
    return
  }
  await sql`UPDATE chaves SET maquinas = '[]'::jsonb, ativada_em = NULL WHERE chave = ${chave}`
}

export async function bloquearChave(chave) {
  if (!usaBanco) {
    const d = carregarJSON()
    const lic = d.chaves.find(c => c.chave === chave)
    if (lic) {
      lic.bloqueada = !lic.bloqueada
      salvarJSON(d)
      return lic.bloqueada
    }
    return false
  }
  const rows = await sql`UPDATE chaves SET bloqueada = NOT bloqueada WHERE chave = ${chave} RETURNING bloqueada`
  return rows[0]?.bloqueada
}

// ---- Config ----
export async function buscarConfig() {
  if (!usaBanco) {
    const d = carregarJSON()
    return d.config || { versao: '1.0.0', downloadUrl: '' }
  }
  const rows = await sql`SELECT * FROM config`
  const cfg = { versao: '1.0.0', downloadUrl: '' }
  for (const r of rows) {
    if (r.chave === 'versao') cfg.versao = r.valor
    if (r.chave === 'downloadUrl') cfg.downloadUrl = r.valor
  }
  return cfg
}

export async function salvarConfig(cfg) {
  if (!usaBanco) {
    const d = carregarJSON()
    d.config = cfg
    salvarJSON(d)
    return
  }
  for (const [k, v] of Object.entries(cfg)) {
    await sql`INSERT INTO config (chave, valor) VALUES (${k}, ${String(v)}) ON CONFLICT (chave) DO UPDATE SET valor = ${String(v)}`
  }
}

// ---- Migração ----
export async function migrarJSON(caminhoJSON) {
  if (!fs.existsSync(caminhoJSON)) {
    console.log('Arquivo JSON não encontrado, nada para migrar.')
    return
  }
  const dados = JSON.parse(fs.readFileSync(caminhoJSON, 'utf-8'))
  if (!DATABASE_URL) {
    console.log('Sem DATABASE_URL, nada para migrar.')
    return
  }
  const { neon } = await import('@neondatabase/serverless')
  const db = neon(DATABASE_URL)

  let migradas = 0
  for (const c of (dados.chaves || [])) {
    const rows = await db`SELECT chave FROM chaves WHERE chave = ${c.chave}`
    if (rows.length === 0) {
      await db`INSERT INTO chaves (chave, maquinas, bloqueada, criada_em, ativada_em, obs) VALUES (${c.chave}, ${JSON.stringify(c.maquinas || [])}::jsonb, ${c.bloqueada || false}, ${c.criadaEm || new Date().toISOString()}, ${c.ativadaEm || null}, ${c.obs || ''})`
      migradas++
    }
  }
  console.log(`Migração concluída: ${migradas} chaves importadas.`)
}

export async function fechar() {
  sql = null
  usaBanco = false
}
