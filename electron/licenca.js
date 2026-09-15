import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { app } from 'electron'

// URL do servidor de licenças (Render)
export const URL_LICENCAS = process.env.URL_LICENCAS || 'https://controle-caixa-juros-licencas.onrender.com'
const REVALIDAR_DIAS = 7
const TOLERANCIA_DIAS = 15

function arquivoLicenca() {
  const dir = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'controle-caixa-juros-pro')
    : path.join(app.getPath('userData'), 'dados')
  return path.join(dir, 'licenca.json')
}

export function idMaquina() {
  const base = [os.hostname(), os.platform(), os.cpus()[0]?.model || '', (os.networkInterfaces() && Object.values(os.networkInterfaces()).flat().filter(i => i && !i.internal).map(i => i.mac)[0]) || ''].join('|')
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 32)
}

export function licencaSalva() {
  try { return JSON.parse(fs.readFileSync(arquivoLicenca(), 'utf-8')) } catch { return null }
}

export function salvarLicenca(lic) {
  fs.mkdirSync(path.dirname(arquivoLicenca()), { recursive: true })
  fs.writeFileSync(arquivoLicenca(), JSON.stringify(lic, null, 2), 'utf-8')
}

async function chamar(rota, corpo) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const r = await fetch(`${URL_LICENCAS}${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: controller.signal
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`)
    return d
  } finally {
    clearTimeout(timeout)
  }
}

export async function ativar(chave) {
  const d = await chamar('/ativar', { chave: chave.trim(), idMaquina: idMaquina() })
  const lic = { token: d.token, ultimaValidacao: new Date().toISOString(), chave: chave.trim().toUpperCase() }
  salvarLicenca(lic)
  return { licenca: lic, versao: d.versao, downloadUrl: d.downloadUrl }
}

// Retorna: { status: 'ok' | 'ativar' | 'bloqueado', licenca?, versao?, downloadUrl?, offline? }
export async function verificarLicenca() {
  const lic = licencaSalva()
  if (!lic) return { status: 'ativar' }

  const dias = (Date.now() - new Date(lic.ultimaValidacao).getTime()) / 864e5

  // Dentro do período de revalidação: libera direto
  if (dias < REVALIDAR_DIAS) return { status: 'ok', licenca: lic }

  // Tenta revalidar com o servidor
  try {
    const d = await chamar('/validar', { token: lic.token })
    const novo = { ...lic, token: d.token, ultimaValidacao: new Date().toISOString() }
    salvarLicenca(novo)
    return { status: 'ok', licenca: novo, versao: d.versao, downloadUrl: d.downloadUrl }
  } catch (e) {
    // Servidor indisponível ou erro de rede: permite uso offline
    if (dias <= TOLERANCIA_DIAS) {
      return { status: 'ok', licenca: lic, offline: true }
    }
    // Passou da tolerância: bloqueia
    return { status: 'bloqueado', erro: e.message, licenca: lic }
  }
}

// Verificação silenciosa para uso offline (sem bloquear o app)
export function verificarLicencaLocal() {
  const lic = licencaSalva()
  if (!lic) return { status: 'ativar' }
  const dias = (Date.now() - new Date(lic.ultimaValidacao).getTime()) / 864e5
  if (dias <= TOLERANCIA_DIAS) return { status: 'ok', licenca: lic }
  return { status: 'expirado', licenca: lic, dias: Math.floor(dias) }
}
