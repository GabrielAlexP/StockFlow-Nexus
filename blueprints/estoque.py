from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc

estoque_bp = Blueprint('estoque', __name__)

@estoque_bp.route('/estoque')
def estoque():
    return render_template('estoque.html')

@estoque_bp.route('/api/consulta', methods=['GET'])
def consulta():
    try:
        filtro = request.args.get('filtro')
        valor = request.args.get('valor')
        ativos = request.args.get('ativos')
        marca = request.args.get('marca')  
        empresaId = request.args.get('empresaId')  

        if filtro == 'description':
            coluna = 'DescProduto'
            valor_query = f'%{valor}%'
        elif filtro == 'code':
            coluna = 'ID'
            valor_query = valor
        elif filtro == 'barcode':
            coluna = 'CodBarra'
            valor_query = f'%{valor}%'
        else:
            return jsonify({'error': 'Filtro inválido'}), 400

        query = f"""
            SELECT ESTOQUE.*, DetEstoque.*
            FROM ESTOQUE
            LEFT JOIN DetEstoque ON ESTOQUE.ID = DetEstoque.IDProduto
            WHERE {coluna} LIKE ?
        """
        parametros = [valor_query]

        if ativos == 'ativo':
            query += " AND DetEstoque.Ativo_SC = ?"
            parametros.append('True')
        elif ativos == 'inativo':
            query += " AND DetEstoque.Ativo_SC = ?"
            parametros.append('False')

        if marca and marca != "all": 
            query += " AND ESTOQUE.Marca = ?"
            parametros.append(marca)

        if empresaId:
            query += " AND DetEstoque.IDEmpresa = ?"
            parametros.append(empresaId)

        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute(query, parametros)
        resultados = cursor.fetchall()
        conn.close()

        resultados_json = []
        for row in resultados:
            row_dict = {}
            for idx, col in enumerate(cursor.description):
                value = row[idx]
                if isinstance(value, bytes):
                    value = value.decode('latin-1')
                row_dict[col[0]] = value
            resultados_json.append(row_dict)

        return jsonify(resultados_json)

    except Exception as e:
        return jsonify({'error': f'Erro ao realizar a consulta: {str(e)}'}), 500

@estoque_bp.route('/api/marcas', methods=['GET'])
def marcas():
    try:
        query = "SELECT Codigo, Descricao FROM Cad_Marca_Prod WHERE Ativo = 'True'"
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute(query)
        resultados = cursor.fetchall()
        conn.close()

        marcas_json = [{'Codigo': row[0], 'Descricao': row[1]} for row in resultados]
        return jsonify(marcas_json)
    
    except Exception as e:
        return jsonify({'error': 'Erro ao carregar as marcas'}), 500

@estoque_bp.route('/api/detalhes', methods=['GET'])
def detalhes_produto():
    try:
        id_produto = request.args.get('id')
        id_empresa = request.args.get('empresaId')
        if not id_produto or not id_empresa:
            return jsonify({'error': 'ID do produto e empresaId são necessários'}), 400
        query = """
            SELECT EstAtual, Ativo
            FROM DetEstoque
            LEFT JOIN Estoque ON DetEstoque.IDProduto = Estoque.ID
            WHERE DetEstoque.IDProduto = ? AND DetEstoque.IDEmpresa = ?
        """
        query_data_ultimo_inventario = """
            SELECT DataUltimoInventario 
            FROM DetEstoque 
            WHERE IDProduto = ? AND IDEmpresa = ?
        """
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute(query, (id_produto, id_empresa))
        resultado = cursor.fetchone()
        cursor.execute(query_data_ultimo_inventario, (id_produto, id_empresa))
        resultado_data_ultimo_inventario = cursor.fetchone()
        conn.close()
        if not resultado:
            return jsonify({'error': 'Produto não encontrado'}), 404
        est_atual = float(resultado[0]) if resultado[0] is not None else 0.0
        ativo = bool(resultado[1])
        data_ultimo_inventario_formatada = (
            resultado_data_ultimo_inventario[0].strftime('%d/%m/%Y')
            if resultado_data_ultimo_inventario and resultado_data_ultimo_inventario[0]
            else "Não disponível"
        )
        return jsonify({
            'EstAtual': est_atual,
            'Ativo': ativo,
            'DataUltimoInventario': data_ultimo_inventario_formatada
        })
    except Exception as e:
        return jsonify({'error': f'Erro ao buscar detalhes do produto: {str(e)}'}), 500

