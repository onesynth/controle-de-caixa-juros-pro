import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import criarRouterContas from './routes/contas.js'
import criarRouterHistorico from './routes/historico.js'
import { recalcularCadeia, atualizarTaxaGlobal } from './calculo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'src', 'data', 'dados.json')

const CONFIG_PADRAO = () => ({
  moeda: 'BRL',
  taxaEfetivaAnual: null,
  taxaEfetivaDiaria: null,
  dataCalculo: null,
  diasCalculo: null
})

export function loadData(file = DATA_FILE) {
  if (!fs.existsSync(file)) return { contas: [], cofrinhos: [], historico: [], configuracoes: CONFIG_PADRAO() }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return { contas: [], cofrinhos: [], historico: [], configuracoes: CONFIG_PADRAO() }
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
    const saldoAtual = Number(req.body?.saldoAtual)
    const entradas = Number(req.body?.entradas) || 0
    const saidas = Number(req.body?.saidas) || 0

    if (!contaId) return res.status(400).json({ erro: 'Informe a conta' })
    if (!Number.isFinite(saldoAtual) || saldoAtual < 0) {
      return res.status(400).json({ erro: 'Saldo atual inválido' })
    }
    if (entradas < 0 || saidas < 0) {
      return res.status(400).json({ erro: 'Entradas e saídas não podem ser negativas' })
    }

    const data = load()
    const conta = data.contas.find(c => c.id === contaId)
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada' })

    if (!data.historico) data.historico = []
    const registro = {
      id: novoId(),
      data: new Date().toISOString().slice(0, 10),
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
