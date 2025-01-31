from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc
import datetime

ranking_bp = Blueprint('ranking', __name__)

@ranking_bp.route('/ranking')
def status_pedidos():
    return render_template('ranking.html')

def obter_frete_por_pedido(pedido, id_empresa):
    try:
        with pyodbc.connect(conn_str) as conn:
            query = """
            SELECT Frete
            FROM Produto_Venda
            WHERE IDEMPRESA = ? AND Pedido = ?
            """
            cursor = conn.cursor()
            cursor.execute(query, (id_empresa, pedido))
            fretes = cursor.fetchall()
            return sum(row.Frete for row in fretes)
    except Exception as e:
        return 0

def obter_vendedores_ativos(id_empresa):
    try:
        with pyodbc.connect(conn_str) as conn:
            query = """
            SELECT ID_Vendedor, LogON
            FROM VENDEDOR
            WHERE ATIVO = 'True' AND IDEMPRESA = ? AND OBS = 'vendedor' OR OBS = 'gerente'
            """
            cursor = conn.cursor()
            cursor.execute(query, (id_empresa,))
            resultado = cursor.fetchall()
            vendedores = [
                {"ID_Vendedor": row.ID_Vendedor, "LogON": row.LogON}
                for row in resultado
            ]
            return vendedores
    except Exception as e:
        return []

def obter_vendas(ids_vendedores, data_inicio, data_fim, id_empresa):
    try:
        with pyodbc.connect(conn_str) as conn:
            query = f"""
            SELECT Vendedor, Pedido, Valor, TabComissao
            FROM VENDA
            WHERE IDEMPRESA = ? AND STATUS = 'V' AND DESATIVO = 'False'
            AND DataVenda BETWEEN ? AND ?
            AND Vendedor IN ({','.join(['?'] * len(ids_vendedores))})
            """
            parametros = [id_empresa, data_inicio, data_fim] + ids_vendedores
            cursor = conn.cursor()
            cursor.execute(query, parametros)
            resultado = cursor.fetchall()
            vendas = [dict(zip([column[0] for column in cursor.description], row)) for row in resultado]
            return vendas
    except Exception as e:
        return []

@ranking_bp.route("/api/vendas", methods=["POST"])
def listar_vendas():
    try:
        if not request.is_json:
            return jsonify({"erro": "O cabeçalho Content-Type deve ser 'application/json'."}), 415

        dados = request.get_json()
        data_inicio = dados.get("data_inicio")
        data_fim = dados.get("data_fim")
        id_empresa = dados.get("IDEMPRESA")   

        if not id_empresa:
            return jsonify({"erro": "IDEMPRESA é obrigatório."}), 400

        try:
            data_inicio = datetime.datetime.strptime(data_inicio, "%Y-%m-%d %H:%M:%S")
            data_fim = datetime.datetime.strptime(data_fim, "%Y-%m-%d %H:%M:%S")
        except (TypeError, ValueError):
            return jsonify({"erro": "As datas devem estar no formato 'YYYY-MM-DD HH:MM:SS'."}), 400

        vendedores = obter_vendedores_ativos(id_empresa)
        if not vendedores:
            return jsonify({"erro": "Nenhum vendedor ativo encontrado para esta empresa."}), 404

        ids_vendedores = [vendedor["ID_Vendedor"] for vendedor in vendedores]
        vendas = obter_vendas(ids_vendedores, data_inicio, data_fim, id_empresa)

        vendedores_dict = {v["ID_Vendedor"]: v["LogON"] for v in vendedores}
        resumo_vendas = []

        for vendedor_id in ids_vendedores:
            vendas_list = [venda for venda in vendas if venda["Vendedor"] == vendedor_id]
            total_vendas = sum(venda["Valor"] for venda in vendas_list)
            total_comissao = sum(
                round((venda["TabComissao"] / 100 * venda["Valor"]) - (venda["TabComissao"] / 100 * obter_frete_por_pedido(venda["Pedido"], id_empresa)), 2)
                for venda in vendas_list
            )
            num_pedidos = len(vendas_list) 
            resumo_vendas.append({
                "Vendedor": vendedores_dict.get(vendedor_id, "Vendedor desconhecido"),
                "Venda": round(total_vendas, 2),
                "Comissao": round(total_comissao, 2),
                "Orçamentos": num_pedidos,  
            })

        return jsonify(resumo_vendas)

    except Exception as e:
        return jsonify({"erro": f"Erro ao processar a solicitação: {e}"}), 500

    
