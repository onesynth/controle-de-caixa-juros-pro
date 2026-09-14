import { app, BrowserWindow, Menu, dialog, shell, ipcMain } from 'electron'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createApp, loadData, saveData } from '../server/server.js'
import { ativar, verificarLicenca, licencaSalva } from './licenca.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NOME = 'Controle de Caixa & Juros Pro'

let win = null
let winAtivacao = null
let server = null
let porta = 0

function dirDados() {
  return process.env.APPDATA
    ? path.join(process.env.APPDATA, 'controle-caixa-juros-pro')
    : path.join(app.getPath('userData'), 'dados')
}

function arquivoDados() {
  const dir = dirDados()
  const destino = path.join(dir, 'dados.json')
  if (!fs.existsSync(destino)) {
    const origem = path.join(__dirname, '..', 'src', 'data', 'dados.json')
    if (fs.existsSync(origem)) {
      try {
        saveData(loadData(origem), destino)
      } catch {}
    }
  }
  return destino
}

function iniciarServidor() {
  const dataFile = arquivoDados()
  const api = createApp(dataFile)
  api.use(express.static(path.join(__dirname, '..', 'dist')))
  api.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'))
  })
  return new Promise(resolve => {
    server = api.listen(0, () => resolve(server.address().port))
  })
}

async function exportarBackup() {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Exportar backup',
    defaultPath: `backup-caixa-juros-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'Backup JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return
  try {
    fs.copyFileSync(arquivoDados(), filePath)
    dialog.showMessageBox(win, { message: 'Backup salvo com sucesso!', type: 'info' })
  } catch (e) {
    dialog.showMessageBox(win, { message: 'Erro ao salvar backup: ' + e.message, type: 'error' })
  }
}

async function restaurarBackup() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Restaurar backup',
    filters: [{ name: 'Backup JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths?.length) return
  try {
    const d = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
    if (!d.contas && !d.cofrinhos) throw new Error('Formato inválido')
    saveData(d, arquivoDados())
    dialog.showMessageBox(win, {
      message: 'Backup restaurado! O aplicativo será reiniciado.',
      type: 'info'
    }).then(() => {
      app.relaunch()
      app.exit(0)
    })
  } catch (e) {
    dialog.showMessageBox(win, { message: 'Erro ao restaurar: ' + e.message, type: 'error' })
  }
}

async function abrirPastaDados() {
  shell.openPath(dirDados())
}

function temNovaVersao(local, remota) {
  const l = local.split('.').map(Number)
  const r = remota.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((r[i] || 0) > (l[i] || 0)) return true
    if ((r[i] || 0) < (l[i] || 0)) return false
  }
  return false
}

async function verificarAtualizacao(versao, downloadUrl) {
  if (!versao || !downloadUrl) return
  const local = app.getVersion()
  if (!temNovaVersao(local, versao)) return
  const resposta = await dialog.showMessageBox(win || winAtivacao, {
    type: 'info',
    title: 'Nova versão disponível',
    message: `Uma nova versão (${versao}) está disponível.\nSua versão atual é ${local}.`,
    buttons: ['Baixar agora', 'Depois'],
    defaultId: 0,
    cancelId: 1
  })
  if (resposta.response === 0) {
    shell.openExternal(downloadUrl)
  }
}

function criarJanela() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    title: NOME,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: { contextIsolation: true }
  })
  win.loadURL(`http://localhost:${porta}`)
  win.on('closed', () => { win = null })
}

function mostrarAtivacao(modo) {
  if (winAtivacao) { winAtivacao.focus(); return }
  winAtivacao = new BrowserWindow({
    width: 520,
    height: 420,
    resizable: false,
    title: 'Ativação — ' + NOME,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: { contextIsolation: false, nodeIntegration: true }
  })
  const params = new URLSearchParams({ modo: modo || 'ativar', chave: licencaSalva()?.chave || '' })
  winAtivacao.loadFile(path.join(__dirname, 'ativacao.html'), { search: params.toString() })
  winAtivacao.on('closed', () => { winAtivacao = null })
}

ipcMain.handle('ativar-licenca', async (e, chave) => {
  try {
    if (!chave || !chave.trim()) return { erro: 'Digite a chave de licença.' }
    await ativar(chave)
    if (winAtivacao) winAtivacao.close()
    if (!win || win.isDestroyed()) criarJanela()
    return { ok: true }
  } catch (err) {
    return { erro: err.message }
  }
})

ipcMain.handle('revalidar-licenca', async () => {
  try {
    const r = await verificarLicenca()
    if (r.status !== 'ok') return { erro: 'Não foi possível revalidar. Verifique sua internet e tente novamente.' }
    if (winAtivacao) winAtivacao.close()
    if (!win || win.isDestroyed()) criarJanela()
    return { ok: true }
  } catch (err) {
    return { erro: err.message }
  }
})

async function garantirLicenca() {
  const r = await verificarLicenca()
  if (r.status === 'ok') return { ok: true, versao: r.versao, downloadUrl: r.downloadUrl }
  mostrarAtivacao(r.status === 'bloqueado' ? 'bloqueado' : 'ativar')
  return { ok: false }
}

app.whenReady().then(async () => {
  porta = await iniciarServidor()

  const lic = await garantirLicenca()
  if (lic.ok) {
    criarJanela()
    verificarAtualizacao(lic.versao, lic.downloadUrl)
  }

  const template = [
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Exportar backup...', click: exportarBackup },
        { label: 'Restaurar backup...', click: restaurarBackup },
        { label: 'Abrir pasta de dados', click: abrirPastaDados },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        { label: 'Status da Licença', click: () => {
            const lic = licencaSalva()
            dialog.showMessageBox(win, {
              type: 'info',
              message: lic ? `Licença ativa\nChave: ${lic.chave}\nÚltima validação: ${new Date(lic.ultimaValidacao).toLocaleDateString('pt-BR')}` : 'Licença não ativada.'
            })
          } },
        { label: 'Sobre', click: () => dialog.showMessageBox(win, { message: `${NOME}\nVersão ${app.getVersion()}`, type: 'info' }) }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela()
  })
})

app.on('window-all-closed', () => {
  if (server) server.close()
  app.quit()
})
