import { useState, useMemo } from 'react'
import { Clock, Calendar, TrendingUp, Hash, ChevronLeft, ChevronRight, Percent, Pencil, Trash2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import toast from 'react-hot-toast'
import { api, fmtBRL, fmtPct } from '../api.js'
import { taxaDoMes } from '../../server/calculo.js'
import ConfirmDialog from './ConfirmDialog.jsx'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const FORM_VAZIO = { data: '', saldoAtual: '', entradas: '', saidas: '' }

function parseValor(texto) {
  const bruto = String(texto ?? '').trim()
  if (bruto === '') return 0
  const n = parseFloat(bruto.replace(/[^\d.,]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function agruparPorDia(historico) {
  const mapa = {}
  for (const h of historico) {
    const dia = h.data.slice(8, 10)
    if (!mapa[dia]) mapa[dia] = { dia, total: 0, registros: 0 }
    mapa[dia].total += h.jurosCalculado || 0
    mapa[dia].registros++
  }
  return Object.values(mapa).sort((a, b) => a.dia.localeCompare(b.dia))
}

function agruparPorMes(historico) {
  const mapa = {}
  for (const h of historico) {
    const chave = h.data.slice(0, 7)
    if (!mapa[chave]) mapa[chave] = { mes: chave, total: 0, registros: 0 }
    mapa[chave].total += h.jurosCalculado || 0
    mapa[chave].registros++
  }
  return Object.values(mapa).sort((a, b) => a.mes.localeCompare(b.mes))
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="tooltip-grafico">
      <div className="tt-valor">{fmtBRL(payload[0].value)}</div>
    </div>
  )
}

export default function Historico({ dados, onChange }) {
  const historico = dados.historico || []
  const contas = dados.contas || []

  const historicoFiltrado = useMemo(() =>
    historico.filter(h => contas.some(c => c.id === h.contaId)),
    [historico, contas]
  )

  const hoje = new Date()
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth())
  const [anoSelecionado, setAnoselecionado] = useState(hoje.getFullYear())
  const [editando, setEditando] = useState(null)
  const [formRegistro, setFormRegistro] = useState(FORM_VAZIO)
  const [confirmar, setConfirmar] = useState(null)

  const historicoMes = useMemo(() => {
    const prefix = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, '0')}`
    return historicoFiltrado.filter(h => h.data && h.data.startsWith(prefix))
  }, [historicoFiltrado, mesSelecionado, anoSelecionado])

  const historicoAno = useMemo(() => {
    return historicoFiltrado.filter(h => h.data && h.data.startsWith(String(anoSelecionado)))
  }, [historicoFiltrado, anoSelecionado])

  const jurosMes = useMemo(() =>
    historicoMes.reduce((s, h) => s + (h.jurosCalculado || 0), 0),
    [historicoMes]
  )

  const jurosAno = useMemo(() =>
    historicoAno.reduce((s, h) => s + (h.jurosCalculado || 0), 0),
    [historicoAno]
  )

  const taxaMes = useMemo(() => taxaDoMes(historicoMes), [historicoMes])

  const dadosGrafico = useMemo(() => agruparPorDia(historicoMes), [historicoMes])

  const dadosGraficoAnual = useMemo(() => {
    const meses = agruparPorMes(historicoAno)
    return MESES.map((nome, i) => {
      const chave = `${anoSelecionado}-${String(i + 1).padStart(2, '0')}`
      const encontrado = meses.find(m => m.mes === chave)
      return { nome: nome.slice(0, 3), total: encontrado ? encontrado.total : 0 }
    })
  }, [historicoAno, anoSelecionado])

  const navigateMes = (delta) => {
    let m = mesSelecionado + delta
    let a = anoSelecionado
    if (m < 0) { m = 11; a-- }
    if (m > 11) { m = 0; a++ }
    setMesSelecionado(m)
    setAnoselecionado(a)
  }

  const abrirEditar = (h) => {
    setFormRegistro({
      data: h.data || '',
      saldoAtual: String(h.saldoAtual ?? ''),
      entradas: String(h.entradas ?? 0),
      saidas: String(h.saidas ?? 0)
    })
    setEditando(h)
  }

  const fecharEditar = () => {
    setEditando(null)
    setFormRegistro(FORM_VAZIO)
  }

  const salvarEdicao = async () => {
    const data = String(formRegistro.data || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      toast.error('Informe uma data válida')
      return
    }
    const saldoAtual = parseValor(formRegistro.saldoAtual)
    if (!Number.isFinite(saldoAtual)) {
      toast.error('Digite um saldo válido')
      return
    }
    if (saldoAtual < 0) {
      toast.error('Saldo não pode ser negativo')
      return
    }
    const entradas = parseValor(formRegistro.entradas)
    const saidas = parseValor(formRegistro.saidas)
    if (!Number.isFinite(entradas) || !Number.isFinite(saidas)) {
      toast.error('Entradas e saídas inválidas')
      return
    }
    if (entradas < 0 || saidas < 0) {
      toast.error('Entradas e saídas não podem ser negativas')
      return
    }

    try {
      await api.editHistorico(editando.id, { data, saldoAtual, entradas, saidas })
      toast.success('Lançamento corrigido. Cadeia recalculada.')
      fecharEditar()
      onChange()
    } catch (e) {
      toast.error('Erro ao corrigir lançamento')
    }
  }

  const pedirExcluir = (h) => {
    const conta = contas.find(c => c.id === h.contaId)?.nome || 'esta conta'
    setConfirmar({
      titulo: 'Excluir lançamento?',
      mensagem: `O registro de ${String(h.data).split('-').reverse().join('/')} será removido de "${conta}". `
        + 'Como é um lançamento do meio da cadeia, o saldo anterior do registro seguinte será recalculado '
        + 'e os dois saldos podem se fundir. Use "Corrigir lançamento" se quiser apenas ajustar os valores.',
      acao: async () => {
        try {
          await api.delHistorico(h.id)
          toast.success('Lançamento excluído.')
          onChange()
        } catch (e) {
          toast.error('Erro ao excluir lançamento')
        }
      }
    })
  }

  return (
    <div className="historico-pagina">
      <div className="cofrinhos-header">
        <h3><Clock size={20} /> Histórico de Juros</h3>
        <div className="historico-filtro-periodo">
          <button onClick={() => navigateMes(-1)}><ChevronLeft size={16} /></button>
          <span className="historico-periodo-label">{MESES[mesSelecionado]} {anoSelecionado}</span>
          <button onClick={() => navigateMes(1)}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="historico-cards-resumo">
        <div className="historico-card">
          <div className="historico-card-titulo"><TrendingUp size={14} /> Juros do Mês</div>
          <div className={`historico-card-valor ${jurosMes >= 0 ? 'positivo' : 'negativo'}`}>{fmtBRL(jurosMes)}</div>
        </div>
        <div className="historico-card">
          <div className="historico-card-titulo"><Percent size={14} /> Taxa do Mês</div>
          <div className={`historico-card-valor ${taxaMes === null ? '' : taxaMes >= 0 ? 'positivo' : 'negativo'}`}>
            {taxaMes === null ? '—' : fmtPct(taxaMes, 2)}
          </div>
        </div>
        <div className="historico-card">
          <div className="historico-card-titulo"><Calendar size={14} /> Juros do Ano</div>
          <div className={`historico-card-valor ${jurosAno >= 0 ? 'positivo' : 'negativo'}`}>{fmtBRL(jurosAno)}</div>
        </div>
        <div className="historico-card">
          <div className="historico-card-titulo"><Hash size={14} /> Registros no Mês</div>
          <div className="historico-card-valor">{historicoMes.length}</div>
        </div>
      </div>

      {dadosGrafico.length > 0 && (
        <div className="historico-grafico-section">
          <h4>Juros por Dia — {MESES[mesSelecionado]} {anoSelecionado}</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dadosGrafico}>
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {dadosGrafico.map((entry, i) => (
                  <Cell key={i} fill={entry.total >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {historicoMes.length === 0 ? (
        <div className="historico-vazio">
          Nenhum registro de juros em {MESES[mesSelecionado]} de {anoSelecionado}.
        </div>
      ) : (
        <div className="historico-section">
          <h4>Registros de {MESES[mesSelecionado]} {anoSelecionado}</h4>
          <div className="historico-lista">
            {historicoMes.slice().reverse().map(h => (
              <div key={h.id} className="historico-item">
                <span className="historico-data">{h.data.slice(8, 10)}/{h.data.slice(5, 7)}</span>
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
                <div className="historico-acoes">
                  <button className="btn-icone" title="Corrigir lançamento" onClick={() => abrirEditar(h)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn-icone perigo" title="Excluir lançamento" onClick={() => pedirExcluir(h)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editando && (
        <div className="form-modal-overlay" onClick={fecharEditar}>
          <div className="form-modal" onClick={e => e.stopPropagation()}>
            <h4>Corrigir Lançamento</h4>
            <p style={{ fontSize: 12, color: 'var(--texto-fraco)', marginTop: -4, marginBottom: 14 }}>
              {contas.find(c => c.id === editando.contaId)?.nome || '—'} · saldo anterior{' '}
              {fmtBRL(editando.saldoAnterior)} (calculado automaticamente)
            </p>

            <div className="form-campo">
              <label>Data</label>
              <input
                type="date"
                value={formRegistro.data}
                onChange={e => setFormRegistro({ ...formRegistro, data: e.target.value })}
              />
            </div>
            <div className="form-campo">
              <label>Saldo Atual</label>
              <input
                type="text"
                placeholder="Ex: 10.050,00"
                value={formRegistro.saldoAtual}
                onChange={e => setFormRegistro({ ...formRegistro, saldoAtual: e.target.value })}
              />
            </div>
            <div className="form-campo">
              <label>Entradas no período</label>
              <input
                type="text"
                placeholder="Ex: 500,00"
                value={formRegistro.entradas}
                onChange={e => setFormRegistro({ ...formRegistro, entradas: e.target.value })}
              />
            </div>
            <div className="form-campo">
              <label>Saídas no período</label>
              <input
                type="text"
                placeholder="Ex: 200,00"
                value={formRegistro.saidas}
                onChange={e => setFormRegistro({ ...formRegistro, saidas: e.target.value })}
              />
            </div>

            <div className="form-botoes">
              <button className="btn-cancelar" onClick={fecharEditar}>Cancelar</button>
              <button className="btn-salvar" onClick={salvarEdicao}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        aberto={!!confirmar}
        titulo={confirmar?.titulo}
        mensagem={confirmar?.mensagem}
        onCancelar={() => setConfirmar(null)}
        onConfirmar={() => { const a = confirmar?.acao; setConfirmar(null); a?.() }}
      />
    </div>
  )
}
