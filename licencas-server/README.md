# Controle de Caixa & Juros Pro — Servidor de Licenças

Servidor Express que gerencia chaves de licença, ativação e validação do app desktop.
Banco de dados: Neon PostgreSQL via `@neondatabase/serverless` (HTTP mode).

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
| `APP_NAME` | Nome do app | `Controle de Caixa & Juros Pro` |
| `KEY_PREFIX` | Prefixo das chaves | `CCJ` |
| `DATABASE_URL` | URL do Neon PostgreSQL | _(obrigatório em produção)_ |
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
| GET | `/admin/api/info` | Nome do app e prefixo |
| GET | `/admin/api/chaves` | Listar chaves |
| POST | `/admin/api/gerar` | Gerar nova chave |
| POST | `/admin/api/resetar` | Resetar máquina |
| POST | `/admin/api/bloquear` | Bloquear/desbloquear chave |
| GET | `/admin/api/config` | Obter configuração |
| POST | `/admin/api/config` | Atualizar configuração |

Acesse o painel admin em `/admin`.

## Deploy no Render

1. Crie um Web Service no Render conectado ao repo `controle-caixa-juros-licencas`
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Root Directory: `licencas-server`
5. Configure as env vars:
   - `APP_NAME=Controle de Caixa & Juros Pro`
   - `KEY_PREFIX=CCJ`
   - `DATABASE_URL=<sua URL do Neon>`
   - `ADMIN_KEY=<sua senha>`
   - `SEGREDO=<seu segredo>`

## Banco de Dados (Neon)

Tabela `chaves`:
- `chave` VARCHAR(19) PRIMARY KEY
- `maquinas` JSONB (lista de IDs de máquina)
- `bloqueada` BOOLEAN
- `criada_em` TIMESTAMPTZ
- `ativada_em` TIMESTAMPTZ
- `obs` TEXT

Tabela `config`:
- `chave` VARCHAR(50) PRIMARY KEY (ex: 'versao', 'downloadUrl')
- `valor` TEXT

## Migração de JSON para Neon

```bash
DATABASE_URL=sua_url neon db push
# ou use o script migrate.js:
npm run migrate
```

## Notas Técnicas

- Usa `@neondatabase/serverless` (HTTP mode) ao invés de `pg` para evitar problemas com PgBouncer em transaction mode
- Modo offline: o app cliente funciona até 15 dias sem conexão
- Token de validade: 15 dias, revalidação automática a cada 7 dias
