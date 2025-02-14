from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc
import datetime
import calendar

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/admin')
def admin():
    return render_template('admin.html')

@admin_bp.route('/api/vendedores', methods=['GET'])
def get_vendedores():
    empresa_id = request.args.get('empresa_id')
    
    if not empresa_id:
        return jsonify({"error": "ID da empresa é obrigatório"}), 400

    try:
        empresa_id = int(empresa_id)
    except ValueError:
        return jsonify({"error": "ID da empresa deve ser numérico"}), 400

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        query = """
        SELECT ID_VENDEDOR, LogON FROM VENDEDOR 
        WHERE ATIVO = 'TRUE' AND IDEmpresa = ? AND OBS IN ('Vendedor', 'Gerente', 'Supervisor')
        """
        cursor.execute(query, (empresa_id,))
        vendedores = [{"ID_VENDEDOR": row.ID_VENDEDOR, "LogON": row.LogON} for row in cursor.fetchall()]
        
        conn.close()
        return jsonify(vendedores)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/vendas_total', methods=['GET'])
def get_vendas_total():
    # Obtém os parâmetros
    empresa_id = request.args.get('empresa_id')
    if not empresa_id:
        return jsonify({"error": "ID da empresa é obrigatório"}), 400
    try:
        empresa_id = int(empresa_id)
    except ValueError:
        return jsonify({"error": "ID da empresa deve ser numérico"}), 400

    vendedor_id = request.args.get('vendedor_id')  # Pode ser "Total"
    status_param = request.args.get('status')
    if not status_param:
        return jsonify({"error": "Status é obrigatório"}), 400

    ano = request.args.get('ano')
    mes = request.args.get('mes')
    if not ano or not mes:
        return jsonify({"error": "Ano e mês são obrigatórios"}), 400

    try:
        ano = int(ano)
    except ValueError:
        return jsonify({"error": "Ano deve ser numérico"}), 400

    # Define o intervalo de datas
    if mes.lower() == "hoje":
        now = datetime.datetime.now()
        ano = now.year
        mes_int = now.month
    else:
        mes_map = {
            "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4,
            "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
            "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
        }
        mes_lower = mes.lower()
        if mes_lower not in mes_map:
            return jsonify({"error": "Mês inválido"}), 400
        mes_int = mes_map[mes_lower]

    primeiro_dia = f"{ano}-{mes_int:02d}-01 00:00:00"
    ultimo_dia_num = calendar.monthrange(ano, mes_int)[1]
    ultimo_dia = f"{ano}-{mes_int:02d}-{ultimo_dia_num} 23:59:59"

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        # Se um vendedor específico foi selecionado (não "Total")
        if vendedor_id and vendedor_id != "Total":
            try:
                vendedor_id_int = int(vendedor_id)
            except ValueError:
                return jsonify({"error": "ID do vendedor deve ser numérico ou 'Total'"}), 400

            query = """
            SELECT COALESCE(SUM(Valor), 0) as total FROM Venda
            WHERE IDEmpresa = ? AND VENDEDOR = ? AND STATUS = ? AND DataVenda BETWEEN ? AND ? AND DESATIVO = 'False'
            """
            params = (empresa_id, vendedor_id_int, status_param, primeiro_dia, ultimo_dia)
        else:
            query = """
            SELECT COALESCE(SUM(Valor), 0) as total FROM Venda
            WHERE IDEmpresa = ? AND STATUS = ? AND DataVenda BETWEEN ? AND ? AND DESATIVO = 'False'
            """
            params = (empresa_id, status_param, primeiro_dia, ultimo_dia)

        cursor.execute(query, params)
        row = cursor.fetchone()
        total = row.total if row and row.total is not None else 0

        conn.close()
        return jsonify({"total": total})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/vendas_detalhes', methods=['GET'])
