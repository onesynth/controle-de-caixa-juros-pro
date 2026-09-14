import { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, PiggyBank, Clock, FileText, Settings, Sun, Moon } from 'lucide-react'
import { api } from './api.js'
import Dashboard from './components/Dashboard.jsx'
import Cofrinhos from './components/Cofrinhos.jsx'
import Historico from './components/Historico.jsx'
import Relatorio from './components/Relatorio.jsx'
import Configuracoes from './components/Configuracoes.jsx'

export default function App() {
  const [dados, setDados] = useState(null)
  const [aba, setAba] = useState('dashboard')
  const [tema, setTema] = useState(() => localStorage.getItem('ccj-tema') || 'dark')

  useEffect(() => {
    document.documentElement.dataset.tema = tema
    localStorage.setItem('ccj-tema', tema)
  }, [tema])

  const recarregar = useCallback(() => api.dados().then(setDados), [])
  useEffect(() => { recarregar() }, [recarregar])

  if (!dados) {
    return (
      <div className="carregando">
        <div className="spinner" />
        Carregando seus dados...
      </div>
    )
  }

  const abas = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['cofrinhos', 'Cofrinhos', PiggyBank],
    ['historico', 'Histórico', Clock],
    ['relatorio', 'Relatórios', FileText],
    ['config', 'Configurações', Settings],
  ]

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <img src="/logo.svg" alt="" width="38" height="38" className="logo-badge" />
          Controle de Caixa & Juros Pro
        </h1>
        <div className="topbar-acoes">
          <nav>
            {abas.map(([id, label, Icone]) => (
              <button key={id} className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>
                <Icone size={16} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <button
            className="btn-tema"
            title={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            onClick={() => setTema(t => t === 'dark' ? 'light' : 'dark')}
          >
            {tema === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {aba === 'dashboard' && <Dashboard dados={dados} onChange={recarregar} />}
      {aba === 'cofrinhos' && <Cofrinhos dados={dados} onChange={recarregar} />}
      {aba === 'historico' && <Historico dados={dados} />}
      {aba === 'relatorio' && <Relatorio dados={dados} />}
      {aba === 'config' && <Configuracoes dados={dados} onChange={recarregar} />}
    </div>
  )
}
