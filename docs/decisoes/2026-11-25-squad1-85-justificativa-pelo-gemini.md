# Justificativa pelo Gemini 2.5 Flash (SQUAD1-85)

Data: 25/11/2026

## Técnica

| Decisão | Motivo |
| --- | --- |
| O System 2 (`ai-service/app/justificativa.py`) usa o Gemini 2.5 Flash pelo Pydantic AI, com saída estruturada (`frase`, de 1 a 200 caracteres) | Escolha do Pedro. A saída validada pelo schema evita parse de texto livre |
| O System 2 só explica a urgência final (depois da trava); não decide nem muda nada | Quem decide é o Decision 1, as regras ou a trava. A explicação nunca contradiz a etiqueta |
| O System 2 só é chamado quando o Decision 1 respondeu. Se ele falhou (ou a `LLM_API_KEY` está vazia), fica a frase da regra ou da trava | Com o Decision 1 fora, a Gemini provavelmente também está, e a chamada só gastaria até 8 s e cota. A frase da regra já diz qual palavra decidiu (decisão do Pedro) |
| Resposta inválida: pede de novo uma vez. Erro ou demora de mais de 8 s (contando a nova tentativa): fica o motivo padrão | A classificação nunca falha por causa da frase. O webhook roda em segundo plano, então 8 s não atrasam o gatilho |
| Sem "thinking" no 2.5 Flash (`thinking_budget = 0`) e temperatura 0,2 | O "thinking" vem ligado por padrão e só atrasa uma frase curta. Temperatura baixa deixa a frase presa aos fatos |

## Privacidade

| Decisão | Motivo |
| --- | --- |
| Vão para a Gemini só a descrição e o local da ocorrência. Nome, e-mail, unidade e condomínio nunca vão | Termos da Gemini API (em vigor desde 23/03/2026, <https://aistudio.google.com/docs/terms>): no plano grátis, o Google usa o que é enviado e as respostas "para melhorar e desenvolver" os produtos dele, e "revisores humanos podem ler" esse conteúdo. Os termos pedem para não enviar informação sensível, confidencial ou pessoal. No plano pago, o Google não usa os dados para melhorar produtos e só guarda registros por tempo limitado, contra abuso |

**Em aberto:** a descrição é texto livre do morador e pode conter dados pessoais (um nome, um
telefone). Vale também para o Decision 1 (SQUAD1-84), que manda o mesmo texto. Antes de usar
com moradores reais, o time decide entre o plano pago (projeto do Google Cloud com
faturamento) ou um aviso no formulário de ocorrência.