def get_vendas_detalhes():
    # Parâmetros obrigatórios
    empresa_id = request.args.get('empresa_id')
    if not empresa_id:
        return jsonify({"error": "ID da empresa é obrigatório"}), 400
    try:
        empresa_id = int(empresa_id)
    except ValueError:
        return jsonify({"error": "ID da empresa deve ser numérico"}), 400

    vendedor_id = request.args.get('vendedor_id')  # Pode ser "Total"
    status_param = request.args.get('status')
    if not status_param:
        return jsonify({"error": "Status é obrigatório"}), 400

    ano = request.args.get('ano')
    mes = request.args.get('mes')
    if not ano or not mes:
        return jsonify({"error": "Ano e mês são obrigatórios"}), 400

    try:
        ano = int(ano)
    except ValueError:
        return jsonify({"error": "Ano deve ser numérico"}), 400

    # Cálculo do intervalo de datas
    if mes.lower() == "hoje":
        now = datetime.datetime.now()
        ano = now.year
        mes_int = now.month
    else:
        mes_map = {
            "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4,
            "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
            "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
        }
        mes_lower = mes.lower()
        if mes_lower not in mes_map:
            return jsonify({"error": "Mês inválido"}), 400
        mes_int = mes_map[mes_lower]

    primeiro_dia = f"{ano}-{mes_int:02d}-01 00:00:00"
    ultimo_dia_num = calendar.monthrange(ano, mes_int)[1]
    ultimo_dia = f"{ano}-{mes_int:02d}-{ultimo_dia_num} 23:59:59"

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        if vendedor_id and vendedor_id != "Total":
            try:
                vendedor_id_int = int(vendedor_id)
            except ValueError:
                return jsonify({"error": "ID do vendedor deve ser numérico ou 'Total'"}), 400

            query = """
            SELECT v.Pedido, v.TabComissao, v.Valor,
                   COALESCE(f.soma_frete, 0) AS soma_frete,
                   COALESCE(c.total_custo, 0) AS total_custo
            FROM Venda v
            LEFT JOIN (
                SELECT PEDIDO, IDEmpresa, SUM(Frete) AS soma_frete
                FROM Produto_Venda
                GROUP BY PEDIDO, IDEmpresa
            ) f ON v.Pedido = f.PEDIDO AND v.IDEmpresa = f.IDEmpresa
            LEFT JOIN (
                SELECT PEDIDO, IDEmpresa, SUM(CustoProd * Quantidade) AS total_custo
                FROM Produto_Venda
                GROUP BY PEDIDO, IDEmpresa
            ) c ON v.Pedido = c.PEDIDO AND v.IDEmpresa = c.IDEmpresa
            WHERE v.IDEmpresa = ? AND v.VENDEDOR = ? AND v.STATUS = ?
              AND v.DataVenda BETWEEN ? AND ? AND v.DESATIVO = 'False'
            ORDER BY v.Pedido ASC
            """
            params = (empresa_id, vendedor_id_int, status_param, primeiro_dia, ultimo_dia)
        else:
            query = """
            SELECT v.Pedido, v.TabComissao, v.Valor,
                   COALESCE(f.soma_frete, 0) AS soma_frete,
                   COALESCE(c.total_custo, 0) AS total_custo
            FROM Venda v
            LEFT JOIN (
                SELECT PEDIDO, IDEmpresa, SUM(Frete) AS soma_frete
                FROM Produto_Venda
                GROUP BY PEDIDO, IDEmpresa
            ) f ON v.Pedido = f.PEDIDO AND v.IDEmpresa = f.IDEmpresa
            LEFT JOIN (
                SELECT PEDIDO, IDEmpresa, SUM(CustoProd * Quantidade) AS total_custo
                FROM Produto_Venda
                GROUP BY PEDIDO, IDEmpresa
            ) c ON v.Pedido = c.PEDIDO AND v.IDEmpresa = c.IDEmpresa
            WHERE v.IDEmpresa = ? AND v.STATUS = ?
              AND v.DataVenda BETWEEN ? AND ? AND v.DESATIVO = 'False'
            ORDER BY v.Pedido ASC
            """
            params = (empresa_id, status_param, primeiro_dia, ultimo_dia)

        cursor.execute(query, params)
        rows = cursor.fetchall()

        detalhes = []  # Lista para armazenar os detalhes dos pedidos
        total_commissao = 0
        total_valor = 0
        total_frete = 0
        total_custo = 0
        total_sub = 0  # Acumulador para o valor "sub"

        for row in rows:
            try:
                tab_comissao = float(row.TabComissao)
                valor = float(row.Valor)
                soma_frete = float(row.soma_frete)
                custo = float(row.total_custo)
            except (TypeError, ValueError):
                tab_comissao = valor = soma_frete = custo = 0

            # Comissão do pedido conforme calculada anteriormente
            comissao_pedido = (tab_comissao / 100) * valor - (tab_comissao / 100) * soma_frete
            total_commissao += comissao_pedido
            total_valor += valor
            total_frete += soma_frete
            total_custo += custo

            # Cálculo do "sub" conforme solicitado:
            sub = ((tab_comissao / 100) * valor) - ((tab_comissao / 100) * valor - (tab_comissao / 100) * soma_frete)
            total_sub += sub

            detalhes.append(
                f"Pedido: {row.Pedido} / Comissão: {comissao_pedido:.2f} / Custo: {custo:.2f} / Frete: {soma_frete:.2f}"
            )

        # Cálculo inicial do lucro
        total_lucro = total_valor - total_commissao - total_frete - total_custo
        # Ajuste final: subtraindo o total do "sub"
        total_lucro = total_lucro - total_sub

        conn.close()

        return jsonify({
            "detalhes": detalhes,
            "qtd_orcamentos": len(rows),
            "total_commissao": total_commissao,
            "lucro_total": total_lucro
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/grafico_vendas', methods=['GET'])
def get_grafico_vendas():
    empresa_id = request.args.get('empresa_id')
    vendedor_id = request.args.get('vendedor_id')
    status_param = request.args.get('status')
    ano = request.args.get('ano')
    mes = request.args.get('mes')

    if not empresa_id or not ano or not mes:
        return jsonify({"error": "Parâmetros obrigatórios ausentes"}), 400

    try:
        empresa_id = int(empresa_id)
        ano = int(ano)
    except ValueError:
        return jsonify({"error": "ID da empresa e ano devem ser numéricos"}), 400

    mes_map = {
        "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4,
        "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
        "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
    }
    mes_lower = mes.lower()
    if mes_lower not in mes_map:
        return jsonify({"error": "Mês inválido"}), 400
    mes_int = mes_map[mes_lower]

    primeiro_dia = f"{ano}-{mes_int:02d}-01 00:00:00"
    ultimo_dia = f"{ano}-{mes_int:02d}-{calendar.monthrange(ano, mes_int)[1]} 23:59:59"

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        query = """
        SELECT CONVERT(VARCHAR, DataVenda, 103) as DataVenda, SUM(Valor) as TotalVenda
        FROM Venda
        WHERE IDEmpresa = ? AND STATUS = ? AND DataVenda BETWEEN ? AND ? AND DESATIVO = 'False'
        """
        params = [empresa_id, status_param, primeiro_dia, ultimo_dia]
        
        if vendedor_id and vendedor_id != "Total":
            query += " AND VENDEDOR = ?"
            params.append(int(vendedor_id))
        
        query += " GROUP BY CONVERT(VARCHAR, DataVenda, 103) ORDER BY MIN(DataVenda)"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        vendas = {row.DataVenda: row.TotalVenda for row in rows}

        return jsonify(vendas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
