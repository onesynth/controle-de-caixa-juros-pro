import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { app } from 'electron'

// URL do servidor de licenças (Render)
export const URL_LICENCAS = process.env.URL_LICENCAS || 'https://controle-caixa-juros-licencas.onrender.com'
const REVALIDAR_DIAS = 7
const TOLERANCIA_DIAS = 30
const TIMEOUT_MS = 40000
const TENTATIVAS = 2

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
  let ultimoErro
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const r = await fetch(`${URL_LICENCAS}${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: controller.signal
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        // Recusa do servidor: marca o status para o chamador diferenciar de falha de rede
        const erro = new Error(d.erro || `Erro ${r.status}`)
        erro.httpStatus = r.status
        throw erro
      }
      return d
    } catch (e) {
      if (e.httpStatus) throw e
      ultimoErro = e
    } finally {
      clearTimeout(timeout)
    }
    // Falha de rede/timeout: tenta de novo uma vez antes de desistir
    if (tentativa < TENTATIVAS) await new Promise(res => setTimeout(res, 1500))
  }
  throw ultimoErro
}

// Só sobrescreve a versão/link quando o servidor veio com ele, para não apagar o que já estava salvo
function copiarAtualizacao(d, destino) {
  if (d?.versao) destino.versao = d.versao
  if (d?.downloadUrl) destino.downloadUrl = d.downloadUrl
  if (d?.downloadUrlPortatil) destino.downloadUrlPortatil = d.downloadUrlPortatil
}

function infoAtualizacao(origem) {
  return { versao: origem?.versao, downloadUrl: origem?.downloadUrl, downloadUrlPortatil: origem?.downloadUrlPortatil }
}

export async function ativar(chave) {
  const d = await chamar('/ativar', { chave: chave.trim(), idMaquina: idMaquina() })
  const lic = { token: d.token, ultimaValidacao: new Date().toISOString(), chave: chave.trim().toUpperCase() }
  copiarAtualizacao(d, lic)
  salvarLicenca(lic)
  return { licenca: lic, ...infoAtualizacao(d) }
}

// Retorna: { status: 'ok' | 'ativar' | 'bloqueado', licenca?, versao?, downloadUrl?, downloadUrlPortatil?, offline? }
export async function verificarLicenca({ forcar = false } = {}) {
  const lic = licencaSalva()
  if (!lic) return { status: 'ativar' }

  const dias = (Date.now() - new Date(lic.ultimaValidacao).getTime()) / 864e5

  // Dentro do período de revalidação: libera direto com a última versão conhecida
  if (!forcar && dias < REVALIDAR_DIAS) return { status: 'ok', licenca: lic, ...infoAtualizacao(lic) }

  // Tenta revalidar com o servidor
  try {
    const d = await chamar('/validar', { token: lic.token })
    const novo = { ...lic, token: d.token, ultimaValidacao: new Date().toISOString() }
    copiarAtualizacao(d, novo)
    salvarLicenca(novo)
    return { status: 'ok', licenca: novo, ...infoAtualizacao(d) }
  } catch (e) {
    // Recusa do servidor (4xx): não é problema de rede — bloqueia com a mensagem real
    if (e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 500) {
      return { status: 'bloqueado', erro: e.message, licenca: lic }
    }
    // Servidor indisponível ou erro de rede: permite uso offline
    if (dias <= TOLERANCIA_DIAS) {
      return { status: 'ok', licenca: lic, offline: true }
    }
    // Passou da tolerância: bloqueia
    return { status: 'bloqueado', erro: e.message, licenca: lic }
  }
}

// Ignora o intervalo de 7 dias e revalida agora (usado pelo menu "Verificar atualização")
export function forcarRevalidacao() {
  return verificarLicenca({ forcar: true })
}

// Tenta reativar a licença com a chave salva localmente (fallback quando /validar falha)
export async function reativarComChaveSalva() {
  const lic = licencaSalva()
  if (!lic?.chave) return { erro: 'Chave de licença não encontrada. Ative novamente.' }
  const r = await ativar(lic.chave)
  return { ok: true, licenca: r.licenca, ...infoAtualizacao(r) }
}

// Verificação silenciosa para uso offline (sem bloquear o app)
export function verificarLicencaLocal() {
  const lic = licencaSalva()
  if (!lic) return { status: 'ativar' }
  const dias = (Date.now() - new Date(lic.ultimaValidacao).getTime()) / 864e5
  if (dias <= TOLERANCIA_DIAS) return { status: 'ok', licenca: lic }
  return { status: 'expirado', licenca: lic, dias: Math.floor(dias) }
}
