import { Router } from 'express'
import { loadData, saveData } from '../server.js'

const router = Router()
const novoId = () => Date.now() + '-' + Math.random().toString(36).slice(2, 7)

router.get('/api/contas', (req, res) => {
  const data = loadData()
  res.json(data.contas || [])
})

router.post('/api/contas', (req, res) => {
  const data = loadData()
  const conta = { id: novoId(), saldoAtual: 0, dataAtualizacao: new Date().toISOString().slice(0, 10), ...req.body }
  if (!data.contas) data.contas = []
  data.contas.push(conta)
  saveData(data)
  res.json(conta)
})

router.put('/api/contas/:id', (req, res) => {
  const data = loadData()
  const i = (data.contas || []).findIndex(c => c.id === req.params.id)
  if (i === -1) return res.status(404).json({ erro: 'Conta não encontrada' })
  data.contas[i] = { ...data.contas[i], ...req.body }
  saveData(data)
  res.json(data.contas[i])
})

router.delete('/api/contas/:id', (req, res) => {
  const data = loadData()
  data.contas = (data.contas || []).filter(c => c.id !== req.params.id)
  data.cofrinhos = (data.cofrinhos || []).filter(c => c.contaId !== req.params.id)
  data.historico = (data.historico || []).filter(h => h.contaId !== req.params.id)
  saveData(data)
  res.json({ ok: true })
})

router.get('/api/cofrinhos', (req, res) => {
  const data = loadData()
  res.json(data.cofrinhos || [])
})

router.post('/api/cofrinhos', (req, res) => {
  const data = loadData()
  const cofrinho = { id: novoId(), valor: 0, dataCriacao: new Date().toISOString().slice(0, 10), ...req.body }
  if (!data.cofrinhos) data.cofrinhos = []
  data.cofrinhos.push(cofrinho)
  saveData(data)
  res.json(cofrinho)
})

router.put('/api/cofrinhos/:id', (req, res) => {
  const data = loadData()
  const i = (data.cofrinhos || []).findIndex(c => c.id === req.params.id)
  if (i === -1) return res.status(404).json({ erro: 'Cofrinho não encontrado' })
  data.cofrinhos[i] = { ...data.cofrinhos[i], ...req.body }
  saveData(data)
  res.json(data.cofrinhos[i])
})

router.delete('/api/cofrinhos/:id', (req, res) => {
  const data = loadData()
  data.cofrinhos = (data.cofrinhos || []).filter(c => c.id !== req.params.id)
  saveData(data)
  res.json({ ok: true })
})

export default router
