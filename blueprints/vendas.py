from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc
from datetime import date

venda_bp = Blueprint('venda', __name__)

@venda_bp.route('/venda')
def venda():
    return render_template('venda.html')

@venda_bp.route('/api/vendas')
def get_vendas():
    empresa = request.args.get('empresa')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')

    if not empresa or not data_inicio or not data_fim:
        return jsonify([])

    query = """
    SELECT 
        q2.Codigo, 
        q2.Descrição, 
        q2.Quantidade, 
        q2.MediaPreco, 
        q2.Estoque, 
        q2.DataUltimoInventario,
        COALESCE(q1.Quantidade_Residual, 0) + COALESCE(q2.Estoque, 0) AS EstoqueFisico
    FROM (
        SELECT 
            pv.IDProduto, 
            pv.Descrição, 
            SUM(pv.Quantidade) - COALESCE(SUM(de.Qtd), 0) AS Quantidade_Residual
        FROM Produto_Venda pv
        LEFT JOIN DetEntrega_Romaneio de
            ON pv.IDProduto = de.IDProduto
            AND pv.Pedido = de.Pedido
        WHERE pv.IDEmpresa = ? 
          AND pv.Pedido IN (
              SELECT Pedido 
              FROM VENDA
              WHERE STATUS = 'V' 
                AND Situação IN ('Entregue Part.', 'Liberado') 
                AND IDEmpresa = ? 
        )
        GROUP BY pv.IDProduto, pv.Descrição
    ) q1
    RIGHT JOIN (
        SELECT 
            PV.IDProduto AS Codigo, 
            PV.Descrição, 
            SUM(PV.Quantidade) AS Quantidade, 
            SUM(PV.Quantidade * PV.Valor) / SUM(PV.Quantidade) AS MediaPreco,
            (SELECT DE.EstAtual 
             FROM DetEstoque DE 
             WHERE DE.IDProduto = PV.IDProduto 
             AND DE.IDEmpresa = ?) AS Estoque, 
            (SELECT TOP 1 DE.DataUltimoInventario 
             FROM DetEstoque DE 
             WHERE DE.IDProduto = PV.IDProduto 
             AND DE.IDEmpresa = ? 
             ORDER BY DE.DataUltimoInventario DESC) AS DataUltimoInventario
        FROM PRODUTO_VENDA PV
        WHERE PV.PEDIDO IN (
            SELECT P.Pedido 
            FROM Venda P
            WHERE P.IDEmpresa = ? 
            AND P.DataVenda BETWEEN ? AND ?  
            AND P.Status = 'V'
        ) 
        AND PV.IDEmpresa = ? 
        GROUP BY PV.IDProduto, PV.Descrição
    ) q2
    ON q1.IDProduto = q2.Codigo
    ORDER BY q2.Codigo;
    """

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        cursor.execute(query, (empresa, empresa, empresa, empresa, empresa, data_inicio, data_fim, empresa))

        columns = [column[0] for column in cursor.description]
        
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return jsonify(results)
    
    except Exception as e:
        print("Erro ao executar a query:", e)
        return jsonify({'error': str(e)}), 500

@venda_bp.route("/atualizar_data_conferencia", methods=["POST"])
def atualizar_data_conferencia():
    data = request.get_json()
    if not data or "id_produto" not in data or "id_empresa" not in data:
        return jsonify({"error": "Dados insuficientes. Informe 'id_produto' e 'id_empresa'."}), 400

    id_produto = data["id_produto"]
    id_empresa = data["id_empresa"]
    
    # Formata a data de hoje no padrão desejado: YYYY-MM-DD 00:00:00
    hoje = date.today().strftime("%Y-%m-%d") + " 00:00:00"

    query = """
    UPDATE DetEstoque
    SET DataUltimoInventario = ?
    WHERE IDProduto = ? AND IDEmpresa = ?
    """

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        # Converte os IDs para string para que a comparação seja feita como nvarchar
        cursor.execute(query, (hoje, str(id_produto), str(id_empresa)))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": "Atualização realizada com sucesso!"}), 200
    except Exception as e:
        return jsonify({"error": f"Erro durante a atualização: {str(e)}"}), 500