import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import criarRouterContas from './routes/contas.js'
import criarRouterHistorico from './routes/historico.js'
import { recalcularCadeia, atualizarTaxaGlobal, sanitizarDados, hoje } from './calculo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'src', 'data', 'dados.json')

const CONFIG_PADRAO = () => ({
  moeda: 'BRL',
  taxaEfetivaAnual: null,
  taxaEfetivaDiaria: null,
  dataCalculo: null,
  diasCalculo: null
})

const VAZIO = () => ({ contas: [], cofrinhos: [], historico: [], configuracoes: CONFIG_PADRAO() })

export function loadData(file = DATA_FILE) {
  if (!fs.existsSync(file)) return VAZIO()
  try {
    const bruto = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return VAZIO()
    return sanitizarDados({ ...VAZIO(), ...bruto })
  } catch {
    return VAZIO()
  }
}

export function saveData(data, file = DATA_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

const novoId = () => Date.now() + '-' + Math.random().toString(36).slice(2, 7)

export function createApp(dataFile = DATA_FILE) {
  const load = () => loadData(dataFile)
  const save = d => saveData(d, dataFile)

  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(criarRouterContas(dataFile))
  app.use(criarRouterHistorico(dataFile))

  app.get('/api/dados', (req, res) => res.json(load()))

  app.get('/api/historico', (req, res) => {
    const data = load()
    res.json(data.historico || [])
  })

  app.post('/api/atualizar-saldo', (req, res) => {
    const { contaId } = req.body || {}
    const entradas = Number(req.body?.entradas) || 0
    const saidas = Number(req.body?.saidas) || 0
    const brutoSaldo = req.body?.saldoAtual
    const temSaldo = brutoSaldo !== undefined && brutoSaldo !== null && String(brutoSaldo).trim() !== ''

    if (!contaId) return res.status(400).json({ erro: 'Informe a conta' })
    if (!Number.isFinite(entradas) || !Number.isFinite(saidas) || entradas < 0 || saidas < 0) {
      return res.status(400).json({ erro: 'Entradas e saídas não podem ser negativas' })
    }

    const data = load()
    const conta = data.contas.find(c => c.id === contaId)
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada' })

    let saldoAtual
    if (temSaldo) {
      saldoAtual = Number(brutoSaldo)
      if (!Number.isFinite(saldoAtual) || saldoAtual < 0) {
        return res.status(400).json({ erro: 'Saldo atual inválido' })
      }
    } else {
      if (entradas === 0 && saidas === 0) {
        return res.status(400).json({ erro: 'Informe o novo saldo' })
      }
      saldoAtual = Math.round(((Number(conta.saldoAtual) || 0) + entradas - saidas) * 100) / 100
      if (saldoAtual < 0) {
        return res.status(400).json({ erro: 'Saldo resultante negativo — verifique entradas e saídas' })
      }
    }

    if (!data.historico) data.historico = []
    const registro = {
      id: novoId(),
      data: hoje(),
      contaId,
      saldoAnterior: conta.saldoAtual,
      saldoAtual,
      entradas,
      saidas,
      jurosCalculado: 0
    }
    data.historico.push(registro)

    recalcularCadeia(data, contaId)
    const configuracoes = atualizarTaxaGlobal(data)
    save(data)

    res.json({
      conta: data.contas.find(c => c.id === contaId),
      historico: registro,
      configuracoes
    })
  })

  app.get('/api/configuracoes', (req, res) => {
    const data = load()
    res.json(data.configuracoes || {})
  })

  app.put('/api/configuracoes', (req, res) => {
    const data = load()
    data.configuracoes = { ...data.configuracoes, ...req.body }
    save(data)
    res.json(data.configuracoes)
  })

  return app
}

const executadoDireto = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (executadoDireto) {
  const PORT = process.env.PORT || 3002
  createApp().listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`))
}