@estoque_bp.route('/api/produtos_pendentes', methods=['POST'])
def produtos_pendentes():
    try:
        data = request.get_json()
        id_empresa = data.get('IDEmpresa')
        if not id_empresa:
            return jsonify({'error': 'IDEmpresa é necessário'}), 400
        query_pedidos = """
            SELECT Pedido 
            FROM Venda
            WHERE Situação IN ('Entregue Part.', 'Liberado') AND IDEmpresa = ? AND STATUS = 'V';
        """
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute(query_pedidos, (id_empresa,))
        pedidos = [row[0] for row in cursor.fetchall()]
        if not pedidos:
            return jsonify({'produtos_pendentes': []}), 200
        placeholders = ','.join(['?'] * len(pedidos))
        query_produto_venda = f"""
            SELECT Pedido, IDProduto, SUM(Quantidade) AS Quantidade
            FROM Produto_Venda
            WHERE Pedido IN ({placeholders}) AND IDEmpresa = ?
            GROUP BY Pedido, IDProduto
        """
        query_detentrega_romaneio = f"""
            SELECT Pedido, IDProduto, SUM(Qtd) AS Qtd
            FROM DetEntrega_Romaneio
            WHERE Pedido IN ({placeholders}) AND IDEmpresa = ?
            GROUP BY Pedido, IDProduto
        """
        cursor.execute(query_produto_venda, (*pedidos, id_empresa))
        produto_venda_resultados = cursor.fetchall()
        cursor.execute(query_detentrega_romaneio, (*pedidos, id_empresa))
        detentrega_romaneio_resultados = cursor.fetchall()
        produto_venda_dict = {}
        for row in produto_venda_resultados:
            pedido, id_produto, quantidade = row
            if pedido not in produto_venda_dict:
                produto_venda_dict[pedido] = {}
            produto_venda_dict[pedido][id_produto] = quantidade
        detentrega_romaneio_dict = {}
        for row in detentrega_romaneio_resultados:
            pedido, id_produto, qtd = row
            if pedido not in detentrega_romaneio_dict:
                detentrega_romaneio_dict[pedido] = {}
            detentrega_romaneio_dict[pedido][id_produto] = qtd
        pendentes = []
        for pedido, produtos in produto_venda_dict.items():
            for id_produto, quantidade in produtos.items():
                quantidade_entregue = detentrega_romaneio_dict.get(pedido, {}).get(id_produto, 0)
                quantidade_pendente = quantidade - quantidade_entregue
                if quantidade_pendente > 0:
                    pendentes.append({
                        'IDProduto': id_produto,
                        'Pedido': pedido,
                        'QuantidadePendente': quantidade_pendente
                    })
        produtos_pendentes_info = []
        for produto in pendentes:
            cursor.execute(f"""
                SELECT Pedido, NomeCliente, DataVenda, Situação
                FROM Venda
                WHERE Pedido = ? AND IDEmpresa = ?
            """, (produto['Pedido'], id_empresa))
            for row in cursor.fetchall():
                produtos_pendentes_info.append({
                    "IDProduto": produto['IDProduto'],
                    "QuantidadePendente": produto['QuantidadePendente'],
                    "Pedido": row.Pedido,
                    "Cliente": row.NomeCliente,
                    "DataVenda": row.DataVenda.strftime('%Y-%m-%d %H:%M:%S'),
                    "Situação": row.Situação
                })
        conn.close()
        return jsonify({'produtos_pendentes': produtos_pendentes_info})
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        return jsonify({'error': 'Erro ao calcular produtos pendentes'}), 500