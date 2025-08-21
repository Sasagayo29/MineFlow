# 🟫 MineFlow

**MineFlow** é uma aplicação web interativa que transforma dados de planilhas Excel (.xlsx) em fluxos de decisão visuais e navegáveis, com suporte a lógica condicional, envio de e-mails e visualização em diagrama usando [Mermaid.js](https://mermaid-js.github.io/).

O projeto foi desenvolvido com foco em fluxos de ocorrências, processos operacionais ou fluxos de trabalho em empresas, como no contexto da mineração.

---

## 🚀 Funcionalidades

- 📁 Upload de arquivos Excel contendo o fluxo de decisão
- 🧠 Interpretação de passos com lógica direta, decisões (Sim/Não) e finais
- 📬 Geração de botões para envio de e-mails com destinatários e mensagens pré-configuradas
- 📊 Visualização completa do fluxo em formato de diagrama (Mermaid)
- 📱 Design responsivo e adaptado a dispositivos móveis

---

## 📂 Estrutura esperada do Excel

Para funcionar corretamente, o Excel deve conter as seguintes colunas:

| Coluna             | Descrição                                                  |
|--------------------|------------------------------------------------------------|
| ID                 | Identificador único do passo                               |
| Título do Passo    | Título exibido no passo                                    |
| Descrição          | Descrição detalhada do passo                               |
| Tipo               | Pode ser `direto`, `decisao` ou `final`                    |
| Próximo Direto     | (para `direto`) ID do próximo passo                        |
| Próximo Sim        | (para `decisao`) ID do passo se resposta for "Sim"         |
| Próximo Não        | (para `decisao`) ID do passo se resposta for "Não"         |
| Email Para         | (opcional) Endereço(s) de e-mail para envio automático     |
| Email CC           | (opcional) Cópia oculta                                    |
| Assunto Email      | (opcional) Assunto do e-mail                               |

---

## 🛠️ Tecnologias Utilizadas

- HTML5 + CSS3 + JavaScript
- [Mermaid.js](https://mermaid-js.github.io/) – para gerar diagramas dinâmicos
- [SheetJS (XLSX)](https://sheetjs.com/) – para leitura de arquivos Excel
- [Font Awesome](https://fontawesome.com/) – ícones visuais
- Responsividade com design mobile-first

---

## ▶️ Como Usar

1. Faça o clone do repositório:
   ```bash
   git clone https://github.com/seu-usuario/mineflow.git

2.  Abra o arquivo index.html no navegador.
3.  Faça o upload do seu arquivo Excel com os dados do fluxo.
4.  Navegue pelos passos, tome decisões e visualize o fluxo completo com um clique.

## 🖼️ Exemplo de Visualização
<img width="955" height="940" alt="image" src="https://github.com/user-attachments/assets/b0837223-8428-412e-8786-e8a3042bbc83" />


## 🏢 Sobre

Este projeto foi desenvolvido com foco em aplicações industriais e empresariais, como parte de iniciativas de digitalização de processos na área de mineração (Kinross Paracatu). Mas podendo também ser utlizado em qualquer outro seguimento.

## 📧 Contato

Se tiver dúvidas ou sugestões, sinta-se à vontade para abrir uma issue ou entrar em contato.
