const DIA_MS = 1000 * 60 * 60 * 24

export function diasCorridos(dataAnterior, dataNova) {
  if (!dataAnterior || !dataNova) return null
  const a = Date.parse(`${String(dataAnterior).slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${String(dataNova).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / DIA_MS)
}

export function calcularTaxas({
  saldoAnterior,
  saldoAtual,
  entradas = 0,
  saidas = 0,
  dataAnterior,
  dataNova
}) {
  const anterior = Number(saldoAnterior) || 0
  const atual = Number(saldoAtual) || 0
  const entrada = Number(entradas) || 0
  const saida = Number(saidas) || 0

  const juros = atual - anterior - entrada + saida
  const diasCalculo = diasCorridos(dataAnterior, dataNova)
  const retorno = anterior > 0 ? juros / anterior : null
  const podeCalcular =
    diasCalculo !== null && diasCalculo >= 1 && retorno !== null && 1 + retorno >= 0

  return {
    juros,
    diasCalculo,
    taxaEfetivaAnual: podeCalcular ? (Math.pow(1 + retorno, 365 / diasCalculo) - 1) * 100 : null,
    taxaEfetivaDiaria: podeCalcular ? (Math.pow(1 + retorno, 1 / diasCalculo) - 1) * 100 : null
  }
}

export function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ordenarRegistros(registros) {
  return registros
    .map((registro, indice) => ({ registro, indice }))
    .sort((a, b) => {
      const dataA = String(a.registro.data || '')
      const dataB = String(b.registro.data || '')
      return dataA !== dataB ? dataA.localeCompare(dataB) : a.indice - b.indice
    })
    .map(x => x.registro)
}

export function registrosDaConta(data, contaId) {
  const todos = (data.historico || []).filter(h => h.contaId === contaId)
  return ordenarRegistros(todos)
}

export function recalcularCadeia(data, contaId) {
  const conta = (data.contas || []).find(c => c.id === contaId)
  if (!conta) return null

  const registros = registrosDaConta(data, contaId)
  const primeiro = registros[0]

  if (!primeiro) {
    const saldo = Number(conta.saldoAtual)
    if (Number.isFinite(saldo) && saldo > 0) {
      conta.saldoBase = saldo
      if (!conta.dataBase) conta.dataBase = conta.dataAtualizacao || hoje()
    } else {
      conta.saldoAtual = Number(conta.saldoBase) || 0
    }
    return conta
  }

  let saldoCorrente = Number(conta.saldoBase) || 0
  if (!(saldoCorrente > 0)) {
    saldoCorrente = Number(primeiro.saldoAnterior) || Number(conta.saldoAtual) || 0
    if (saldoCorrente > 0) conta.saldoBase = saldoCorrente
  }
  let dataCorrente =
    conta.dataBase ??
    (primeiro && conta.dataAtualizacao && conta.dataAtualizacao < primeiro.data
      ? conta.dataAtualizacao
      : primeiro?.data) ??
    conta.dataAtualizacao ??
    null

  for (const r of registros) {
    r.saldoAnterior = saldoCorrente
    const t = calcularTaxas({
      saldoAnterior: saldoCorrente,
      saldoAtual: r.saldoAtual,
      entradas: r.entradas,
      saidas: r.saidas,
      dataAnterior: dataCorrente,
      dataNova: r.data
    })
    r.jurosCalculado = t.juros
    r.diasCalculo = t.diasCalculo
    r.taxaEfetivaAnual = t.taxaEfetivaAnual
    r.taxaEfetivaDiaria = t.taxaEfetivaDiaria
    saldoCorrente = r.saldoAtual
    dataCorrente = r.data
  }

  conta.saldoAtual = saldoCorrente
  if (dataCorrente) conta.dataAtualizacao = dataCorrente
  return conta
}

export function atualizarTaxaGlobal(data) {
  const ids = new Set((data.contas || []).map(c => c.id))
  const todos = ordenarRegistros((data.historico || []).filter(h => ids.has(h.contaId)))
  const ultimo = todos[todos.length - 1] || null
  let fonte = null
  for (let i = todos.length - 1; i >= 0; i--) {
    if (todos[i].taxaEfetivaAnual !== null && todos[i].taxaEfetivaAnual !== undefined) {
      fonte = todos[i]
      break
    }
  }

  const config = { ...(data.configuracoes || {}) }
  config.taxaEfetivaAnual = fonte?.taxaEfetivaAnual ?? null
  config.taxaEfetivaDiaria = fonte?.taxaEfetivaDiaria ?? null
  config.dataCalculo = fonte?.data ?? ultimo?.data ?? null
  config.diasCalculo = fonte?.diasCalculo ?? ultimo?.diasCalculo ?? null
  data.configuracoes = config
  return config
}

export function sanitizarDados(data) {
  if (!data || typeof data !== 'object') return data

  const contas = Array.isArray(data.contas) ? data.contas : []
  const ids = new Set(contas.map(c => c.id))
  data.contas = contas
  data.cofrinhos = (Array.isArray(data.cofrinhos) ? data.cofrinhos : [])
    .filter(c => c.contaId == null || ids.has(c.contaId))
  data.historico = (Array.isArray(data.historico) ? data.historico : []).filter(h => ids.has(h.contaId))

  for (const h of data.historico) {
    h.saldoAtual = Number(h.saldoAtual) || 0
    h.entradas = Number(h.entradas) || 0
    h.saidas = Number(h.saidas) || 0
  }

  for (const conta of contas) recalcularCadeia(data, conta.id)
  atualizarTaxaGlobal(data)
  return data
}

export function taxaDoMes(registros) {
  const ordenados = ordenarRegistros(registros)
  if (ordenados.length === 0) return null

  const primeiroPorConta = new Map()
  for (const r of ordenados) {
    if (!primeiroPorConta.has(r.contaId)) primeiroPorConta.set(r.contaId, r)
  }

  let jurosMes = 0
  for (const r of ordenados) jurosMes += Number(r.jurosCalculado) || 0

  let saldoInicialMes = 0
  for (const r of primeiroPorConta.values()) saldoInicialMes += Number(r.saldoAnterior) || 0

  if (saldoInicialMes <= 0) return null
  return (jurosMes / saldoInicialMes) * 100
}
