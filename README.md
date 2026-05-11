# ⚔️ Pathfinder Movement — Plugin para Owlbear Rodeo 2.x

Plugin de movimentação avançada para tokens Pathfinder 2e no Owlbear Rodeo.  
Suporta caminhos manuais, animação em tempo real e IA autônoma.

---

## 📁 Estrutura de Arquivos

```
owlbear-pathfinder/
├── manifest.json           ← configuração do plugin (OBR lê isso)
├── index.html              ← interface do painel (Action Panel)
├── icon.svg                ← ícone do plugin
├── package.json            ← dependências de desenvolvimento
└── src/
    ├── main.js             ← lógica central (OBR, PathEngine, AIEngine)
    └── pathfinder-types.js ← tipos de personagens e montarias PF2e
```

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) v16 ou superior
- Conta no [Owlbear Rodeo](https://www.owlbear.rodeo/)

### Passo 1 — Instalar dependências

```bash
cd owlbear-pathfinder
npm install
```

### Passo 2 — Iniciar o servidor local

```bash
npm run dev
```

O plugin ficará disponível em: **http://localhost:3000**

> ⚠️ O Owlbear Rodeo exige HTTPS para plugins externos em produção,  
> mas aceita HTTP/localhost durante desenvolvimento.

### Passo 3 — Adicionar o plugin no Owlbear Rodeo

1. Abra uma mesa no [owlbear.rodeo](https://www.owlbear.rodeo/)
2. Clique em **⚙ Settings** (engrenagem, canto superior direito)
3. Vá até a aba **Extensions** (ou "Plugins")
4. Clique em **Add Extension**
5. Cole a URL do manifest:
   ```
   http://localhost:3000/manifest.json
   ```
6. Clique em **Add**
7. O ícone ⚔️ aparecerá na barra lateral esquerda

---

## ☁️ Deploy em Produção (HTTPS obrigatório)

### Opção A — Netlify (gratuito, recomendado)

1. Crie uma conta em [netlify.com](https://netlify.com)
2. Arraste a pasta `owlbear-pathfinder` para o painel do Netlify
3. Netlify gera uma URL HTTPS automaticamente, ex:  
   `https://pf-movement-abc123.netlify.app`
4. No OBR, adicione:  
   `https://pf-movement-abc123.netlify.app/manifest.json`

### Opção B — GitHub Pages

1. Crie um repositório no GitHub
2. Faça upload dos arquivos
3. Ative GitHub Pages: **Settings → Pages → Deploy from branch (main)**
4. URL gerada: `https://seunome.github.io/owlbear-pathfinder/`
5. Adicione ao OBR:  
   `https://seunome.github.io/owlbear-pathfinder/manifest.json`

### Opção C — Vercel

```bash
npm install -g vercel
vercel --prod
```

---

## 🎮 Como Usar

### Aba ⚔ Tokens

**Registrar um Token:**
1. Selecione o token no mapa do OBR (clique nele)
2. Clique em 🎯 para capturar o ID automaticamente, **ou** cole o ID manualmente
3. Preencha o nome, tipo (Character / Mount), subtipo Pathfinder
4. Ajuste a velocidade base (quadrados por turno)
5. Escolha uma cor identificadora
6. Clique em **+ Registrar Token**

**Selecionar Token Ativo:**
- Clique em ✓ no token desejado — ele fica em destaque dourado
- O token selecionado é usado por Movimento e IA

---

### Aba 🗺 Movimento

**Definir caminho:**

*Modo Manual:*
- Digite coordenadas X e Y e clique em **+**
- Os waypoints aparecem em lista numerada
- Remova qualquer ponto clicando em ✕

*Modo Clique no Mapa:*
- Clique em **🖱 Clique no Mapa**
- Uma ferramenta de clique é ativada no OBR
- Clique em qualquer ponto do mapa para adicionar waypoints

**Velocidade de animação:**
- Slider **"Quadrados por segundo"** controla a velocidade visual
- Independente da velocidade do personagem (stat de PF2e)
- 1 sq/s = movimento lento cinematográfico
- 10 sq/s = corrida rápida

**Controles:**
- ▶ **Iniciar** — começa a animação do token pelo caminho
- ■ **Parar** — pausa (pode retomar)
- 🗑 **Limpar** — apaga o caminho e para
- **Loop** — repete o caminho ao chegar ao final
- **Mostrar trilha** — exibe a linha de caminho no mapa

---

### Aba 🤖 IA

**Modos de IA:**

| Modo | Comportamento |
|------|--------------|
| **Vagar** | Move aleatoriamente pelo mapa, escolhendo novos destinos automaticamente |
| **Patrulha** | Segue waypoints definidos em loop contínuo |
| **Perseguir** | Vai em direção a um token alvo |
| **Fugir** | Corre para longe de um token alvo |

**Toggle: "Parar ao contato com Token"**  
Quando ativado, a IA para completamente ao entrar em contato com qualquer token registrado.  
Útil para simular encontros ou detectar colisões.

**Toggle: "Evitar outros tokens"**  
A IA tenta desviar de tokens em seu caminho ao invés de atravessá-los.

**Raio de detecção:**  
Define a distância (em quadrados) que a IA "enxerga" outros tokens para colisão/desvio.

**Como iniciar a IA:**
1. Selecione o token na aba ⚔ Tokens
2. Escolha o modo de IA
3. (Opcional) Defina token alvo para Chase/Flee
4. (Opcional) Adicione waypoints de patrulha
5. Clique em **🤖 Ligar IA**

---

### Aba ⚙ Config

- **Tamanho do quadrado** — deve corresponder ao DPI do grid do seu mapa OBR
- **Unidade de medida** — quadrados / pés / metros
- **Exportar/Importar Tokens** — salva ou carrega configurações em JSON
- **Limpar Tudo** — apaga todos os tokens e caminhos

---

## 🔧 Encontrar o ID de um Token no OBR

O ID do token é gerado pelo OBR automaticamente.  
Para encontrá-lo:

**Método 1 (recomendado):**  
Selecione o token no mapa → clique em 🎯 no plugin. O ID é capturado automaticamente.

**Método 2 (console do browser):**
```javascript
// No console DevTools (F12) do OBR:
OBR.player.getSelection().then(ids => console.log(ids))
```

**Método 3 (API):**
```javascript
OBR.scene.items.getItems(item => item.layer === "CHARACTER")
  .then(items => items.forEach(i => console.log(i.id, i.name)))
```

---

## ⚙️ Compatibilidade

| Versão | Status |
|--------|--------|
| Owlbear Rodeo 2.x | ✅ Compatível |
| Owlbear Rodeo 1.x | ❌ Não suportado |

---

## 📝 Notas Técnicas

- O plugin usa `requestAnimationFrame` para animação suave em tempo real
- As posições são salvas no metadata da cena OBR e em `localStorage`
- A linha de trilha é criada como `PATH` na layer `ATTACHMENT`
- A IA roda em loop de ~60fps usando delta time para velocidade consistente
- Colisão é verificada por distância euclidiana entre centros dos tokens
- O plugin é 100% JavaScript puro, sem frameworks ou bundlers necessários

---

## 🐛 Solução de Problemas

**"⚠ demo" no status → plugin não conecta ao OBR**  
→ Certifique-se de que o plugin está rodando em HTTPS (produção) ou localhost (dev)

**Token não se move**  
→ Verifique se o ID do token está correto (use o botão 🎯)  
→ Certifique-se de que o token está na layer CHARACTER ou MOUNT no OBR

**Trilha não aparece no mapa**  
→ Verifique se a layer ATTACHMENT está visível no OBR  
→ O OBR pode bloquear attachments dependendo das permissões da mesa

**IA não detecta outros tokens**  
→ Os tokens precisam estar **registrados** no plugin, não apenas no mapa
