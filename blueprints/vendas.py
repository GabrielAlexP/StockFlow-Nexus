from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc

venda_bp = Blueprint('venda', __name__)

@venda_bp.route('/venda')
def venda():
    return render_template('venda.html')

@venda_bp.route('/api/vendas')
def get_vendas():
    empresa = request.args.get('empresa')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')

    # Caso algum parâmetro esteja ausente, retorna uma lista vazia
    if not empresa or not data_inicio or not data_fim:
        return jsonify([])

    query = """
    SELECT 
        PV.IDProduto AS Codigo, 
        PV.Descrição, 
        SUM(PV.Quantidade) AS Quantidade, 
        SUM(PV.Quantidade * PV.Valor) / SUM(PV.Quantidade) AS MediaPreco,
        (SELECT DE.EstAtual 
         FROM DetEstoque DE 
         WHERE DE.IDProduto = PV.IDProduto 
         AND DE.IDEmpresa = ?) AS Estoque 
    FROM PRODUTO_VENDA PV
    WHERE PV.PEDIDO IN (
        SELECT P.Pedido 
        FROM Venda P
        WHERE P.IDEmpresa = ? 
        AND P.DataVenda BETWEEN ? AND ? 
        AND P.DESATIVO = 'False' 
        AND P.Status = 'V'
    ) 
    AND PV.IDEmpresa = ? 
    GROUP BY PV.IDProduto, PV.Descrição
    ORDER BY PV.IDProduto;
    """
    
    try:
        # Conecta ao banco de dados
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        # Os parâmetros são passados na ordem: para o subselect, para o inner query (IDEmpresa e datas) e para a condição externa
        cursor.execute(query, (empresa, empresa, data_inicio, data_fim, empresa))
        
        # Recupera os nomes das colunas
        columns = [column[0] for column in cursor.description]
        
        # Cria uma lista de dicionários com os resultados
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        # Retorna os resultados em formato JSON
        return jsonify(results)
    
    except Exception as e:
        print("Erro ao executar a query:", e)
        return jsonify({'error': str(e)}), 500
