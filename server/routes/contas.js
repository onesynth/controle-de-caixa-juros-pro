import { Router } from 'express'
import { loadData, saveData } from '../server.js'

const novoId = () => Date.now() + '-' + Math.random().toString(36).slice(2, 7)

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
    const agora = new Date().toISOString().slice(0, 10)
    const { saldoBase, dataBase, ...resto } = req.body || {}
    const saldoInicial = Number(resto.saldoAtual) || 0
    const conta = {
      id: novoId(),
      ...resto,
      saldoAtual: saldoInicial,
      dataAtualizacao: agora,
      saldoBase: saldoInicial,
      dataBase: agora
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
    data.contas[i] = { ...data.contas[i], ...resto }
    save(data)
    res.json(data.contas[i])
  })

  router.delete('/api/contas/:id', (req, res) => {
    const data = load()
    data.contas = (data.contas || []).filter(c => c.id !== req.params.id)
    data.cofrinhos = (data.cofrinhos || []).filter(c => c.contaId !== req.params.id)
    data.historico = (data.historico || []).filter(h => h.contaId !== req.params.id)
    save(data)
    res.json({ ok: true })
  })

  router.get('/api/cofrinhos', (req, res) => {
    const data = load()
    res.json(data.cofrinhos || [])
  })

  router.post('/api/cofrinhos', (req, res) => {
    const data = load()
    const cofrinho = { id: novoId(), valor: 0, dataCriacao: new Date().toISOString().slice(0, 10), ...req.body }
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