def obter_gerentes_ativos(id_empresa):
    """
    Retorna uma lista dos nomes dos gerentes ativos (LogON) para uma empresa específica.
    """
    try:
        with pyodbc.connect(conn_str) as conn:
            query = """
            SELECT LogON
            FROM VENDEDOR
            WHERE ATIVO = 'True' AND IDEMPRESA = ? AND OBS = 'gerente'
            """
            cursor = conn.cursor()
            cursor.execute(query, (id_empresa,))
            resultado = cursor.fetchall()
            gerentes = [row.LogON for row in resultado]
            return gerentes
    except Exception as e:
        return []


def calcular_comissao_gerente(data_inicio, data_fim, id_empresa):
    try:
        vendedores = obter_vendedores_ativos(id_empresa)
        if not vendedores:
            return {"erro": "Nenhum vendedor ativo encontrado para esta empresa."}

        ids_vendedores = [vendedor["ID_Vendedor"] for vendedor in vendedores]

        with pyodbc.connect(conn_str) as conn:
            query_vendas = f"""
            SELECT Valor, Pedido
            FROM VENDA
            WHERE IDEMPRESA = ? AND STATUS = 'V' AND DESATIVO = 'False'
            AND DataVenda BETWEEN ? AND ?
            AND Vendedor IN ({','.join(['?'] * len(ids_vendedores))})
            """
            parametros = [id_empresa, data_inicio, data_fim] + ids_vendedores
            cursor = conn.cursor()
            cursor.execute(query_vendas, parametros)
            vendas_resultado = cursor.fetchall()

        total_vendas = sum(float(venda.Valor) for venda in vendas_resultado)

        total_frete = sum(float(obter_frete_por_pedido(venda.Pedido, id_empresa)) for venda in vendas_resultado)

        total_bruto = total_vendas - total_frete

        comissao_gerente = round(0.20 / 100 * total_bruto, 2)

        gerentes = obter_gerentes_ativos(id_empresa)

        return {
            "Gerentes": ", ".join(gerentes) if gerentes else "Nenhum gerente encontrado",
            "Total_Vendas": round(total_vendas, 2),
            "Total_Frete": round(total_frete, 2),
            "Total_Bruto": round(total_bruto, 2),
            "Comissao_Gerente": comissao_gerente,
        }
    except Exception as e:
        return {"erro": f"Erro ao calcular a comissão dos gerentes: {e}"}


@ranking_bp.route("/api/comissao_gerentes", methods=["POST"])
def listar_comissao_gerentes():
    try:
        if not request.is_json:
            return jsonify({"erro": "O cabeçalho Content-Type deve ser 'application/json'."}), 415

        dados = request.get_json()
        data_inicio = dados.get("data_inicio")
        data_fim = dados.get("data_fim")
        id_empresa = dados.get("IDEMPRESA")

        if not id_empresa:
            return jsonify({"erro": "IDEMPRESA é obrigatório."}), 400

        try:
            data_inicio = datetime.datetime.strptime(data_inicio, "%Y-%m-%d %H:%M:%S")
            data_fim = datetime.datetime.strptime(data_fim, "%Y-%m-%d %H:%M:%S")
        except (TypeError, ValueError):
            return jsonify({"erro": "As datas devem estar no formato 'YYYY-MM-DD HH:MM:SS'."}), 400

        resultado = calcular_comissao_gerente(data_inicio, data_fim, id_empresa)

        return jsonify(resultado)

    except Exception as e:
        return jsonify({"erro": f"Erro ao processar a solicitação: {e}"}), 500