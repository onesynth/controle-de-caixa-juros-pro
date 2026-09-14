import { useState, useMemo } from 'react'
import { Wallet, PiggyBank, TrendingUp, RefreshCw, ArrowDownLeft, ArrowUpRight, Clock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtBRL, calcularSaldoDisponivel } from '../api.js'

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

  const historicoFiltrado = useMemo(() =>
    historico.filter(h => contas.some(c => c.id === h.contaId)),
    [historico, contas]
  )

  const [contaSelecionada, setContaSelecionada] = useState(contas[0]?.id || '')
  const [novoSaldo, setNovoSaldo] = useState('')

  const conta = contas.find(c => c.id === contaSelecionada)

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
    const valor = parseFloat(novoSaldo.replace(/[^\d.,]/g, '').replace(',', '.'))
    if (isNaN(valor) || valor < 0) {
      toast.error('Digite um valor válido')
      return
    }
    try {
      await api.atualizarSaldo({ contaId: contaSelecionada, saldoAtual: valor })
      setNovoSaldo('')
      onChange()
      toast.success('Saldo atualizado com sucesso!')
    } catch (e) {
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
          value={novoSaldo}
          onChange={e => setNovoSaldo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAtualizar()}
        />
        <button className="btn-atualizar" onClick={handleAtualizar}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

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
