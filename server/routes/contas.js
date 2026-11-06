import { Router } from 'express'
import { loadData, saveData } from '../server.js'
import { hoje, sanitizarDados } from '../calculo.js'

const novoId = () => Date.now() + '-' + Math.random().toString(36).slice(2, 7)

function dataValida(texto) {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(`${texto}T00:00:00Z`))
}

export function criarRouterContas(dataFile) {
  const load = () => loadData(dataFile)
  const save = d => saveData(d, dataFile)

  const router = Router()

  router.get('/api/contas', (req, res) => {
    const data = load()
    res.json(data.contas || [])
  })

  router.post('/api/contas', (req, res) => {
    const data = load()
    const corpo = req.body || {}
    const nome = String(corpo.nome || '').trim()
    if (!nome) return res.status(400).json({ erro: 'Informe o nome da conta' })

    const saldoInicial = corpo.saldoInicial === undefined || corpo.saldoInicial === null || String(corpo.saldoInicial).trim() === ''
      ? 0
      : Number(corpo.saldoInicial)
    if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
      return res.status(400).json({ erro: 'Saldo inicial inválido' })
    }

    const dataBase = corpo.dataBase ? String(corpo.dataBase) : hoje()
    if (!dataValida(dataBase)) {
      return res.status(400).json({ erro: 'Data inicial inválida. Use o formato AAAA-MM-DD' })
    }

    const conta = {
      id: novoId(),
      nome,
      saldoAtual: saldoInicial,
      dataAtualizacao: dataBase,
      saldoBase: saldoInicial,
      dataBase
    }
    if (!data.contas) data.contas = []
    data.contas.push(conta)
    save(data)
    res.json(conta)
  })

  router.put('/api/contas/:id', (req, res) => {
    const data = load()
    const i = (data.contas || []).findIndex(c => c.id === req.params.id)
    if (i === -1) return res.status(404).json({ erro: 'Conta não encontrada' })
    const { saldoAtual, dataAtualizacao, saldoBase, dataBase, ...resto } = req.body || {}
    if (resto.nome !== undefined && !String(resto.nome).trim()) {
      return res.status(400).json({ erro: 'Informe o nome da conta' })
    }
    if (resto.nome !== undefined) resto.nome = String(resto.nome).trim()
    data.contas[i] = { ...data.contas[i], ...resto }
    save(data)
    res.json(data.contas[i])
  })

  router.delete('/api/contas/:id', (req, res) => {
    const data = load()
    data.contas = (data.contas || []).filter(c => c.id !== req.params.id)
    sanitizarDados(data)
    save(data)
    res.json({ ok: true })
  })

  router.get('/api/cofrinhos', (req, res) => {
    const data = load()
    res.json(data.cofrinhos || [])
  })

  router.post('/api/cofrinhos', (req, res) => {
    const data = load()
    const cofrinho = { id: novoId(), valor: 0, dataCriacao: hoje(), ...req.body }
    if (!data.cofrinhos) data.cofrinhos = []
    data.cofrinhos.push(cofrinho)
    save(data)
    res.json(cofrinho)
  })

  router.put('/api/cofrinhos/:id', (req, res) => {
    const data = load()
    const i = (data.cofrinhos || []).findIndex(c => c.id === req.params.id)
    if (i === -1) return res.status(404).json({ erro: 'Cofrinho não encontrado' })
    data.cofrinhos[i] = { ...data.cofrinhos[i], ...req.body }
    save(data)
    res.json(data.cofrinhos[i])
  })

  router.delete('/api/cofrinhos/:id', (req, res) => {
    const data = load()
    data.cofrinhos = (data.cofrinhos || []).filter(c => c.id !== req.params.id)
    save(data)
    res.json({ ok: true })
  })

  return router
}

export default criarRouterContas
