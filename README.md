<h1 align="center">📦 StockFlow Nexus</h1>
<h4 align="center">Sistema integrado para gestão de estoque, vendas e processos fiscais</h4>

<div align="center">

![GitHub](https://img.shields.io/badge/Python-3.8+-blue?logo=python)
![GitHub](https://img.shields.io/badge/Flask-2.0+-green?logo=flask)
![GitHub](https://img.shields.io/badge/SQL_Server-2019+-red?logo=microsoft-sql-server)

  <br>
  <img src="https://i.imgur.com/yqc3ONP.png" width="875px" alt="Imagem Principal">
</div>

---

## 🎯 Funcionalidades

### 🔐 Autenticação & Controle de Acesso
- Login com diferenciação de cargos
- Acesso restrito por setor (estoque, vendas, fiscal)

### 📊 Módulos Principais

| Recurso                     | Descrição                                                                                    |
|-----------------------------|----------------------------------------------------------------------------------------------|
| **Consulta de Estoque**     | Filtros avançados + informações detalhadas de produtos e entregas                            |
| **Status de Pedido**        | Visualização colorida com alertas de urgência                                                |
| **Regras Fiscais**          | Automação de cadastro por NCM com múltiplas combinações                                      |
| **Ranking de Vendas**       | Gráficos de desempenho + relatórios automáticos                                              |
| **Consulta CNPJ**           | Integração com API + cadastro automático                                                     |
| **Dashboard de Vendas**     | 3 versões personalizadas (admin/gerente/vendedor) com métricas chave                         |
| **Automação de Relatório**  | Geração automática de PDF com informações da loja e envio diário para contabilidade          |
| **Gerenciador de Entregas** | Pesquisa de pedidos, coleta assinatura digital e gera PDF de confirmação de entrega.         |
| **Vendas por Pix**          | Emissão de QR Code Pix com timer, monitoramento de status e liberação automática de pedidos. |

---

## 📸 Visualizações do Sistema

> ### Dashboard de Vendas

**Resumo:**  

O Dashboard de Vendas centraliza as principais métricas comerciais em uma interface interativa. Destaca-se pelos filtros personalizados (empresa, vendedor, mês e ano), indicadores de performance (orçamentos, venda total, lucro e comissão), gráficos interativos, o de rosca para acompanhar a meta de forma visual e o de barras para acompanhar as vendas em cada dia do mês, além de uma ferramenta de busca detalhada de pedidos. 

Para o código, eu fiz querys otimizadas para exibir as informações que eu queria e utilizei o método GET com os filtros que o Front End tem para funcionar dentro do esperado. O sistema conta com blueprints do flask para organizar as def's e pyodbc para conexão com o banco de dados.

<div align="center">
  <img src="https://i.imgur.com/LPKhjHz.png" width="670px" alt="Dashboard de Vendas">
</div>

> ### Gerenciador de Entregas

**Resumo:**  

O Gerenciador de Entregas centraliza todo o fluxo de conferência e confirmação de entregas em uma interface simples. O usuário do setor de estoque pesquisa pedidos liberados ou “Entregue Part.”, escolhe entre entrega “tudo” (quantidade máxima) ou “parte” (quantidade customizada), preenche nome, telefone e CPF (com validação) do responsável e captura a assinatura digital via tablet antes de confirmar a operação.

Para o código, utilizei rotas GET para /pesquisar e /modal_detalhes e POST para /gerar_pdf. As consultas SQL otimizadas via PyODBC retornam os produtos e quantidades já entregues; no frontend, JavaScript aplica máscaras e validações de CPF/telefone, monta o modal e captura a assinatura em Base64. No backend, a assinatura é decodificada com PIL, o template é renderizado via Jinja2 e o PDF é gerado com pdfkit, tudo em uma transação que atualiza o status da venda e insere os registros de entrega no banco.

<table>
  <tr>
    <td align="center">
      <img src="https://i.imgur.com/Uq5Ud5F.jpeg" width="650px" alt="Consulta Pedido">
    </td>
    <td align="center">
      <img src="https://i.imgur.com/4Gk3AgG.jpeg" width="650px" alt="Relatório de Entrega">
    </td>
  </tr>
</table>

> ### Pagamento via Pix

**Resumo:**  

A Página Pix centraliza a emissão e o acompanhamento de cobranças em QR Code em uma interface prática. O usuário informa o número do pedido, visualiza o QR Code e o “Pix copia e cola” com um contador regressivo de 3 h, e pode cancelar cobranças ativas. Quando o pagamento é confirmado via API, o sistema libera automaticamente o pedido para entrega.

A integração começou no Postman, obtendo o certificado SSL (mTLS) e tokens OAuth2; em produção, as credenciais são descriptografadas em tempo real. As chamadas HTTP usam requests com certificados cliente, e uma thread monitora o status do QR via API do banco. No backend, PyODBC atualiza as tabelas Pix_QR, Venda e FluxoCaixa; no frontend, JavaScript e QRCodeStyling.js geram o código, exibem o timer e controlam ações de cópia e cancelamento.

<table>
  <tr>
    <td align="center">
      <img src="https://i.imgur.com/Ew6ibLy.jpeg" width="650px" alt="Pagamento Pendente">
    </td>
    <td align="center">
      <img src="https://i.imgur.com/3BSSsel.jpeg" width="650px" alt="Pagamento Confirmado">
    </td>
  </tr>
</table>

> ### Regras Fiscais

**Resumo:**<br>

O Módulo Fiscal centraliza a automação do cadastro e a gestão de perfis fiscais, permitindo a geração dinâmica de registros com base em parâmetros essenciais como NCM, CFOP e origens. Com funções otimizadas, o sistema mapeia diversas combinações de tributação – incluindo as variantes de regime normal e simples, finalidades e características específicas – para criar perfis detalhados que atendem aos diferentes cenários fiscais.

Para o código, foram implementadas funções que realizam a consulta do último ID, a criação de registros por meio de mapeamentos precisos e a inserção automatizada dos dados no banco utilizando pyodbc. A integração com o frontend se dá por meio de rotas REST em Flask, permitindo a pré-visualização em tempo real dos dados gerados em formato de tabela, garantindo que os usuários possam revisar e confirmar as informações antes da inserção definitiva. Este módulo robusto assegura consistência, agilidade e confiabilidade nos processos fiscais do sistema.

<div align="center">
  <img src="https://i.imgur.com/3HJDiM3.png" width="670px" alt="Regras Fiscais">
</div>

Por exemplo:
- **73181900 - A R S 2 5405**
  - **73181900**: Código NCM
  - **A**: Tipo do Cliente
  - **R**: Tipo de Mercadoria
  - **S**: Indicador de Simples Nacional
  - **2**: Origem
  - **5405**: CFOP

### Como funciona:

1. **NCM**: Código que identifica a classificação fiscal da mercadoria.
2. **Tipo do Cliente**: Define o perfil do cliente que será atendido.
3. **Tipo de Mercadoria**: Especifica se a mercadoria é para revenda, insumo ou uso/consumo imobilizado.
4. **Simples Nacional**: Indicador que define se a operação se enquadra no regime do Simples Nacional.
5. **Origem**: Representa a origem da mercadoria.
6. **CFOP**: Código Fiscal de Operações e Prestações.

<table style="border-collapse: collapse; border: none;">
  <tr>
    <td style="vertical-align: top; border: none;">
      <h3>Tabela de Tipos de Cliente</h3>
      <table>
        <tr>
          <th>Código</th>
          <th>Descrição</th>
        </tr>
        <tr>
          <td>A</td>
          <td>Atacadista</td>
        </tr>
        <tr>
          <td>D</td>
          <td>Distribuidor</td>
        </tr>
        <tr>
          <td>PF</td>
          <td>Pessoa Física</td>
        </tr>
        <tr>
          <td>PJ</td>
          <td>Pessoa Jurídica não contribuinte do ICMS</td>
        </tr>
        <tr>
          <td>V</td>
          <td>Varejista</td>
        </tr>
      </table>
    </td>
    <td style="vertical-align: top; border-left: 1px solid #000; padding-left: 10px; border: none;">
      <h3>Tabela de Tipos de Mercadoria</h3>
      <table>
        <tr>
          <th>Código</th>
          <th>Descrição</th>
        </tr>
        <tr>
          <td>R</td>
          <td>Revenda</td>
        </tr>
        <tr>
          <td>I</td>
          <td>Insumo</td>
        </tr>
        <tr>
          <td>U</td>
          <td>Uso e Consumo Imobilizado</td>
        </tr>
      </table>
    </td>
  </tr>
</table>


> **Nota:** A utilização do **pandas** permite a manipulação eficiente dos dados fiscais, possibilitando a geração dinâmica e a pré-visualização dos perfis fiscais antes da inserção no banco de dados. <br>

>### Relatórios Gerados

A funcionalidade de relatórios do sistema é responsável por extrair, compilar e apresentar os dados de vendas de forma clara e objetiva. A seguir, um resumo superficial de como o processo funciona:

- **Consulta e Agregação de Dados:**  
  Utiliza-se **PyODBC** para conectar ao **SQL Server 2019+** e executar consultas SQL otimizadas com **CTEs** (Common Table Expressions) para o sistema funcionar da melhor maneira. 

- **Renderização e Geração de PDF:**  
  Após coletar os dados, o sistema utiliza o **Jinja2** para renderizar um template HTML (com suporte de **HTML5/CSS3**), que é posteriormente convertido em um arquivo PDF por meio do **PDFKit**. Esse PDF serve como um relatório completo e visualmente estruturado.

- **Automação e Envio de E-mail:**  
  A automação é implementada usando as bibliotecas **Schedule** e **Threading**, que agendam e executam a geração dos relatórios em horários predefinidos. Uma vez gerado, o relatório é enviado automaticamente via e-mail utilizando o **SMTPLib**, permitindo o envio de anexos (os relatórios em PDF) para os destinatários cadastrados.

<table>
  <tr>
    <td align="center">
      <img src="https://i.imgur.com/rCnyWof.png" width="650px" alt="Relatório Diário">
    </td>
    <td align="center">
      <img src="https://i.imgur.com/m0PxsSV.png" width="650px" alt="Relatório Mensal">
    </td>
  </tr>
</table>

> **Nota:** Todos os dados exibidos nas imagens são **Fictícios**, gerados por mim apenas para visualização para demonstrar a funcionalidade do sistema
---

### Tecnologias Utilizadas

| Categoria            | Tecnologias                                                   |
|----------------------|---------------------------------------------------------------|
| **Renderização**     | PDFKit, Jinja2, HTML5/CSS3                                    |
| **Dados**            | SQL Server 2019+, PyODBC, CTEs                                |
| **Automação**        | Schedule, Threading, SMTPLib                                  |
| **API & Ferramentas**| Postman, REST API, Requests, mTLS (SSL cliente)               |
| **Backend**          | Python 3.8+, Flask 2.x                                        |
| **Frontend**         | JavaScript, Canvas API, QRCodeStyling.js                      |
| **Segurança**        | AES‑256 (dupla chave), SSL/TLS mTLS, descriptografia dinâmica |

---

## 📈 Impacto Operacional

- **Automação de Regras Fiscais:**  
  Cadastrar regra fiscal manualmente leva cerca de 2 minutos por registro. Com o nosso sistema, é possível cadastrar 30+ regras em minutos, otimizando o tempo e reduzindo erros.

- **Produtividade de Vendas:**  
  Os vendedores podem acompanhar seu desempenho em tempo real, o que resultou em um aumento de aproximadamente 26% na produtividade da equipe.

- **Gestão de Estoque:**  
  A facilidade de conferência do estoque eliminou problemas recorrentes, garantindo maior eficiência e precisão no controle.

- **Entrega de Produtos:**  
  A geração de entregas com assinatura digital automatizou o processo e eliminou a necessidade de impressão de formulários, economizando tempo e recursos.

- **Pagamentos via PIX:**  
  O processo de emissão, monitoramento e confirmação automática de QR Codes reduziu fraudes e liberou os pedidos de forma mais rápida e segura.

| Funcionalidade            | Benefício Direto                             | Impacto Mensurável                     |
|---------------------------|----------------------------------------------|----------------------------------------|
| Consulta CNPJ             | Redução de 70% no tempo de cadastro          | +150 clientes cadastrados/dia          |
| Ranking de Vendas         | Aumento de 25% na produtividade da equipe    | 100% de precisão em comissões          |
| Relatório Automático      | Entregas 100% dentro do prazo legal          | Redução em inconsistências             |
| Geração de regra fiscal   | Erros minimizados no registro                | 15h/mês economizadas em análises       |
| Entrega de Produtos       | Processo 100% digital e rastreável           | ≈250 folhas/dia economizadas           |
| Pagamentos via PIX        | Liberação automática e segura de pedidos     | Redução de fraudes e validações manuais|

---

## 🗂 Estrutura do Projeto

```plaintext
StockFlowNexus/
├── config/
│   ├── credenciais.enc.json   # Credenciais criptografadas
│   ├── chave1                 # Chave primária AES-256
│   └── chave2                 # Chave secundária AES-256
│
├── blueprints/                # Módulos funcionais
│   ├── auth.py               🔐 Autenticação
│   ├── estoque.py            📦 Gestão de estoque
│   ├── dashboard.py          📊 Módulo de analytics
│   ... 
├── services/
│   ├── database.py           🗃 Conexão SQL Server
│   └── encryption.py         🔑 Sistema de criptografia
│
└── static/                   🎨 Assets frontend
    ├── css/                  🎨 Estilos globais
    └── js/                   🛠 Scripts principais
```
