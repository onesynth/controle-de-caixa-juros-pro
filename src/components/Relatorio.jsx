import { useState, useMemo } from 'react'
import { FileText, Download, ChevronLeft, ChevronRight, TrendingUp, Calendar, Award } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api, fmtBRL } from '../api.js'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="tooltip-grafico">
      <div className="tt-nome">{label}</div>
      <div className="tt-valor">{fmtBRL(payload[0].value)}</div>
    </div>
  )
}

export default function Relatorio({ dados }) {
  const historico = dados.historico || []
  const contas = dados.contas || []

  const historicoFiltrado = useMemo(() =>
    historico.filter(h => contas.some(c => c.id === h.contaId)),
    [historico, contas]
  )

  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())

  const historicoAno = useMemo(() => {
    return historicoFiltrado.filter(h => h.data && h.data.startsWith(String(anoSelecionado)))
  }, [historicoFiltrado, anoSelecionado])

  const dadosMensais = useMemo(() => {
    const meses = []
    for (let i = 0; i < 12; i++) {
      const chave = `${anoSelecionado}-${String(i + 1).padStart(2, '0')}`
      const registros = historicoAno.filter(h => h.data.startsWith(chave))
      const total = registros.reduce((s, h) => s + (h.jurosCalculado || 0), 0)
      meses.push({
        mes: i,
        nome: MESES[i].slice(0, 3),
        nomeCompleto: MESES[i],
        total,
        registros: registros.length,
        positivo: total >= 0
      })
    }
    return meses
  }, [historicoAno, anoSelecionado])

  const resumoAnual = useMemo(() => {
    const total = dadosMensais.reduce((s, m) => s + m.total, 0)
    const comRegistros = dadosMensais.filter(m => m.registros > 0)
    const media = comRegistros.length > 0 ? total / comRegistros.length : 0
    const melhorMes = dadosMensais.reduce((melhor, m) => m.total > melhor.total ? m : melhor, { total: -Infinity })
    const piorMes = dadosMensais.reduce((pior, m) => m.total < pior.total ? m : pior, { total: Infinity })
    return { total, media, melhorMes, piorMes, mesesComRegistros: comRegistros.length }
  }, [dadosMensais])

  const exportarCSV = () => {
    const linhas = ['Mês,Juros,Registros']
    dadosMensais.forEach(m => {
      linhas.push(`${m.nomeCompleto},${m.total.toFixed(2)},${m.registros}`)
    })
    linhas.push('')
    linhas.push(`Total Anual,${resumoAnual.total.toFixed(2)},${historicoAno.length}`)
    linhas.push(`Média Mensal,${resumoAnual.media.toFixed(2)},`)

    const csv = linhas.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio-juros-${anoSelecionado}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    api.dados && api.dados()
  }

  const exportarPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(18)
    doc.setFont(undefined, 'bold')
    doc.text('Relatorio de Juros', pageWidth / 2, 20, { align: 'center' })

    doc.setFontSize(11)
    doc.setFont(undefined, 'normal')
    doc.text('Controle de Caixa & Juros Pro', pageWidth / 2, 28, { align: 'center' })
    doc.text(`Ano: ${anoSelecionado}`, pageWidth / 2, 35, { align: 'center' })

    doc.setDrawColor(108, 60, 224)
    doc.setLineWidth(0.5)
    doc.line(20, 40, pageWidth - 20, 40)

    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text('Resumo Anual', 20, 50)

    doc.setFont(undefined, 'normal')
    doc.setFontSize(11)
    doc.text(`Total Anual: ${fmtBRL(resumoAnual.total)}`, 20, 58)
    doc.text(`Media Mensal: ${fmtBRL(resumoAnual.media)}`, 20, 65)
    doc.text(`Melhor Mes: ${resumoAnual.melhorMes.total > -Infinity ? `${resumoAnual.melhorMes.nomeCompleto} (${fmtBRL(resumoAnual.melhorMes.total)})` : '—'}`, 20, 72)
    doc.text(`Meses com registros: ${resumoAnual.mesesComRegistros}`, 20, 79)
    doc.text(`Total de registros: ${historicoAno.length}`, 20, 86)

    const tableData = dadosMensais
      .filter(m => m.registros > 0)
      .map(m => [
        m.nomeCompleto,
        fmtBRL(m.total),
        String(m.registros),
        m.positivo ? 'Lucro' : 'Perda'
      ])

    if (tableData.length > 0) {
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text('Detalhamento Mensal', 20, 98)

      autoTable(doc, {
        startY: 103,
        head: [['Mes', 'Juros', 'Registros', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [108, 60, 224], fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 40, halign: 'right' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: 20, right: 20 }
      })
    }

    const dateStr = new Date().toLocaleDateString('pt-BR')
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Gerado em: ${dateStr}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })

    doc.save(`relatorio-juros-${anoSelecionado}.pdf`)
  }

  const dadosGrafico = dadosMensais.map(m => ({
    nome: m.nome,
    total: m.total,
    positivo: m.positivo
  }))

  return (
    <div className="relatorio-pagina">
      <div className="cofrinhos-header">
        <h3><FileText size={20} /> Relatórios</h3>
        <div className="historico-filtro-periodo">
          <button onClick={() => setAnoSelecionado(a => a - 1)}><ChevronLeft size={16} /></button>
          <span className="historico-periodo-label">{anoSelecionado}</span>
          <button onClick={() => setAnoSelecionado(a => a + 1)}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="relatorio-cards-resumo">
        <div className="relatorio-card">
          <div className="relatorio-card-icone"><TrendingUp size={20} /></div>
          <div className="relatorio-card-info">
            <span className="relatorio-card-titulo">Total Anual</span>
            <span className={`relatorio-card-valor ${resumoAnual.total >= 0 ? 'positivo' : 'negativo'}`}>
              {fmtBRL(resumoAnual.total)}
            </span>
          </div>
        </div>
        <div className="relatorio-card">
          <div className="relatorio-card-icone"><Calendar size={20} /></div>
          <div className="relatorio-card-info">
            <span className="relatorio-card-titulo">Média Mensal</span>
            <span className={`relatorio-card-valor ${resumoAnual.media >= 0 ? 'positivo' : 'negativo'}`}>
              {fmtBRL(resumoAnual.media)}
            </span>
          </div>
        </div>
        <div className="relatorio-card">
          <div className="relatorio-card-icone"><Award size={20} /></div>
          <div className="relatorio-card-info">
            <span className="relatorio-card-titulo">Melhor Mês</span>
            <span className="relatorio-card-valor positivo">
              {resumoAnual.melhorMes.total > -Infinity ? `${resumoAnual.melhorMes.nome} (${fmtBRL(resumoAnual.melhorMes.total)})` : '—'}
            </span>
          </div>
        </div>
      </div>

      {historicoAno.length > 0 ? (
        <>
          <div className="relatorio-grafico-section">
            <h4>Juros por Mês — {anoSelecionado}</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dadosGrafico}>
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} width={65} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {dadosGrafico.map((entry, i) => (
                    <Cell key={i} fill={entry.positivo ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="relatorio-tabela-section">
            <div className="relatorio-tabela-header">
              <h4>Detalhamento Mensal</h4>
              <div className="relatorio-botoes-exportar">
                <button className="btn-exportar" onClick={exportarCSV}>
                  <Download size={14} /> Exportar CSV
                </button>
                <button className="btn-exportar btn-exportar-pdf" onClick={exportarPDF}>
                  <FileText size={14} /> Exportar PDF
                </button>
              </div>
            </div>
            <div className="relatorio-tabela-wrapper">
              <table className="relatorio-tabela">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Juros</th>
                    <th>Registros</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosMensais.map(m => (
                    <tr key={m.mes} className={m.registros > 0 ? 'com-dados' : ''}>
                      <td className="relatorio-mes-nome">{m.nomeCompleto}</td>
                      <td className={`relatorio-mes-juros ${m.total >= 0 ? 'positivo' : 'negativo'}`}>
                        {m.registros > 0 ? fmtBRL(m.total) : '—'}
                      </td>
                      <td className="relatorio-mes-registros">{m.registros}</td>
                      <td>
                        {m.registros > 0 ? (
                          <span className={`relatorio-status ${m.positivo ? 'positivo' : 'negativo'}`}>
                            {m.positivo ? 'Lucro' : 'Perda'}
                          </span>
                        ) : (
                          <span className="relatorio-status sem-dados">Sem dados</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="relatorio-linha-total">
                    <td><strong>Total Anual</strong></td>
                    <td className={`relatorio-mes-juros ${resumoAnual.total >= 0 ? 'positivo' : 'negativo'}`}>
                      <strong>{fmtBRL(resumoAnual.total)}</strong>
                    </td>
                    <td><strong>{historicoAno.length}</strong></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="historico-vazio">
          Nenhum registro de juros em {anoSelecionado}. Atualize o saldo de uma conta para começar a calcular.
        </div>
      )}
    </div>
  )
}
