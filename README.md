# Sistema de Controle de Consumo Escolar (RFID)

Gestão de alunos, saldo pré-pago, limite pós-pago e operação da cantina com leitura por **leitor RFID ACS ACR122U**.

---

## O que você precisa baixar e instalar

Instale **nesta ordem** na máquina que vai rodar o sistema (Windows recomendado para o leitor ACR122U).

| # | Software | Versão | Onde baixar | Para quê |
|---|----------|--------|-------------|----------|
| 1 | **Node.js** | 18 LTS ou superior | [nodejs.org](https://nodejs.org/) | API e site (React + Vite) |
| 2 | **PostgreSQL** | 14 ou superior | [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) | Banco de dados |
| 3 | **Python** | **3.12** (importante: não use 3.14) | [python.org/downloads](https://www.python.org/downloads/) ou `winget install Python.Python.3.12` | Bridge do leitor RFID |
| 4 | **Git** (opcional) | Qualquer recente | [git-scm.com](https://git-scm.com/) | Clonar o repositório |
| 5 | **Driver do ACR122U** | — | Incluso no Windows ao conectar o leitor USB, ou pacote ACS | Leitor RFID na porta USB |

### Leitor RFID (ACR122U)

- Modelo suportado: **ACS ACR122U** (USB).
- Conecte o leitor antes de iniciar o bridge.
- Teste se o Windows reconheceu (PowerShell):

```powershell
py -3.12 -m pip install pyscard
py -3.12 -c "from smartcard.System import readers; print(readers())"
```

Resultado esperado (nome pode variar): `['ACS ACR122 0']` ou `['ACS ACR122U PICC Interface']`.

> **Python 3.14:** o pacote `pyscard` ainda não tem instalador pronto para 3.14 no Windows. Use **Python 3.12** para o bridge RFID (`npm run dev:rfid` já usa `py -3.12`).

### Credenciais padrão do PostgreSQL

Durante a instalação do PostgreSQL, anote a senha do usuário `postgres`. O projeto assume por padrão:

| Campo | Valor padrão |
|-------|----------------|
| Usuário | `postgres` |
| Senha | `12345` |
| Porta | `5432` |
| Banco | `escola_cantina` (criado automaticamente) |

Se sua senha for diferente, edite `backend/.env` → `DATABASE_URL`.

---

## Instalação do projeto (primeira vez)

Abra o **PowerShell** na pasta raiz do projeto (`escola`).

### 1. Copiar variáveis de ambiente

```powershell
copy backend\.env.example backend\.env
```

Edite `backend/.env` se necessário (senha do PostgreSQL, etc.).

### 2. Instalar dependências Node.js

```powershell
npm run install:all
```

### 3. Instalar dependências do leitor RFID (Python)

```powershell
npm run install:rfid
```

### 4. Criar banco e dados iniciais

Confirme que o **serviço PostgreSQL está rodando**, depois:

```powershell
npm run db:init
```

O comando:

- Cria o banco `escola_cantina` (se não existir)
- Aplica schema e migrações
- Insere produtos e alunos de demonstração
- Cria o admin: **usuário** `admin`, **senha** `admin123`

> Rode `npm run db:init` **uma vez** em ambiente limpo. Rodar de novo pode duplicar produtos demo.

---

## Rodar o sistema localmente

### Forma rápida (recomendada) — 1 clique, 3 janelas

Dê **duplo clique** em:

```
start-sistema.bat
```

Ou no terminal, na pasta `escola`:

```powershell
npm run dev
```

O script:

1. Encerra processos antigos nas portas 4000, 5173 e 8765
2. Abre **3 janelas CMD** separadas:
   - **Escola - API** (porta 4000)
   - **Escola - Web** (porta 5173)
   - **Escola - RFID** (porta 8765)

Sempre que você rodar esse mesmo arquivo, ele primeiro **encerra o que já estiver aberto** e depois **inicia tudo novamente**.

### O que subir no Git (scripts de inicialização)

O `start-sistema.bat` depende do projeto inteiro. No Git, suba **pelo menos** estes arquivos novos/alterados:

| Arquivo | Motivo |
|---------|--------|
| `start-sistema.bat` | Script que mata e sobe API + Web + RFID |
| `package.json` | Comandos `npm run dev`, `dev:api`, `dev:web`, `dev:rfid` |
| `README.md` | Instruções de instalação e uso |
| `client/vite.config.js` | `host: true` para acesso na rede local |

O restante do repositório (`backend/`, `client/`, `database/`, `rfid-bridge/`) **já precisa estar no Git** — sem eles o script não funciona.

Comando para enviar só o que mudou dos scripts:

```powershell
git add start-sistema.bat package.json README.md client/vite.config.js .gitignore
git commit -m "Adiciona script único para subir API, web e RFID"
git push
```

**Não suba:** `node_modules/`, `backend/.env`, `__pycache__/`, `dist/` (já estão no `.gitignore`).

### Forma manual (3 terminais)

```powershell
# Terminal 1 — API (porta 4000)
npm run dev:api

# Terminal 2 — Site (porta 5173)
npm run dev:web

# Terminal 3 — Leitor RFID (porta 8765) — só na máquina com o ACR122U conectado
npm run dev:rfid
```

### URLs locais

| Função | URL |
|--------|-----|
| **Cantina** (vendas com RFID) | http://localhost:5173/ |
| **Administração** | http://localhost:5173/admin |
| **API (teste)** | http://localhost:4000/api/health |

**Login admin:** `admin` / `admin123`

### Fluxo com cartão físico

1. **Admin → Alunos → Novo aluno** — aproxime o cartão no leitor para capturar o UID e salve.
2. **Cantina** (`/`) — aproxime o mesmo cartão; o aluno é selecionado automaticamente.
3. Adicione produtos ao carrinho e confirme a compra.

O indicador **"Pronto"** (verde) na cantina confirma que o leitor está conectado.

---

## Acesso por outras máquinas na mesma rede

A máquina que roda os 3 processos acima é o **servidor**. Outros PCs/celulares na mesma rede Wi‑Fi/LAN acessam pelo **IP local** do servidor.

### 1. Descobrir o IP do servidor

No PowerShell **do servidor**:

```powershell
ipconfig
```

Use o **IPv4** da rede ativa (ex.: `192.168.1.50`).

Ao subir o site, o Vite também mostra algo como:

```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.50:5173/
```

### 2. Liberar portas no Firewall do Windows (servidor)

Execute **como Administrador** no servidor (ajuste o IP se quiser restringir):

```powershell
New-NetFirewallRule -DisplayName "Escola Cantina Web" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
New-NetFirewallRule -DisplayName "Escola Cantina API" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow
```

> A porta **8765** (RFID) **não precisa** ser aberta na rede — o leitor USB fica só no servidor.

### 3. Acessar de outro dispositivo

Substitua `192.168.1.50` pelo IP real do servidor:

| Função | URL na rede |
|--------|-------------|
| Cantina | http://192.168.1.50:5173/ |
| Admin | http://192.168.1.50:5173/admin |

### O que funciona em cada máquina

| Recurso | No servidor (com leitor USB) | Outro PC/celular na rede |
|---------|------------------------------|---------------------------|
| Ver cantina e admin | Sim | Sim |
| Cadastrar alunos (sem cartão) | Sim | Sim |
| **Ler cartão RFID** | Sim | **Não** — leitor e bridge ficam no servidor |
| Vendas na cantina | Sim (com cartão no servidor) | Só visualização; operação RFID é no servidor |

**Recomendação:** use o **servidor** na bancada da cantina (com o ACR122U). Outros dispositivos na rede podem acessar o **painel admin** (relatórios, créditos, cadastros manuais).

### CORS (se acessar a API diretamente)

Se algo chamar `http://IP:4000` direto (sem passar pelo Vite), ajuste em `backend/.env`:

```env
CLIENT_ORIGIN=http://192.168.1.50:5173
```

Para aceitar qualquer origem em desenvolvimento na rede:

```env
CLIENT_ORIGIN=true
```

No uso normal, o site em `:5173` faz proxy para a API — **não é obrigatório** alterar o CORS.

---

## Scripts disponíveis (pasta raiz)

| Comando | Descrição |
|---------|-----------|
| `npm run dev` ou `start-sistema.bat` | **Sobe tudo** em 3 CMD separados |
| `npm run install:all` | Instala dependências do backend e client |
| `npm run install:rfid` | Instala `pyscard` e `websockets` (Python 3.12) |
| `npm run db:init` | Cria banco, schema, seeds e admin |
| `npm run dev:api` | Sobe só a API (porta 4000) |
| `npm run dev:web` | Sobe só o site (porta 5173, acessível na rede) |
| `npm run dev:rfid` | Sobe só o bridge do leitor ACR122U (porta 8765) |

---

## Variáveis de ambiente (`backend/.env`)

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta da API (padrão `4000`) |
| `DATABASE_URL` | URL completa do PostgreSQL |
| `JWT_SECRET` | Segredo JWT do admin (troque em produção) |
| `CLIENT_ORIGIN` | CORS — `http://localhost:5173`, IP da rede ou `true` |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número na WhatsApp Cloud API (Meta) |
| `WHATSAPP_TOKEN` | Token da API WhatsApp |
| `WHATSAPP_DEBUG` | `1` = logs de envio no console |
| `WHATSAPP_TEST_OVERRIDE_TO` | Força envio para um número de teste (E.164) |

Opcional no client (arquivo `client/.env`):

| Variável | Descrição |
|----------|-----------|
| `VITE_RFID_WS_URL` | URL do bridge RFID (padrão `ws://127.0.0.1:8765`) |

---

## WhatsApp (extrato automático)

Opcional. Sem configurar, o sistema funciona normalmente — só não envia mensagens.

- Configure `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_TOKEN` no [Meta for Developers](https://developers.facebook.com/) → app → WhatsApp → API Setup.
- O remetente é sempre o número comercial ligado ao **Phone number ID** na Meta.
- Destinatário: WhatsApp do responsável cadastrado no aluno (com opt-in).
- Teste: `WHATSAPP_TEST_OVERRIDE_TO=5571999999999` (DDI + DDD + número, só dígitos).

Após confirmar o carrinho, a mensagem pode incluir: itens, total, gasto do dia, saldo e limite.

---

## Build de produção (opcional)

```powershell
cd client
npm run build
```

Arquivos em `client/dist`. Em produção, sirva com nginx/IIS e configure proxy de `/api` e `/uploads` para a API.

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| Erro de conexão PostgreSQL | Verifique se o serviço está rodando, senha em `DATABASE_URL` e porta `5432` |
| Porta 4000 ou 5173 em uso | Feche o outro programa ou altere `PORT` / `vite.config.js` |
| Login admin falha | Rode `npm run db:init` em banco vazio ou confira usuário `admin` |
| Leitor "Offline" na cantina | Rode `npm run dev:rfid` na máquina com o USB conectado |
| `pyscard` falha com **Microsoft Visual C++ 14.0** | Você está no Python errado (3.13/3.14). Instale **Python 3.12** e use `py -3.12` — veja seção abaixo |
| Outro PC não abre o site | Libere firewall (porta 5173), confirme mesmo Wi‑Fi e IP correto |
| Cartão não cadastrado | Cadastre o UID real em Admin → Alunos (UIDs demo `RFID0001...` não são cartões físicos) |

### Encerrar tudo (Windows)

Se quiser encerrar manualmente sem subir de novo, use:

```powershell
$ports = 4000, 5173, 8765
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
```

---

## Estrutura das pastas

```
escola/
├── backend/          # API Express + PostgreSQL
├── client/           # React + Vite + Tailwind
├── database/         # schema.sql, seeds e migrations
├── rfid-bridge/      # Serviço Python (ACR122U → WebSocket)
├── start-sistema.bat # Encerra tudo e inicia API + Web + RFID (3 CMD)
├── package.json      # Scripts npm da raiz
└── README.md
```

Regras de negócio (saldo × limite × quitação): `database/schema.sql` e `backend/src/services/consumptionService.js`.
