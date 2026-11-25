# Guia de design — Fila do Síndico

Baseado na direção visual do protótipo (documento da Júlia) e nas telas em
`docs/prototipo/`. Toda tela nova segue este guia.

## Princípio

**Ferramenta de trabalho calma e legível.** O gestor lê muita coisa sob pressão. Base neutra,
uma cor de ação e cor extra só onde há urgência. Cor demais tira a atenção do que é urgente.

## Onde está cada coisa

| Arquivo | O que tem |
| --- | --- |
| `src/styles/tokens.css` | Todas as cores, tamanhos, espaços e raios como variáveis CSS |
| `src/index.css` | Estilos base e classes de componentes compartilhados |
| `docs/prototipo/` | Prints do protótipo: quadro e registro de ocorrência |

**Regra:** nunca escreva uma cor, tamanho de fonte, espaço ou raio direto no código. Use uma
variável de `tokens.css`. Precisa de um valor novo? Adicione o token e combine com o time.

## Cores

| Uso | Token | Valor |
| --- | --- | --- |
| Ação (botão principal) | `--cor-acao` | `#0F766E` azul-petróleo |
| Fundo da página | `--cor-fundo` | `#F6F7F9` |
| Cartões, campos, topo | `--cor-superficie` | `#FFFFFF` |
| Atrás de uma janela aberta | `--cor-fundo-janela` | `#111827` com 40% de opacidade |
| Texto principal | `--cor-texto` | `#111827` |
| Texto secundário | `--cor-texto-secundario` | `#4B5563` |
| Bordas | `--cor-borda` | `#E5E7EB` |

**Regras de cor**
- O **botão principal de cada tela é o único elemento em azul-petróleo cheio**. O resto é neutro.
- Texto sempre sobre fundo claro.
- Erro e sucesso usam `--cor-erro` e `--cor-sucesso` com os fundos correspondentes.

### Prioridades

| Prioridade | Classe | Quando aparece |
| --- | --- | --- |
| Urgente | `.etiqueta-urgente` | Risco ou prazo que não espera |
| Alta | `.etiqueta-alta` | Importante, com data a combinar |
| Normal | `.etiqueta-normal` | Rotina que a equipe ou a administradora resolve |
| Baixa | `.etiqueta-baixa` | Sem risco nem prazo |
| Aguardando triagem | `.etiqueta-triagem` | Ocorrência que a IA ainda não classificou (neutra, não é prioridade) |

**Prioridade nunca é só cor:** sempre aparece com o nome escrito (`● Urgente`), para quem não
distingue cores. A cor de prioridade aparece só na etiqueta e nos pontos do resumo, nunca no
fundo do cartão inteiro.

## Tipografia

- Fonte **Inter**, só dois pesos: 400 (`--peso-normal`) e 600 (`--peso-forte`).
- Números tabulares (já ligado no `body`), para contagens alinharem.

| Uso | Tamanho |
| --- | --- |
| Título da página (`h1`) | 24 px |
| Título de seção (`h2`) | 20 px |
| Texto e campos | 14 a 16 px |
| Metadados, etiquetas, ajuda | 12 px |

## Forma e espaço

- Cantos de **8 px** em cartões, botões e campos (`--raio`).
- Borda fina de **1 px** cinza (`--borda`).
- **Sem sombra** em listas e cartões. Sombra leve (`--sombra-flutuante`) só no que flutua:
  menus, avisos, janelas.
- Espaços em múltiplos de 4 (`--espaco-1` a `--espaco-12`).
- **Alvos de toque com pelo menos 44 px** (`--altura-controle`) e foco visível de 2 px em tudo
  que é clicável (já global, via `:focus-visible`).

## Componentes

