# Controle de Caixa & Juros Pro — Servidor de Licenças

Servidor Express que gerencia chaves de licença, ativação e validação do app desktop.

## Setup Local

```bash
npm install
npm start
```

O servidor rodará em `http://localhost:4000`.

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `4000` |
| `ADMIN_KEY` | Senha do painel admin | `admin-dev-123` |
| `SEGREDO` | Segredo para assinatura HMAC | `segredo-dev-trocar-em-producao` |

## Endpoints Públicos

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/ativar` | Ativar chave de licença |
| POST | `/validar` | Validar/revalidar token |

## Endpoints Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/api/chaves` | Listar chaves |
| POST | `/admin/api/gerar` | Gerar nova chave |
| POST | `/admin/api/resetar` | Resetar máquina |
| POST | `/admin/api/bloquear` | Bloquear/desbloquear chave |
| GET | `/admin/api/config` | Obter configuração |
| POST | `/admin/api/config` | Atualizar configuração |

Acesse o painel admin em `/admin`.

## Deploy no Render

1. Crie um Web Service no Render
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Configure as env vars `ADMIN_KEY` e `SEGREDO`
