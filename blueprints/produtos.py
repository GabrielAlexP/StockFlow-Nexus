from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc

produtos_bp = Blueprint('produtos', __name__)

@produtos_bp.route('/produtos')
def produtos():
    return render_template('produtos.html')

@produtos_bp.route('/api/produtos', methods=['GET'])
def get_produtos():
    search_value = request.args.get('searchValue')
    tipoBusca = request.args.get('tipoBusca')
    empresa = request.args.get('empresa')
    marca = request.args.get('marca')
    ativo = request.args.get('ativo')  # Filtro para ativo/inativo

    def format_price(value):
        if value is None:
            return None
        try:
            num = float(value)
        except ValueError:
            return None
        if num.is_integer():
            return str(int(num))
        else:
            return f"{num:.2f}".replace(".", ",")

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        # Consulta principal dos produtos
        if tipoBusca == 'codigo':
            if marca:
                query_produto = """
                SELECT 
                    E.ID, 
                    E.DescProduto, 
                    E.CodBarra, 
                    E.Altura, 
                    E.Largura, 
                    E.PESOBRUTO, 
                    E.CF, 
                    E.Marca, 
                    D.PreçoMinimo, 
                    D.CustoMedio, 
                    D.Ativo_SC, 
                    D.EstAtual,
                    D.PontoPed AS [Est. Minimo],
                    D.EstMax AS [Est. Máximo],
                    E.UniMedida,
                    PP.Valor as PreçoTabela
                FROM Estoque E
                LEFT JOIN DetEstoque D ON D.IDProduto = E.ID AND D.IDEmpresa = ?
                LEFT JOIN Preço_Produto PP ON PP.IDProduto = E.ID AND PP.IDEmpresa = ?
                WHERE E.ID = ? AND E.MARCA = ?
                """
                params = (empresa, empresa, search_value, marca)
                if ativo:
                    query_produto += " AND D.Ativo_SC = ?"
                    params = params + (ativo,)
                cursor.execute(query_produto, params)
            else:
                query_produto = """
                SELECT 
                    E.ID, 
                    E.DescProduto, 
                    E.CodBarra, 
                    E.Altura, 
                    E.Largura, 
                    E.PESOBRUTO, 
                    E.CF, 
                    E.Marca,
                    D.PreçoMinimo, 
                    D.CustoMedio, 
                    D.Ativo_SC, 
                    D.EstAtual,
                    D.PontoPed AS [Est. Minimo],
                    D.EstMax AS [Est. Máximo],
                    E.UniMedida,
                    PP.Valor as PreçoTabela
                FROM Estoque E
                LEFT JOIN DetEstoque D ON D.IDProduto = E.ID AND D.IDEmpresa = ?
                LEFT JOIN Preço_Produto PP ON PP.IDProduto = E.ID AND PP.IDEmpresa = ?
                WHERE E.ID = ?
                """
                params = (empresa, empresa, search_value)
                if ativo:
                    query_produto += " AND D.Ativo_SC = ?"
                    params = params + (ativo,)
                cursor.execute(query_produto, params)
        else:
            if marca:
                query_produto = """
                SELECT 
                    E.ID, 
                    E.DescProduto, 
                    E.CodBarra, 
                    E.Altura, 
                    E.Largura, 
                    E.PESOBRUTO, 
                    E.CF, 
                    E.Marca, 
                    D.PreçoMinimo, 
                    D.CustoMedio, 
                    D.Ativo_SC, 
                    D.EstAtual,
                    D.PontoPed AS [Est. Minimo],
                    D.EstMax AS [Est. Máximo],
                    E.UniMedida,
                    PP.Valor as PreçoTabela
                FROM Estoque E
                LEFT JOIN DetEstoque D ON D.IDProduto = E.ID AND D.IDEmpresa = ?
                LEFT JOIN Preço_Produto PP ON PP.IDProduto = E.ID AND PP.IDEmpresa = ?
                WHERE E.DescProduto LIKE ? AND E.MARCA = ?
                """
                params = (empresa, empresa, '%' + search_value + '%', marca)
                if ativo:
                    query_produto += " AND D.Ativo_SC = ?"
                    params = params + (ativo,)
                cursor.execute(query_produto, params)
            else:
                query_produto = """
                SELECT 
                    E.ID, 
                    E.DescProduto, 
                    E.CodBarra, 
                    E.Altura, 
                    E.Largura, 
                    E.PESOBRUTO, 
                    E.CF, 
                    E.Marca,
                    D.PreçoMinimo, 
                    D.CustoMedio, 
                    D.Ativo_SC, 
                    D.EstAtual,
                    D.PontoPed AS [Est. Minimo],
                    D.EstMax AS [Est. Máximo],
                    E.UniMedida,
                    PP.Valor as PreçoTabela
                FROM Estoque E
                LEFT JOIN DetEstoque D ON D.IDProduto = E.ID AND D.IDEmpresa = ?
                LEFT JOIN Preço_Produto PP ON PP.IDProduto = E.ID AND PP.IDEmpresa = ?
                WHERE E.DescProduto LIKE ?
                """
                params = (empresa, empresa, '%' + search_value + '%')
                if ativo:
                    query_produto += " AND D.Ativo_SC = ?"
                    params = params + (ativo,)
                cursor.execute(query_produto, params)

        produtos_data = cursor.fetchall()
        resultados = []

        for row in produtos_data:
            produto = {
                'ID': row[0],
                'DescProduto': row[1],
                'CodBarra': row[2],
                'Altura': row[3],
                'Largura': row[4],
                'Peso': row[5],
                'NCM': row[6],
                'Marca': row[7],
                'PreçoMinimo': format_price(row[8]),
                'CustoMedio': format_price(row[9]),
                'ativo': row[10],
                'EstoqueAtual': row[11],
                'EstMinimo': format_price(row[12]),  # Estoque Mínimo (PontoPed)
                'EstMaximo': format_price(row[13]),   # Estoque Máximo (EstMax)
                'UniMedida': row[14],
                'PreçoTabela': format_price(row[15])
            }
            resultados.append(produto)

        # Consulta para trazer os dados da última compra
        if tipoBusca == 'codigo':
            query_ultima_compra = """
            WITH ProdutosRecente AS (
                SELECT 
                    DataReg, 
                    Qtd, 
                    ManterCusto, 
                    IDProduto,
                    ROW_NUMBER() OVER (PARTITION BY IDProduto ORDER BY DataReg DESC) AS RowNum
                FROM DetCompras
                WHERE IDEmpresa = ?
                  AND IDProduto = ?
                  AND Status = 'F'
                  AND DataReg <= GETDATE()
            )
            SELECT DataReg, Qtd, ManterCusto, IDProduto
            FROM ProdutosRecente
            WHERE RowNum = 1;
            """
            params_ultima = (empresa, search_value)
        else:
            query_ultima_compra = """
            WITH ProdutosRecente AS (
                SELECT 
                    DataReg, 
                    Qtd, 
                    ManterCusto, 
                    IDProduto,
                    ROW_NUMBER() OVER (PARTITION BY IDProduto ORDER BY DataReg DESC) AS RowNum
                FROM DetCompras
                WHERE IDEmpresa = ?
                  AND IDProduto IN (SELECT ID FROM Estoque WHERE DescProduto LIKE ?)
                  AND Status = 'F'
                  AND DataReg <= GETDATE()
            )
            SELECT DataReg, Qtd, ManterCusto, IDProduto
            FROM ProdutosRecente
            WHERE RowNum = 1;
            """
            params_ultima = (empresa, '%' + search_value + '%')

        cursor.execute(query_ultima_compra, params_ultima)
        ultima_rows = cursor.fetchall()
        ultima_map = {}
        for row in ultima_rows:
            # row[0]: DataReg, row[1]: Qtd, row[2]: ManterCusto, row[3]: IDProduto
            data_reg = row[0]
            if data_reg:
                try:
                    data_str = data_reg.strftime('%d/%m/%Y')
                except Exception:
                    data_str = str(data_reg)
            else:
                data_str = None
            ultima_map[row[3]] = {
                'DataUltimaCompra': data_str,
                'QtdUltimaCompra': row[1],
                'CustoUltimaCompra': format_price(row[2])
            }

        # Incorpora as informações da última compra a cada produto
        for produto in resultados:
            prod_id = produto['ID']
            if prod_id in ultima_map:
                produto.update(ultima_map[prod_id])
            else:
                produto.update({
                    'DataUltimaCompra': None,
                    'QtdUltimaCompra': None,
                    'CustoUltimaCompra': None
                })

        # Atualização dos valores relacionados a vendas e estoque físico
        vendido_query = """
        SELECT 
            PV.IDProduto AS Codigo,
            COALESCE(SUM(PV.Quantidade), 0) - COALESCE(SUM(DER.QuantidadeEntregue), 0) AS Vendido
        FROM
            (SELECT IDProduto, SUM(Quantidade) AS Quantidade
             FROM Produto_Venda
             WHERE IDEmpresa = ?
             AND Pedido IN (
                 SELECT Pedido
                 FROM Venda
                 WHERE IDEmpresa = ?
                 AND SITUAÇÃO IN ('Liberado', 'Entregue part.')
                 AND STATUS = 'V'
                 AND DESATIVO = 'False'
             )
             GROUP BY IDProduto) PV
        LEFT JOIN 
            (SELECT IDProduto, SUM(Qtd) AS QuantidadeEntregue
             FROM DetEntrega_Romaneio
             WHERE IDEmpresa = ?
             AND Pedido IN (
                 SELECT Pedido
                 FROM Venda
                 WHERE IDEmpresa = ?
                 AND SITUAÇÃO IN ('Liberado', 'Entregue part.')
                 AND STATUS = 'V'
                 AND DESATIVO = 'False'
             )
             GROUP BY IDProduto) DER
        ON PV.IDProduto = DER.IDProduto
        GROUP BY PV.IDProduto
        HAVING (COALESCE(SUM(PV.Quantidade), 0) - COALESCE(SUM(DER.QuantidadeEntregue), 0)) != 0
        """
        vendido_params = (empresa, empresa, empresa, empresa)
        cursor.execute(vendido_query, vendido_params)
        vendido_rows = cursor.fetchall()
        vendido_map = {}
        for row in vendido_rows:
            codigo = row[0]
            vendido_val = float(row[1])
            vendido_map[codigo] = vendido_val

        for produto in resultados:
            codigo = produto['ID']
            vendido = vendido_map.get(codigo, 0)
            produto['Vendido'] = vendido
            try:
                estoque = float(produto['EstoqueAtual'])
            except Exception:
                estoque = 0
            produto['EstoqueFisico'] = estoque + vendido

        conn.close()
        return jsonify(resultados)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@produtos_bp.route('/api/uniMedidas', methods=['GET'])