| Componente | Classes | Notas |
| --- | --- | --- |
| Topo do app | `.topo`, `.topo-marca`, `.topo-marca-icone` | Ícone `Building2` em fundo verde-claro + "Fila do Síndico" |
| Navegação do topo | `<nav class="topo-nav">` + `.botao` (`NavLink`) | Página atual (`aria-current`) com borda e texto azul-petróleo |
| Página larga (quadro) | `.pagina` | Até 1520 px |
| Página de formulário | `.pagina-estreita` | Até 576 px, centralizada |
| Cabeçalho da página | `.cabecalho-pagina`, `h1`, `.subtitulo` | Título à esquerda, botão principal à direita |
| Voltar | `.link-voltar` | Ícone `ArrowLeft` + "Voltar ao quadro" |
| Botão | `.botao` | Branco com borda |
| Botão principal | `.botao .botao-principal` | Um por tela |
| Grupo de opções | `.opcoes` + `.botao` com `aria-pressed` | A opção marcada fica com borda e texto azul-petróleo |
| Ação fixa no rodapé | `.rodape-acao` | Formulários longos: o botão de enviar fica sempre visível |
| Campo | `.campo`, `.campo-rotulo`, `input`/`select`/`textarea` | Rótulo acima, em 600 |
| Regra do campo | `.campo-ajuda`, `.campo-ajuda-ok` | Abaixo do campo, ligada por `aria-describedby`. Fica verde com `CircleCheck` quando atendida; nunca vermelha enquanto a pessoa digita |
| Obrigatório / opcional | `<span class="obrigatorio">*</span>`, `<span class="opcional">(opcional)</span>` | Dentro do rótulo |
| Dois campos lado a lado | `.linha-campos` | Vira uma coluna no celular |
| Cartão | `.cartao`, `.cartao-meta`, `.cartao-titulo` | No máximo quatro linhas de conteúdo |
| Cartão concluído | `.cartao .cartao-apagado` | Fundo cinza claro |
| Etiqueta de prioridade | `.etiqueta .etiqueta-urgente` (etc.) | Ponto + nome |
| Contagem | `.contador` | Ao lado do nome da coluna |
| Avisos | `.aviso .aviso-erro` / `.aviso-sucesso` | Mensagens de formulário |
| Lista vazia | `.estado-vazio` | Sempre uma frase, nunca espaço em branco |
| Janela (modal) | `<dialog class="janela">` com `showModal()` | Flutua com `--sombra-flutuante` sobre `--cor-fundo-janela`. Esc fecha. Ex.: "Delegar" no painel |
| Login e cadastro | `.tela-centralizada` > `.caixa` | Caixa branca centralizada na vertical e na horizontal |
| Marca na caixa | `.topo-marca .caixa-marca` | Logo no alto da `.caixa` |
| Links da caixa | `<nav class="caixa-links">` | Pé da `.caixa` ("Criar conta", "Já tenho conta"); texto secundário |

### Exemplo de formulário

```tsx
<main className="pagina-estreita">
  <h1>Registrar ocorrência</h1>
  <p className="subtitulo">Conte o que aconteceu e onde</p>

  <form className="formulario">
    <label className="campo">
      <span className="campo-rotulo">
        Onde fica o problema <span className="opcional">(opcional)</span>
      </span>
      <input placeholder="Ex.: garagem, 3º andar, bloco B" />
    </label>

    <label className="campo">
      <span className="campo-rotulo">
        Descrição <span className="obrigatorio">*</span>
      </span>
      <textarea required placeholder="Descreva o que aconteceu" />
    </label>

    <div className="rodape-acao">
      <button type="submit" className="botao botao-principal">
        <Send size={16} aria-hidden /> Enviar ocorrência
      </button>
    </div>
  </form>
</main>
```

## Ícones

Biblioteca **`lucide-react`** (a mesma do protótipo). Tamanho 16 px em botões e metadados,
20 px no topo. Ícone decorativo leva `aria-hidden`; botão só com ícone leva `aria-label`.

Ícones já usados no protótipo: `Building2` (marca), `ArrowLeft` (voltar), `Plus` (registrar),
`Send` (enviar), `Search` (busca), `ChevronDown` (filtros), `User` (quem registrou), `Clock`
(tempo), `CircleCheck` (concluir), `Ellipsis` (mais ações).

## Textos

- Português, frases curtas, sem jargão técnico.
- Botões dizem a ação: "Enviar ocorrência", "Aprovar", "Cadastrar condomínio". Nunca "OK" ou
  "Submeter".
- Tempo relativo nas listas: "há 25 min", "ontem".
- Contagens com contexto: "14 ocorrências em 11 condomínios".

## Celular

- Abaixo de 640 px, campos lado a lado viram uma coluna e o cabeçalho empilha.
- Formulários: o botão principal fica fixo no rodapé (`.rodape-acao`).
- Quadro (Sprint 2): uma coluna por vez, com abas de contagem.

## Sobre os prints do protótipo

Use os prints como referência de **visual e layout**, não de campos. O protótipo foi feito antes
das decisões de 16/11 (por exemplo, o formulário de ocorrência pede nome, apartamento e
condomínio, que agora vêm do cadastro do morador). Os campos de cada tela seguem a história de
usuário no Linear.
