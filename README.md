# Sistema de Controle de Consumo Escolar (RFID)

Gestão de alunos, saldo pré-pago, limite pós-pago e operação da cantina com leitura por RFID (ou digitação manual).

## Pré-requisitos

1. **Node.js** 18 ou superior ([nodejs.org](https://nodejs.org/))
2. **PostgreSQL** instalado e em execução
3. Usuário do banco configurado (o projeto assume por padrão):
   - **Usuário:** `postgres`
   - **Senha:** `12345`
   - **Banco:** `escola_cantina` (criado automaticamente no passo 3)

Se sua senha ou host forem diferentes, edite o arquivo `backend/.env` e ajuste a variável `DATABASE_URL`.

---

## Passo a passo para iniciar

### 1. Clonar / abrir o projeto

Abra a pasta raiz do projeto (`escola`), onde estão as pastas `backend`, `client` e `database`.

### 2. Instalar dependências

Abra um terminal na raiz e execute:

```powershell
cd backend
npm install
```

Em outro momento (ou na sequência), instale o frontend:

```powershell
cd client
npm install
```

**Atalho (na raiz):** se preferir um único comando após criar scripts, você pode instalar manualmente nas duas pastas como acima.

### 3. Criar o banco de dados e dados iniciais

Na pasta `backend`:

```powershell
cd backend
npm run db:init
```

O que esse comando faz:

- Conecta no PostgreSQL usando `DATABASE_URL` do arquivo `backend/.env`
- Cria o banco `escola_cantina`, se ainda não existir
- Aplica o schema (`database/schema.sql`)
- Aplica migrações em `database/migrations/` (ex.: coluna de foto do aluno)
- Insere produtos e alunos de demonstração (`database/seed_data.sql`)
- Cria o administrador padrão: **usuário** `admin`, **senha** `admin123`

> **Importante:** só é necessário rodar `npm run db:init` de novo se você quiser reaplicar o schema em um banco já existente (objetos usam `IF NOT EXISTS` onde possível). Dados demo podem duplicar produtos se o banco já tiver produtos — em ambiente limpo, rode uma vez.

### 4. Subir a API (backend)

```powershell
cd backend
npm run dev
```

A API ficará em **http://localhost:4000**  
Teste rápido: abra no navegador ou use `curl` em `http://localhost:4000/api/health`

### 5. Subir o site (frontend)

Abra **outro** terminal:

```powershell
cd client
npm run dev
```

O sistema abrirá em **http://localhost:5173**

O Vite está configurado para enviar requisições `/api` e os arquivos em `/uploads` (fotos dos alunos) para o backend na porta 4000 — não é preciso configurar CORS manualmente para desenvolvimento.

### 6. Usar o sistema

| O quê | Onde |
|--------|------|
| **Operação da cantina** (RFID / produtos) | http://localhost:5173/ |
| **Área administrativa** (login) | http://localhost:5173/admin → redireciona para login ou painel |

**Login admin padrão:** `admin` / `admin123`

**RFIDs de exemplo** (após `db:init`):

- `RFID0001A1B2C3`
- `RFID0002D4E5F6`
- `RFID0003G7H8I9`
- `RFID0004J0K1L2`

Na tela da cantina, digite o código no campo e pressione **Enter**, ou use um leitor RFID que envie o texto como teclado.

---

## Build de produção (frontend)

```powershell
cd client
npm run build
```

Os arquivos gerados ficam em `client/dist`. Para servir em produção, use um servidor estático (nginx, etc.) e configure o proxy das chamadas `/api` para o mesmo host da API, ou ajuste `VITE_*` / URL da API conforme sua implantação.

---

## Variáveis de ambiente (`backend/.env`)

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta da API (padrão `4000`) |
| `DATABASE_URL` | URL completa do PostgreSQL |
| `JWT_SECRET` | Segredo para assinar tokens do admin (troque em produção) |
| `CLIENT_ORIGIN` | Origem permitida no CORS (ex.: `http://localhost:5173`) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número no WhatsApp Cloud API (Meta) |
| `WHATSAPP_TOKEN` | Token de acesso da API do WhatsApp |

O arquivo `backend/.env.example` serve de modelo.

### WhatsApp (extrato automático)

O envio usa a **WhatsApp Cloud API (Meta)**. Importante:

- O **remetente** que aparece no WhatsApp é **sempre** o número comercial ligado ao **`WHATSAPP_PHONE_NUMBER_ID`** no painel da Meta.  
  Não dá para escolher outro “número de” no código — se o remetente deve ser **(71) 99947-7669**, essa linha precisa ser a **conta WhatsApp Business** conectada ao app, e você copia o **Phone number ID** dela em: [Meta for Developers](https://developers.facebook.com/) → seu app → **WhatsApp** → **API Setup**.

- No `backend/.env` são obrigatórios para enviar de verdade:
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_TOKEN`

- O **destinatário** é o WhatsApp/contato do responsável cadastrado no aluno (com **opt-in** marcado).  
  Para **teste** sem depender do cadastro, use no `.env`:  
  `WHATSAPP_TEST_OVERRIDE_TO=5571999477669`  
  (todas as notificações vão para esse número).

- Em modo **Development** na Meta, só chegam mensagens para números que você adicionar como permitidos no app. Veja a documentação da Meta sobre números de teste.

- Com `WHATSAPP_DEBUG=1`, o backend registra no console **por que** não enviou ou o erro retornado pela API.

Conteúdo típico da mensagem após confirmar o carrinho:

- itens e total da compra
- total gasto no dia
- saldo atual e limite usado

---

## Problemas comuns

- **Erro de conexão com o PostgreSQL**  
  Confirme se o serviço do PostgreSQL está rodando, se usuário/senha batem com `DATABASE_URL` e se a porta (geralmente `5432`) está correta.

- **Porta 4000 ou 5173 em uso**  
  Altere `PORT` no `.env` do backend ou a porta no `client/vite.config.js` (`server.port`).

- **Login admin não funciona**  
  Rode de novo `npm run db:init` em um banco vazio ou verifique se o usuário `admin` existe na tabela `admins`.

---

## Estrutura das pastas

```
escola/
├── backend/          # API Express + integração PostgreSQL
├── client/           # React + Vite + Tailwind
├── database/         # schema.sql e seed_data.sql
└── README.md
```

Para dúvidas sobre regras de negócio (saldo x limite x quitação), consulte os comentários em `database/schema.sql` e o código em `backend/src/services/consumptionService.js`.
