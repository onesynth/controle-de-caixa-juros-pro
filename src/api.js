const API = ''

export async function fetchJSON(url, opts) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  })
  if (!r.ok) throw new Error(`Erro ${r.status}`)
  return r.json()
}

export const api = {
  dados: () => fetchJSON(`${API}/api/dados`),
  contas: () => fetchJSON(`${API}/api/contas`),
  addConta: c => fetchJSON(`${API}/api/contas`, { method: 'POST', body: JSON.stringify(c) }),
  editConta: (id, c) => fetchJSON(`${API}/api/contas/${id}`, { method: 'PUT', body: JSON.stringify(c) }),
  delConta: id => fetchJSON(`${API}/api/contas/${id}`, { method: 'DELETE' }),

  cofrinhos: () => fetchJSON(`${API}/api/cofrinhos`),
  addCofrinho: c => fetchJSON(`${API}/api/cofrinhos`, { method: 'POST', body: JSON.stringify(c) }),
  editCofrinho: (id, c) => fetchJSON(`${API}/api/cofrinhos/${id}`, { method: 'PUT', body: JSON.stringify(c) }),
  delCofrinho: id => fetchJSON(`${API}/api/cofrinhos/${id}`, { method: 'DELETE' }),

  atualizarSaldo: dados => fetchJSON(`${API}/api/atualizar-saldo`, { method: 'POST', body: JSON.stringify(dados) }),
  historico: () => fetchJSON(`${API}/api/historico`),

  configuracoes: () => fetchJSON(`${API}/api/configuracoes`),
  salvarConfig: c => fetchJSON(`${API}/api/configuracoes`, { method: 'PUT', body: JSON.stringify(c) }),
}

export const fmtBRL = v => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function calcularJurosRetroativo(saldoAnterior, saldoAtual, entradas, saidas) {
  return saldoAtual - saldoAnterior - entradas + saidas
}

export function calcularSaldoDisponivel(saldoAtual, cofrinhos) {
  const totalCofrinhos = cofrinhos.reduce((s, c) => s + Number(c.valor), 0)
  return saldoAtual - totalCofrinhos
}
