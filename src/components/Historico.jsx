import { useState, useMemo } from 'react'
import { Clock, Calendar, TrendingUp, Hash, ChevronLeft, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api, fmtBRL } from '../api.js'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

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

export default function Historico({ dados }) {
  const historico = dados.historico || []
  const contas = dados.contas || []

  const historicoFiltrado = useMemo(() =>
    historico.filter(h => contas.some(c => c.id === h.contaId)),
    [historico, contas]
  )

  const hoje = new Date()
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth())
  const [anoSelecionado, setAnoselecionado] = useState(hoje.getFullYear())

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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
