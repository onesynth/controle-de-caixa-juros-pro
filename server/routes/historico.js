import { Router } from 'express'
import { loadData, saveData } from '../server.js'
import { recalcularCadeia, atualizarTaxaGlobal } from '../calculo.js'

function lerValor(bruto) {
  if (bruto === undefined) return { ok: true, valor: undefined }
  if (bruto === null || String(bruto).trim() === '') return { ok: true, valor: 0 }
  const n = Number(bruto)
  return { ok: Number.isFinite(n), valor: n }
}

export function criarRouterHistorico(dataFile) {
  const load = () => loadData(dataFile)
  const save = d => saveData(d, dataFile)

  const router = Router()

  router.put('/api/historico/:id', (req, res) => {
    const data = load()
    const registro = (data.historico || []).find(h => h.id === req.params.id)
    if (!registro) return res.status(404).json({ erro: 'Registro não encontrado' })

    const corpo = req.body || {}

    if (corpo.data !== undefined) {
      const dataStr = String(corpo.data)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr) || Number.isNaN(Date.parse(`${dataStr}T00:00:00Z`))) {
        return res.status(400).json({ erro: 'Data inválida. Use o formato AAAA-MM-DD' })
      }
      registro.data = dataStr
    }

    if (corpo.saldoAtual !== undefined) {
      const saldo = Number(corpo.saldoAtual)
      if (!Number.isFinite(saldo) || saldo < 0) {
        return res.status(400).json({ erro: 'Saldo atual inválido' })
      }
      registro.saldoAtual = saldo
    }

    if (corpo.entradas !== undefined) {
      const { ok, valor } = lerValor(corpo.entradas)
      if (!ok || valor < 0) return res.status(400).json({ erro: 'Entradas inválidas' })
      registro.entradas = valor
    }

    if (corpo.saidas !== undefined) {
      const { ok, valor } = lerValor(corpo.saidas)
      if (!ok || valor < 0) return res.status(400).json({ erro: 'Saídas inválidas' })
      registro.saidas = valor
    }

    recalcularCadeia(data, registro.contaId)
    const configuracoes = atualizarTaxaGlobal(data)
    save(data)

    res.json({
      registro: data.historico.find(h => h.id === req.params.id),
      conta: data.contas.find(c => c.id === registro.contaId),
      configuracoes
    })
  })

  router.delete('/api/historico/:id', (req, res) => {
    const data = load()
    const registro = (data.historico || []).find(h => h.id === req.params.id)
    if (!registro) return res.status(404).json({ erro: 'Registro não encontrado' })

    data.historico = (data.historico || []).filter(h => h.id !== req.params.id)
    recalcularCadeia(data, registro.contaId)
    const configuracoes = atualizarTaxaGlobal(data)
    save(data)

    res.json({
      ok: true,
      conta: data.contas.find(c => c.id === registro.contaId),
      configuracoes
    })
  })

  return router
}

export default criarRouterHistorico
