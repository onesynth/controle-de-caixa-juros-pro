import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import contasRouter from './routes/contas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'src', 'data', 'dados.json')

export function loadData(file = DATA_FILE) {
  if (!fs.existsSync(file)) return { contas: [], cofrinhos: [], historico: [], configuracoes: { cdiAtual: 14.15, percentualCDI: 114, moeda: 'BRL' } }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return { contas: [], cofrinhos: [], historico: [], configuracoes: { cdiAtual: 14.15, percentualCDI: 114, moeda: 'BRL' } }
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
  app.use(contasRouter)

  app.get('/api/dados', (req, res) => res.json(load()))

  app.get('/api/historico', (req, res) => {
    const data = load()
    res.json(data.historico || [])
  })

  app.post('/api/atualizar-saldo', (req, res) => {
    const { contaId, saldoAtual } = req.body
    const data = load()
    const conta = data.contas.find(c => c.id === contaId)
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada' })

    const saldoAnterior = conta.saldoAtual
    const entradas = 0
    const saidas = 0
    const jurosCalculado = saldoAtual - saldoAnterior - entradas + saidas

    const registro = {
      id: novoId(),
      data: new Date().toISOString().slice(0, 10),
      contaId,
      saldoAnterior,
      saldoAtual,
      entradas,
      saidas,
      jurosCalculado
    }

    conta.saldoAtual = saldoAtual
    conta.dataAtualizacao = new Date().toISOString().slice(0, 10)

    if (!data.historico) data.historico = []
    data.historico.push(registro)

    save(data)
    res.json({ conta, historico: registro })
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
