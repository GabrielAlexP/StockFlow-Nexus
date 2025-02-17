from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc
import datetime
import calendar

admin_bp = Blueprint('admin', __name__)
gerente_bp = Blueprint('gerente', __name__)
vendedor_bp = Blueprint('vendedor', __name__)

@admin_bp.route('/admin')
def admin():
    return render_template('admin.html')

@gerente_bp.route('/gerente')
def gerente():
    return render_template('gerente.html')

@vendedor_bp.route('/vendedor')
def vendedor():
    return render_template('vendedor.html')

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
        SELECT ID_VENDEDOR, LogON, OBS FROM VENDEDOR 
        WHERE ATIVO = 'TRUE' AND IDEmpresa = ? AND OBS IN ('Vendedor', 'Gerente', 'Supervisor')
        """
        cursor.execute(query, (empresa_id,))
        vendedores = [{"ID_VENDEDOR": row.ID_VENDEDOR, "LogON": row.LogON, "OBS": row.OBS} for row in cursor.fetchall()]
        
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
    empresa_id = request.args.get('empresa_id')
    if not empresa_id:
        return jsonify({"error": "ID da empresa é obrigatório"}), 400
    try:
        empresa_id = int(empresa_id)
    except ValueError:
        return jsonify({"error": "ID da empresa deve ser numérico"}), 400

    vendedor_id = request.args.get('vendedor_id')
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

        # Utilizando CTEs para calcular os agregados uma única vez
        query = """
        WITH FreteCTE AS (
            SELECT PEDIDO, IDEmpresa, SUM(Frete) AS soma_frete
            FROM Produto_Venda
            GROUP BY PEDIDO, IDEmpresa
        ),
        CustoCTE AS (
            SELECT PEDIDO, IDEmpresa, SUM(CustoProd * Quantidade) AS total_custo
            FROM Produto_Venda
            GROUP BY PEDIDO, IDEmpresa
        )
        SELECT v.Pedido, v.TabComissao, v.Valor, vend.OBS,
               COALESCE(f.soma_frete, 0) AS soma_frete,
               COALESCE(c.total_custo, 0) AS total_custo
        FROM Venda v
        INNER JOIN Vendedor vend ON v.VENDEDOR = vend.ID_VENDEDOR
        LEFT JOIN FreteCTE f ON v.Pedido = f.PEDIDO AND v.IDEmpresa = f.IDEmpresa
        LEFT JOIN CustoCTE c ON v.Pedido = c.PEDIDO AND v.IDEmpresa = c.IDEmpresa
        WHERE v.IDEmpresa = ? AND v.STATUS = ? AND v.DataVenda BETWEEN ? AND ? AND v.DESATIVO = 'False'
        """
        params = [empresa_id, status_param, primeiro_dia, ultimo_dia]
        if vendedor_id and vendedor_id != "Total":
            try:
                vendedor_id_int = int(vendedor_id)
            except ValueError:
                return jsonify({"error": "ID do vendedor deve ser numérico ou 'Total'"}), 400
            query += " AND v.VENDEDOR = ?"
            params.append(vendedor_id_int)

        query += " ORDER BY v.Pedido ASC"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        detalhes = []
        total_commissao = 0
        total_valor = 0
        total_frete = 0
        total_custo = 0
        total_sub = 0  # Comissão incidente sobre o frete

        for row in rows:
            try:
                tab_comissao = float(row.TabComissao)
                valor = float(row.Valor)
                soma_frete = float(row.soma_frete)
                custo = float(row.total_custo)
            except (TypeError, ValueError):
                tab_comissao = valor = soma_frete = custo = 0

            comissao_pedido = (tab_comissao / 100) * valor - (tab_comissao / 100) * soma_frete
            total_commissao += comissao_pedido
            total_valor += valor
            total_frete += soma_frete
            total_custo += custo
            total_sub += (tab_comissao / 100) * soma_frete

            detalhes.append(
                f"Pedido: {row.Pedido} / Custo: {custo:.2f} / Frete: {soma_frete:.2f}"
            )

        total_lucro = total_valor - total_commissao - total_frete - total_custo - total_sub

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

@admin_bp.route('/api/meta', methods=['GET'])
def get_meta():
    empresa_id = request.args.get('empresa_id')
    vendedor_id = request.args.get('vendedor_id')
    if not empresa_id or not vendedor_id:
        return jsonify({"error": "ID da empresa e vendedor são obrigatórios"}), 400
    try:
        empresa_id = int(empresa_id)
    except ValueError:
        return jsonify({"error": "ID da empresa deve ser numérico"}), 400
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        # Tratar vendedor "Total" de forma case-insensitive
        if vendedor_id.lower() == "total":
            query = "SELECT FAX FROM Vendedor WHERE IDEmpresa = ?"
            cursor.execute(query, (empresa_id,))
            rows = cursor.fetchall()
            conn.close()
            meta = 0
            for row in rows:
                if row[0] is not None:
                    try:
                        meta += float(row[0])
                    except Exception:
                        # Se a conversão falhar, ignoramos o valor
                        pass
            return jsonify({"Meta": meta})
        else:
            try:
                vendedor_id_int = int(vendedor_id)
            except ValueError:
                return jsonify({"error": "ID do vendedor deve ser numérico ou 'Total'"}), 400
            query = "SELECT FAX FROM Vendedor WHERE IDEmpresa = ? AND ID_VENDEDOR = ?"
            cursor.execute(query, (empresa_id, vendedor_id_int))
            row = cursor.fetchone()
            conn.close()
            if row is None:
                return jsonify({"error": "Vendedor não encontrado"}), 404
            try:
                meta = float(row[0])
            except Exception:
                meta = 0
            return jsonify({"Meta": meta})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/buscar_pedido', methods=['GET'])
def buscar_pedido():
    pedido = request.args.get('pedido')
    empresa_id = request.args.get('empresa_id')
    if not pedido or not empresa_id:
        return jsonify({"error": "Parâmetros 'pedido' e 'empresa_id' são obrigatórios."}), 400
    try:
        empresa_id = int(empresa_id)
    except ValueError:
        return jsonify({"error": "ID da empresa deve ser numérico."}), 400
    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        
        # Query para buscar dados do pedido
        query_venda = """
        SELECT PEDIDO, NomeCliente, Valor, DataVenda, VENDEDOR 
        FROM Venda 
        WHERE PEDIDO = ? AND IDEmpresa = ?
        """
        cursor.execute(query_venda, (pedido, empresa_id))
        venda_row = cursor.fetchone()
        if venda_row:
            order = {
                "PEDIDO": venda_row.PEDIDO,
                "NomeCliente": venda_row.NomeCliente,
                "Valor": venda_row.Valor,
                "DataVenda": venda_row.DataVenda.strftime("%d/%m/%Y") if hasattr(venda_row.DataVenda, 'strftime') else venda_row.DataVenda,
                "VENDEDOR": venda_row.VENDEDOR 
            }
        else:
            order = {}
        
        # Query para buscar produtos do pedido
        query_produtos = """
        SELECT IDProduto, Descrição, Quantidade, Valor, (Quantidade * Valor) AS Total 
        FROM Produto_Venda 
        WHERE PEDIDO = ? AND IDEmpresa = ? 
        """
        cursor.execute(query_produtos, (pedido, empresa_id))
        produtos_rows = cursor.fetchall()
        produtos = []
        for row in produtos_rows:
            produtos.append({
                "IDProduto": row.IDProduto,
                "Descrição": row[1],
                "Quantidade": row.Quantidade,
                "Valor": row.Valor,
                "Total": row.Total
            })
        
        conn.close()
        return jsonify({"order": order, "products": produtos})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/api/comissao_supervisor', methods=['GET'])
def get_comissao_supervisor():
    empresa_id = request.args.get('empresa_id')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')

    if not empresa_id or not data_inicio or not data_fim:
        return jsonify({"error": "ID da empresa, data de início e data de fim são obrigatórios"}), 400
    
    try:
        empresa_id = int(empresa_id)
    except ValueError:
        return jsonify({"error": "ID da empresa deve ser numérico"}), 400

    try:
        # Validação do formato de data
        datetime.datetime.strptime(data_inicio, "%Y-%m-%d")
        datetime.datetime.strptime(data_fim, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Formato de data inválido. Use YYYY-MM-DD"}), 400

    # Corrigindo: anexar os horários para cobrir o dia inteiro
    data_inicio_dt = data_inicio + " 00:00:00"
    data_fim_dt = data_fim + " 23:59:59"

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        # Buscar o ID do supervisor
        query_supervisor = """
        SELECT ID_Vendedor 
        FROM Vendedor 
        WHERE OBS = 'Supervisor' AND IDEmpresa = ?
        """
        cursor.execute(query_supervisor, (empresa_id,))
        supervisor = cursor.fetchone()
        
        if not supervisor:
            conn.close()
            return jsonify({"error": "Nenhum supervisor encontrado"}), 404
        
        id_supervisor = supervisor.ID_Vendedor

        # Calcular a comissão do supervisor usando as datas corrigidas
        query_comissao_supervisor = f"""
        SELECT 
            (Total_Comissao_Menos_Frete_Bruto + (0.2 / 100 * Total_Bruto)) AS Comissao_Supervisor
        FROM 
            (
                SELECT 
                    SUM(c.Comissao) - COALESCE(SUM(f.Frete_Bruto), 0) AS Total_Comissao_Menos_Frete_Bruto
                FROM 
                    (
                        SELECT 
                            Pedido, 
                            (TabComissao / 100 * Valor) AS Comissao
                        FROM 
                            Venda 
                        WHERE 
                            Desativo = 'False' 
                            AND Status = 'V' 
                            AND DataVenda BETWEEN ? AND ? 
                            AND IDEmpresa = ?
                            AND Vendedor = ?
                        GROUP BY 
                            Pedido, TabComissao, Valor
                    ) AS c
                LEFT JOIN 
                    (
                        SELECT 
                            pv.Pedido, 
                            (SUM(pv.Frete) * (v.TabComissao / 100)) AS Frete_Bruto
                        FROM 
                            Produto_Venda pv
                        JOIN 
                            Venda v ON pv.Pedido = v.Pedido
                        JOIN 
                            (
                                SELECT Pedido
                                FROM Venda 
                                WHERE Desativo = 'False' 
                                  AND Status = 'V' 
                                  AND DataVenda BETWEEN ? AND ? 
                                  AND IDEmpresa = ?
                                  AND Vendedor = ?
                                GROUP BY Pedido
                            ) AS Comissoes ON pv.Pedido = Comissoes.Pedido
                        WHERE 
                            v.IDEmpresa = ?
                        GROUP BY 
                            pv.Pedido, v.TabComissao
                    ) AS f ON c.Pedido = f.Pedido
            ) AS Total_Comissao_Menos_Frete_Bruto,

            (
                SELECT 
                    (
                        (SELECT SUM(v.Valor) 
                         FROM Venda v
                         WHERE v.IDEmpresa = ? 
                           AND v.Desativo = 'False'
                           AND v.STATUS = 'V'
                           AND v.DataVenda BETWEEN ? AND ?
                           AND v.Vendedor IN (
                             SELECT ve.ID_VENDEDOR
                             FROM Vendedor ve
                             WHERE ve.IDEmpresa = ?
                               AND ve.OBS = 'Vendedor'
                           )
                        ) 
                        -
                        ( 
                            SELECT SUM(pv.Frete) 
                            FROM Produto_Venda pv
                            WHERE pv.IDEmpresa = ? 
                              AND pv.Pedido IN (
                                SELECT v.Pedido
                                FROM Venda v
                                WHERE v.IDEmpresa = ? 
                                  AND v.Desativo = 'False'
                                  AND v.STATUS = 'V'
                                  AND v.DataVenda BETWEEN ? AND ?
                                  AND v.Vendedor IN (
                                    SELECT ve.ID_VENDEDOR
                                    FROM Vendedor ve
                                    WHERE ve.IDEmpresa = ? 
                                      AND ve.OBS = 'Vendedor'
                                  )
                              )
                        )
                    ) AS Total_Bruto
            ) AS Total_Bruto;
        """

        params = [
            data_inicio_dt, data_fim_dt, empresa_id, id_supervisor,  # Comissão Supervisor
            data_inicio_dt, data_fim_dt, empresa_id, id_supervisor, empresa_id,  # Frete
            empresa_id, data_inicio_dt, data_fim_dt, empresa_id, empresa_id,  # Total Bruto
            empresa_id, data_inicio_dt, data_fim_dt, empresa_id  # Total Bruto (continuação)
        ]
        
        cursor.execute(query_comissao_supervisor, params)
        row = cursor.fetchone()
        
        comissao_supervisor = float(row.Comissao_Supervisor) if row and row.Comissao_Supervisor is not None else 0

        conn.close()
        return jsonify({
            "comissao_supervisor": comissao_supervisor
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/comissao_gerente', methods=['GET'])
def get_comissao_gerente():
    empresa_id = request.args.get('empresa_id')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')

    if not empresa_id or not data_inicio or not data_fim:
        return jsonify({"error": "ID da empresa, data de início e data de fim são obrigatórios"}), 400

    try:
        empresa_id = int(empresa_id)
    except ValueError:
        return jsonify({"error": "ID da empresa deve ser numérico"}), 400

    try:
        # Validação simples do formato da data
        datetime.datetime.strptime(data_inicio, "%Y-%m-%d")
        datetime.datetime.strptime(data_fim, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Formato de data inválido. Use YYYY-MM-DD"}), 400

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        # Converte para datetime completo
        data_inicio_dt = data_inicio + " 00:00:00"
        data_fim_dt = data_fim + " 23:59:59"

        query = """
        WITH Pedidos AS (
            SELECT Pedido
            FROM Venda
            WHERE IDEmpresa = ?
              AND Desativo = 'False'
              AND STATUS = 'V'
              AND DataVenda BETWEEN ? AND ?
        ),
        VendaTotal AS (
            SELECT SUM(Valor) AS VENDA_TOTAL
            FROM Venda
            WHERE IDEmpresa = ?
              AND Desativo = 'False'
              AND STATUS = 'V'
              AND DataVenda BETWEEN ? AND ?
        ),
        TotalFrete AS (
            SELECT SUM(pv.Frete) AS Total_Frete
            FROM Produto_Venda pv
            WHERE pv.IDEmpresa = ?
              AND pv.Pedido IN (SELECT Pedido FROM Pedidos)
        )
        SELECT 
            0.2 / 100 * ((SELECT VENDA_TOTAL FROM VendaTotal) - COALESCE((SELECT Total_Frete FROM TotalFrete), 0)) AS Comissao_Gerente;
        """

        params = [
            empresa_id, data_inicio_dt, data_fim_dt,   # Pedidos
            empresa_id, data_inicio_dt, data_fim_dt,       # VendaTotal
            empresa_id                                   # TotalFrete
        ]

        cursor.execute(query, params)
        row = cursor.fetchone()

        comissao_gerente = float(row.Comissao_Gerente) if row and row.Comissao_Gerente is not None else 0

        conn.close()
        return jsonify({"comissao_gerente": comissao_gerente})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
