from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc

pix_bp = Blueprint('pix', __name__)

@pix_bp.route('/pix')
def status_pedidos():
    return render_template('pix.html')

@pix_bp.route('/get_order', methods=['POST'])
def get_order():
    data = request.get_json()
    pedido = data.get("pedido")
    if not pedido:
        return jsonify({"error": "Pedido não informado"}), 400
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        query = "SELECT NomeCliente, Valor FROM Venda WHERE Pedido = ? AND IDEmpresa = 5"
        cursor.execute(query, pedido)
        row = cursor.fetchone()
        if row:
            nome_cliente = row.NomeCliente
            valor = row.Valor
            # Formata o valor para o padrão de moeda brasileira (ex.: R$ 1.234,56)
            valor_formatado = "R$ " + format(valor, ",.2f").replace(",", "X").replace(".", ",").replace("X", ".")
            return jsonify({"nome": nome_cliente, "valor": valor, "valor_formatado": valor_formatado})
        else:
            return jsonify({"error": "Pedido não encontrado"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
