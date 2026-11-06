import { useState, useMemo } from 'react'
import { Wallet, PiggyBank, TrendingUp, RefreshCw, ArrowDownLeft, ArrowUpRight, Clock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtBRL, fmtPct, calcularSaldoDisponivel } from '../api.js'
import { ordenarRegistros } from '../../server/calculo.js'

function parseValor(texto) {
  const bruto = String(texto ?? '').trim()
  if (bruto === '') return 0
  const n = parseFloat(bruto.replace(/[^\d.,]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function calcularDiasRestantes(dataPrazo) {
  if (!dataPrazo) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const prazo = new Date(dataPrazo + 'T00:00:00')
  const diff = prazo - hoje
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function corPrazo(dias) {
  if (dias === null) return null
  if (dias > 60) return 'verde'
  if (dias > 30) return 'amarelo'
  if (dias > 7) return 'laranja'
  return 'vermelho'
}

export default function Dashboard({ dados, onChange }) {
  const contas = dados.contas || []
  const cofrinhos = dados.cofrinhos || []
  const historico = dados.historico || []
  const config = dados.configuracoes || {}

  const [contaSelecionada, setContaSelecionada] = useState(contas[0]?.id || '')
  const [novoSaldo, setNovoSaldo] = useState('')
  const [entradas, setEntradas] = useState('')
  const [saidas, setSaidas] = useState('')

  const conta = contas.find(c => c.id === contaSelecionada)

  const historicoFiltrado = useMemo(() => {
    const validos = historico.filter(h => contas.some(c => c.id === h.contaId))
    const escopo = contaSelecionada ? validos.filter(h => h.contaId === contaSelecionada) : validos
    return ordenarRegistros(escopo)
  }, [historico, contas, contaSelecionada])

  const totalCofrinhos = useMemo(() =>
    cofrinhos.reduce((s, c) => s + Number(c.valor), 0),
    [cofrinhos]
  )

  const saldoDisponivel = conta
    ? calcularSaldoDisponivel(conta.saldoAtual, cofrinhos.filter(c => c.contaId === conta.id))
    : 0

  const jurosHoje = useMemo(() => {
    if (historicoFiltrado.length === 0) return 0
    const ultimo = historicoFiltrado[historicoFiltrado.length - 1]
    return ultimo.jurosCalculado || 0
  }, [historicoFiltrado])

  const jurosAcumulado = useMemo(() =>
    historicoFiltrado.reduce((s, h) => s + (h.jurosCalculado || 0), 0),
    [historicoFiltrado]
  )

  const resumoTaxa = useMemo(() => {
    if (historicoFiltrado.length > 0) {
      let fonte = null
      for (let i = historicoFiltrado.length - 1; i >= 0; i--) {
        if (historicoFiltrado[i].taxaEfetivaAnual !== null && historicoFiltrado[i].taxaEfetivaAnual !== undefined) {
          fonte = historicoFiltrado[i]
          break
        }
      }
      const ultimo = historicoFiltrado[historicoFiltrado.length - 1]
      return {
        taxaDiaria: fonte?.taxaEfetivaDiaria ?? null,
        taxaAnual: fonte?.taxaEfetivaAnual ?? null,
        data: fonte?.data ?? ultimo?.data ?? null,
        dias: fonte?.diasCalculo ?? ultimo?.diasCalculo ?? null,
        semDados: false
      }
    }
    if (contaSelecionada) {
      return { taxaDiaria: null, taxaAnual: null, data: null, dias: null, semDados: true }
    }
    return {
      taxaDiaria: config.taxaEfetivaDiaria ?? null,
      taxaAnual: config.taxaEfetivaAnual ?? null,
      data: config.dataCalculo ?? null,
      dias: config.diasCalculo ?? null,
      semDados: !config.dataCalculo
    }
  }, [historicoFiltrado, contaSelecionada, config])

  const previa = useMemo(() => {
    if (!conta) return null
    const e = parseValor(entradas)
    const s = parseValor(saidas)
    if (!Number.isFinite(e) || !Number.isFinite(s) || e < 0 || s < 0) return null
    const base = Number(conta.saldoAtual) || 0
    const temSaldo = String(novoSaldo).trim() !== ''
    let valorFinal = null
    let automatico = false
    if (temSaldo) {
      const v = parseValor(novoSaldo)
      if (!Number.isFinite(v) || v < 0) return null
      valorFinal = v
    } else if (e > 0 || s > 0) {
      valorFinal = Math.round((base + e - s) * 100) / 100
      automatico = true
      if (valorFinal < 0) return null
    } else {
      return null
    }
    const juros = Math.round((valorFinal - base - e + s) * 100) / 100
    return { valorFinal, juros, automatico }
  }, [conta, novoSaldo, entradas, saidas])

  const cofrinhosProximos = useMemo(() => {
    return cofrinhos
      .filter(c => {
        if (!c.dataPrazo) return false
        const dias = calcularDiasRestantes(c.dataPrazo)
        return dias !== null && dias <= 30
      })
      .map(c => ({
        ...c,
        diasRestantes: calcularDiasRestantes(c.dataPrazo),
        cor: corPrazo(calcularDiasRestantes(c.dataPrazo))
      }))
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
  }, [cofrinhos])

  const handleAtualizar = async () => {
    if (!contaSelecionada) {
      toast.error('Selecione uma conta')
      return
    }
    const e = parseValor(entradas)
    const s = parseValor(saidas)
    if (!Number.isFinite(e) || !Number.isFinite(s) || e < 0 || s < 0) {
      toast.error('Entradas e saídas inválidas')
      return
    }

    const temSaldo = String(novoSaldo).trim() !== ''
    let valor
    if (temSaldo) {
      valor = parseValor(novoSaldo)
      if (!Number.isFinite(valor) || valor < 0) {
        toast.error('Digite um valor válido')
        return
      }
    } else if (e > 0 || s > 0) {
      const base = Number(conta?.saldoAtual) || 0
      valor = Math.round((base + e - s) * 100) / 100
      if (valor < 0) {
        toast.error('Saldo resultante negativo — verifique entradas e saídas')
        return
      }
    } else {
      toast.error('Digite o novo saldo')
      return
    }

    try {
      await api.atualizarSaldo({ contaId: contaSelecionada, saldoAtual: valor, entradas: e, saidas: s })
      setNovoSaldo('')
      setEntradas('')
      setSaidas('')
      onChange()
      toast.success('Saldo atualizado com sucesso!')
    } catch (err) {
      toast.error('Erro ao atualizar saldo')
    }
  }

  return (
    <div className="dashboard">
      <div className="cards-principal">
        <div className="card-grande cofrinhos">
          <div className="card-titulo"><PiggyBank size={18} /> Cofrinhos</div>
          <div className="card-valor">{fmtBRL(totalCofrinhos)}</div>
          <div className="card-sub">{cofrinhos.length} cofrinho(s) cadastrado(s)</div>
        </div>
        <div className="card-grande caixa">
          <div className="card-titulo"><Wallet size={18} /> Caixa Livre</div>
          <div className="card-valor">{fmtBRL(saldoDisponivel)}</div>
          <div className="card-sub">Disponível para gastar</div>
        </div>
        <div className="card-grande juros">
          <div className="card-titulo"><TrendingUp size={18} /> Juros</div>
          <div className="card-valor">{fmtBRL(jurosHoje)}</div>
          <div className="card-sub">Acumulado: {fmtBRL(jurosAcumulado)}</div>
          <div className="card-sub" style={{ marginTop: 4 }}>
            Efetiva: {fmtPct(resumoTaxa.taxaDiaria, 4)} ao dia · {fmtPct(resumoTaxa.taxaAnual, 2)} ao ano
          </div>
          <div className="card-sub" style={{ fontSize: 11 }}>
            {!resumoTaxa.data
              ? 'Atualize o saldo para calcular a taxa efetiva'
              : resumoTaxa.dias > 0
                ? `Calculado em ${resumoTaxa.data} · ${resumoTaxa.dias} dia(s) corrido(s)`
                : `Última atualização em ${resumoTaxa.data} — sem taxa neste período`}
          </div>
        </div>
      </div>

      {cofrinhosProximos.length > 0 && (
        <div className="alerta-vencimento">
          <div className="alerta-vencimento-titulo">
            <AlertTriangle size={16} /> Cofrinhos Próximos do Vencimento
          </div>
          {cofrinhosProximos.map(c => (
            <div key={c.id} className="alerta-vencimento-item">
              <span className="alerta-vencimento-nome">{c.nome}</span>
              <span style={{ fontSize: 12, color: 'var(--texto-fraco)' }}>{fmtBRL(c.valor)}</span>
              <span className={`alerta-vencimento-dias ${c.cor}`}>
                {c.diasRestantes > 0
                  ? `${c.diasRestantes} dia(s)`
                  : c.diasRestantes === 0
                    ? 'Vence hoje!'
                    : `Vencido`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="atualizar-saldo">
        <label><ArrowDownLeft size={16} /> Atualizar Saldo Real:</label>
        <select value={contaSelecionada} onChange={e => setContaSelecionada(e.target.value)}>
          <option value="">Selecione uma conta</option>
          {contas.map(c => (
            <option key={c.id} value={c.id}>{c.nome} (Atual: {fmtBRL(c.saldoAtual)})</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Novo saldo (ex: 10.000,00)"
          title="Deixe em branco para o app calcular: saldo atual + entradas − saídas"
          value={novoSaldo}
          onChange={e => setNovoSaldo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAtualizar()}
        />
        <input
          type="text"
          className="secundario"
          placeholder="Entradas no período (ex: 500,00)"
          title="Depósitos e outros créditos desde a última atualização"
          value={entradas}
          onChange={e => setEntradas(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAtualizar()}
        />
        <input
          type="text"
          className="secundario"
          placeholder="Saídas no período (ex: 200,00)"
          title="Saques e outros débitos desde a última atualização"
          value={saidas}
          onChange={e => setSaidas(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAtualizar()}
        />
        <button className="btn-atualizar" onClick={handleAtualizar}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {previa && (
        <div className="previa-atualizacao">
          <span>Novo saldo: <strong>{fmtBRL(previa.valorFinal)}</strong></span>
          <span>
            Juros:{' '}
            <strong className={previa.juros >= 0 ? 'positivo' : 'negativo'}>
              {previa.juros >= 0 ? '+' : ''}{fmtBRL(previa.juros)}
            </strong>
          </span>
          {previa.automatico && (
            <span className="previa-aviso">calculado automaticamente: saldo atual + entradas − saídas</span>
          )}
        </div>
      )}

      {historicoFiltrado.length > 0 && (
        <div className="historico-section">
          <h3><Clock size={16} /> Últimas Atualizações</h3>
          <div className="historico-lista">
            {historicoFiltrado.slice(-5).reverse().map(h => (
              <div key={h.id} className="historico-item">
                <span className="historico-data">{h.data}</span>
                <span className="historico-conta">
                  {contas.find(c => c.id === h.contaId)?.nome || '—'}
                </span>
                <div className="historico-valores">
                  <span className="historico-anterior">{fmtBRL(h.saldoAnterior)}</span>
                  <span>→</span>
                  <span className="historico-atual">{fmtBRL(h.saldoAtual)}</span>
                  <span className={`historico-juros ${h.jurosCalculado >= 0 ? 'positivo' : 'negativo'}`}>
                    {h.jurosCalculado >= 0 ? '+' : ''}{fmtBRL(h.jurosCalculado)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