def get_uni_medidas():
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        query = "SELECT Descricao FROM Cad_UniMedida"
        cursor.execute(query)
        rows = cursor.fetchall()
        uni_medidas = [row[0] for row in rows]
        conn.close()
        return jsonify(uni_medidas)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@produtos_bp.route('/api/update_produtos', methods=['POST'])
def update_produtos():
    """
    Endpoint para processar as atualizações realizadas na interface.
    O JSON recebido deverá ter a seguinte estrutura:
    {
        "empresa": "ID da empresa",
        "updates": [
            {
                "ID": "Código do produto",
                "DescProduto": "novo valor",         # Tabela Estoque, coluna DescProduto
                "UniMedida": "novo valor",            # Tabela Estoque, coluna UniMedida
                "CodBarra": "novo valor",             # Tabela Estoque, coluna CodBarra
                "CustoMedio": "novo valor",           # Tabela DetEstoque, coluna CustoMedio
                "PreçoMinimo": "novo valor",          # Tabela DetEstoque, coluna PreçoMinimo
                "EstMinimo": "novo valor",            # Tabela DetEstoque, coluna PontoPed
                "EstMaximo": "novo valor",            # Tabela DetEstoque, coluna EstMax
                "PreçoTabela": "novo valor",          # Tabela Preço_Produto, coluna Valor (Tabela=1)
                "ativo": true/false,                  # Tabela DetEstoque, coluna Ativo_SC
                "Altura": "novo valor",               # Tabela Estoque, coluna Altura
                "Largura": "novo valor",              # Tabela Estoque, coluna Largura
                "Peso": "novo valor",                 # Tabela Estoque, coluna PESOBRUTO
                "NCM": "novo valor",                  # Tabela Estoque, coluna CF
                "Marca": "novo valor"                 # Tabela Estoque, coluna Marca (código da marca)
            },
            ...
        ]
    }
    Apenas as colunas alteradas em cada objeto serão atualizadas.
    Valores decimais deverão ser enviados com ponto (ex.: 1.5) e sem formatação monetária.
    """
    data = request.get_json()
    empresa = data.get('empresa')
    updates = data.get('updates', [])
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        for produto in updates:
            prod_id = produto.get('ID')
            
            # Atualizações na tabela Estoque
            estoque_fields = {}
            if 'DescProduto' in produto:
                estoque_fields['DescProduto'] = produto['DescProduto']
            if 'UniMedida' in produto:
                estoque_fields['UniMedida'] = produto['UniMedida']
            if 'CodBarra' in produto:
                estoque_fields['CodBarra'] = produto['CodBarra']
            if 'Altura' in produto:
                altura = produto['Altura']
                if isinstance(altura, str):
                    altura = altura.replace(",", ".")
                estoque_fields['Altura'] = altura
            if 'Largura' in produto:
                largura = produto['Largura']
                if isinstance(largura, str):
                    largura = largura.replace(",", ".")
                estoque_fields['Largura'] = largura
            if 'Peso' in produto:
                peso = produto['Peso']
                if isinstance(peso, str):
                    peso = peso.replace(",", ".")
                estoque_fields['PESOBRUTO'] = peso
            if 'NCM' in produto:
                estoque_fields['CF'] = produto['NCM']
            if 'Marca' in produto:
                estoque_fields['Marca'] = produto['Marca']
            if estoque_fields:
                set_clause = ", ".join([f"{k} = ?" for k in estoque_fields.keys()])
                values = list(estoque_fields.values())
                values.append(prod_id)
                query = f"UPDATE Estoque SET {set_clause} WHERE ID = ?"
                cursor.execute(query, values)
            
            # Atualizações na tabela DetEstoque
            det_fields = {}
            if 'CustoMedio' in produto:
                custo = produto['CustoMedio']
                if isinstance(custo, str):
                    custo = custo.replace(",", ".")
                det_fields['CustoMedio'] = custo
            if 'PreçoMinimo' in produto:
                preco_min = produto['PreçoMinimo']
                if isinstance(preco_min, str):
                    preco_min = preco_min.replace(",", ".")
                det_fields['PreçoMinimo'] = preco_min
            # Atualizações para Estoque Mínimo e Máximo
            if 'EstMinimo' in produto:
                est_min = produto['EstMinimo']
                if isinstance(est_min, str):
                    est_min = est_min.replace(",", ".")
                det_fields['PontoPed'] = est_min
            if 'EstMaximo' in produto:
                est_max = produto['EstMaximo']
                if isinstance(est_max, str):
                    est_max = est_max.replace(",", ".")
                det_fields['EstMax'] = est_max
            if 'ativo' in produto:
                det_fields['Ativo_SC'] = 1 if produto['ativo'] in [True, 1, "1"] else 0
            if det_fields:
                set_clause = ", ".join([f"{k} = ?" for k in det_fields.keys()])
                values = list(det_fields.values())
                values.extend([empresa, prod_id])
                query = f"UPDATE DetEstoque SET {set_clause} WHERE IDEmpresa = ? AND IDProduto = ?"
                cursor.execute(query, values)
            
            # Atualizações na tabela Preço_Produto (para Preço de Tabela)
            if 'PreçoTabela' in produto:
                preco_tabela = produto['PreçoTabela']
                if isinstance(preco_tabela, str):
                    preco_tabela = preco_tabela.replace("R$", "").strip().replace(",", ".")
                query = "UPDATE Preço_Produto SET Valor = ? WHERE IDProduto = ? AND Tabela = 1 AND IDEmpresa = ?"
                params = (preco_tabela, prod_id, empresa)
                cursor.execute(query, params)
        
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500