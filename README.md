# StockFlow Nexus

O StockFlow Nexus é um sistema robusto desenvolvido para otimizar funções do dia a dia, integrando-se diretamente com o banco de dados da empresa. Com uma arquitetura modular baseada em Flask e Blueprints, o sistema oferece múltiplas funcionalidades para a gestão de estoque, vendas e processos fiscais, garantindo também um alto nível de segurança por meio da criptografia AES-256.

## Funcionalidades

- **Autenticação e Controle de Acesso**  
  Página de login com diferenciação de cargos, permitindo que usuários de setores específicos (estoque, venda, etc.) acessem apenas as páginas autorizadas.

- **Consulta de Estoque**  
  Permite filtrar produtos por empresa, status, marca, código, descrição e código de barras. Exibe informações detalhadas como quantidade disponível, itens pendentes para entrega, contagem física e dados adicionais do produto (imagem, data da última conferência, etc.), além de informações sobre clientes e entregas pendentes.

- **Status de Pedido**  
  Apresenta todos os pedidos não entregues, diferenciando visualmente (com cores) os tipos de entrega e sinalizando urgência quando a data da venda ultrapassa uma semana.

- **Cadastro de Regras Fiscais**  
  Automatiza a criação de regras fiscais para produtos, filtrando por NCM e combinando informações como CFOP, origem, ICMS, CST e outros, adaptando os cadastros para diferentes tipos de clientes e mercadorias.

- **Ranking de Vendas**  
  Exibe o desempenho dos vendedores com gráficos detalhados, informando as vendas do mês, comissões para administradores, gerentes e supervisores. Gera relatórios diários e mensais automaticamente.

- **Consulta de CNPJ**  
  Utiliza uma API para buscar dados cadastrais de empresas (inscrição estadual, razão social, telefone, endereço, etc.) e permite o cadastro automático no sistema, além de filtrar informações relevantes para a emissão de notas fiscais.

- **Dashboard de Vendas**  
  Disponível em três versões (administrador, gerente e vendedor), o dashboard permite acompanhar o desempenho de vendas com filtros específicos, gráficos detalhados e acompanhamento de metas personalizadas, mostrando dados de desempenho individual ou por equipe.

## Tecnologias Utilizadas

- **Backend:** Python, Flask com Blueprints  
- **Banco de Dados:** SQL Server (conexão via pyodbc)  
- **Segurança:** Criptografia AES-256 (utiliza duas chaves para descriptografar as credenciais)  
- **Frontend:** HTML, CSS e JavaScript (arquivos presentes nas pastas `templates` e `static`)

## Estrutura do Projeto

```plaintext
StockFlow Nexus
├── config
│   ├── credenciais.enc.json
│   ├── chave1
│   └── chave2
├── services
│   ├── database.py         # Gera a conexão com o banco de dados
│   └── encryption.py       # Gerencia a descriptografia das credenciais
├── blueprints              # Contém os módulos de cada página/funcionalidade
│   ├── auth.py
│   ├── estoque.py
│   ├── status.py
│   ├── ranking.py
│   ├── cnpj.py
│   ├── fiscal.py
│   └── dashboard          # Inclui admin, gerente e vendedor
├── static
│   ├── js
│   └── css
├── templates              # Arquivos HTML das páginas
│   ├── login.html
│   ├── portal.html
│   └── outros arquivos
└── app.py                 # Aplicativo central
