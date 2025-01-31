from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc

status_bp = Blueprint('status', __name__)

@status_bp.route('/pedidos')
def status_pedidos():
    return render_template('status.html')

@status_bp.route("/api/entregas", methods=["GET"])
def get_vendas():
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        query = """
        SELECT v.Pedido, v.NomeCliente, ven.LogON AS Vendedor, v.DataVenda, v.Situação
        FROM dbo.Venda v
        LEFT JOIN VENDEDOR ven ON v.Vendedor = ven.ID_Vendedor
        WHERE v.Situação IN ('Entregue Part.', 'Liberado')
          AND v.IDEmpresa = 5
          AND v.STATUS = 'V';
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        vendas = [
            {
                "Pedido": row.Pedido,
                "NomeCliente": row.NomeCliente,
                "Vendedor": row.Vendedor,
                "DataVenda": row.DataVenda.strftime('%Y-%m-%d'),
                "Situação": row.Situação
            }
            for row in rows
        ]

        cursor.close()
        conn.close()

        return jsonify(vendas)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@status_bp.route("/api/produtos-faltantes/<int:pedido>", methods=["GET"])
def get_produtos_faltantes(pedido):
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        query_produtos_venda = """
        SELECT IDProduto, Descrição, Quantidade
        FROM Produto_Venda
        WHERE Pedido = ? AND IDEmpresa = 5;
        """
        cursor.execute(query_produtos_venda, (pedido,))
        produtos_venda = cursor.fetchall()

        query_entregas = """
        SELECT IDProduto, SUM(Qtd) as TotalEntregue
        FROM DetEntrega_Romaneio
        WHERE Pedido = ? AND IDEmpresa = 5
        GROUP BY IDProduto;
        """
        cursor.execute(query_entregas, (pedido,))
        entregas = {row.IDProduto: row.TotalEntregue for row in cursor.fetchall()}

        produtos_faltantes = []
        for produto in produtos_venda:
            total_entregue = entregas.get(produto.IDProduto, 0)
            faltante = produto.Quantidade - total_entregue
            if faltante > 0:
                produtos_faltantes.append({
                    "IDProduto": produto.IDProduto,
                    "Descrição": produto.Descrição,  
                    "QuantidadeFaltante": faltante
                })

        conn.close()

        return jsonify(produtos_faltantes)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
