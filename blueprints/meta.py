from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc

meta_bp = Blueprint('meta', __name__)

@meta_bp.route('/meta')
def meta():
    return render_template('meta.html')

@meta_bp.route('/api/meta')
def meta_api():
    obs = request.args.get('obs')
    if obs not in ['vendedor', 'representante', 'supervisor', 'gerente']:
        return jsonify([])
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT LogON, ID_Vendedor FROM Vendedor WHERE IDEmpresa = 5 AND OBS = ?", obs
        )
        rows = cursor.fetchall()
        result = [{'codigo': row.ID_Vendedor, 'vendedor': row.LogON} for row in rows]
        return jsonify(result)
    except Exception as e:
        print("Erro ao acessar o banco de dados:", e)
        return jsonify({"error": "Erro ao acessar o banco de dados"}), 500

@meta_bp.route('/api/meta_vendedor')
def meta_vendedor_api():
    id_vendedor = request.args.get('ID_Vendedor')
    if not id_vendedor:
        return jsonify([])
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT ID_Vendedor, Vendedor, mes, mes_n, Ano, Meta, IDEmpresa FROM Meta_Vendedor WHERE IDEmpresa = 5 AND ID_Vendedor = ?", id_vendedor
        )
        rows = cursor.fetchall()
        result = []
        for row in rows:
            result.append({
                'ID_Vendedor': row.ID_Vendedor,
                'vendedor': row.Vendedor,
                'mes': row.mes,
                'mes_n': row.mes_n,
                'Ano': row.Ano,
                'Meta': row.Meta,
                'IDEmpresa': row.IDEmpresa
            })
        return jsonify(result)
    except Exception as e:
        print("Erro ao acessar o banco de dados (meta_vendedor):", e)
        return jsonify({"error": "Erro ao acessar o banco de dados"}), 500

@meta_bp.route('/api/save_meta', methods=['POST'])
def save_meta():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Dados inválidos"}), 400

    ID_Vendedor = data.get('ID_Vendedor')
    Ano = data.get('Ano')
    metas = data.get('metas')
    Vendedor = data.get('Vendedor')  # Para o caso do INSERT, precisamos do nome
    if not ID_Vendedor or not Ano or metas is None:
        return jsonify({"error": "Parâmetros ausentes"}), 400

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        # Processa cada meta recebida
        for meta in metas:
            mes_n = meta.get('mes')
            meta_valor = meta.get('meta')
            # Tenta converter para float
            try:
                valor = float(meta_valor)
            except:
                valor = 0

            # Se o valor for 0, deletar o registro, se existir
            if valor == 0:
                cursor.execute(
                    "DELETE FROM Meta_Vendedor WHERE IDEmpresa = 5 AND ID_Vendedor = ? AND Mes_N = ? AND Ano = ?",
                    ID_Vendedor, mes_n, Ano
                )
            else:
                # Primeiro, tenta atualizar o registro existente
                cursor.execute(
                    "UPDATE Meta_Vendedor SET Meta = ? WHERE IDEmpresa = 5 AND ID_Vendedor = ? AND Mes_N = ? AND Ano = ?",
                    valor, ID_Vendedor, mes_n, Ano
                )
                if cursor.rowcount == 0:
                    # Se não existir, insere um novo registro.
                    # Define o nome do mês a partir do número (você pode ajustar conforme necessário)
                    meses = {
                        1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio',
                        6: 'Junho', 7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro',
                        11: 'Novembro', 12: 'Dezembro'
                    }
                    mes_nome = meses.get(int(mes_n), '')
                    cursor.execute(
                        "INSERT INTO Meta_Vendedor (ID_Vendedor, Vendedor, mes, Mes_N, Ano, Meta, IDEmpresa) VALUES (?, ?, ?, ?, ?, ?, 5)",
                        ID_Vendedor, Vendedor, mes_nome, mes_n, Ano, valor
                    )
        conn.commit()

        # Após salvar, retorna as metas atualizadas para o vendedor e ano
        cursor.execute(
            "SELECT ID_Vendedor, Vendedor, mes, mes_n, Ano, Meta, IDEmpresa FROM Meta_Vendedor WHERE IDEmpresa = 5 AND ID_Vendedor = ? AND Ano = ?",
            ID_Vendedor, Ano
        )
        rows = cursor.fetchall()
        result = []
        for row in rows:
            result.append({
                'ID_Vendedor': row.ID_Vendedor,
                'vendedor': row.Vendedor,
                'mes': row.mes,
                'mes_n': row.mes_n,
                'Ano': row.Ano,
                'Meta': row.Meta,
                'IDEmpresa': row.IDEmpresa
            })
        return jsonify(result)
    except Exception as e:
        print("Erro ao salvar metas:", e)
        return jsonify({"error": "Erro ao salvar metas"}), 500
