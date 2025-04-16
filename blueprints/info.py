from flask import Blueprint, render_template, jsonify, request, session
from services.database import conn_str
import pyodbc
import datetime
from services.log import log_acesso_info_vendas
info_bp = Blueprint('info', __name__)

@info_bp.route('/info')
def status_pedidos():
    return render_template('info.html')

@info_bp.route("/api/infos", methods=["POST"])
def listar_infos():
    try:
        if not request.is_json:
            return jsonify({"erro": "O cabeçalho Content-Type deve ser 'application/json'."}), 415

        dados = request.get_json()
        data_inicio = dados.get("data_inicio")
        data_fim = dados.get("data_fim")
        vendedor_id = dados.get("usuario")  # Código do vendedor (não utilizado para o log)
        cargo_usuario = dados.get("cargo", "").lower()  # Cargo enviado pelo front-end
        id_empresa = int(dados.get("IDEMPRESA") or 5)

        if not vendedor_id:
            return jsonify({"erro": "Usuário não informado."}), 400

        # Obtém o nome do usuário armazenado na session
        nome_usuario = session.get("usuario")
        if not nome_usuario:
            # Caso não haja na session, usa o valor recebido (convertido para string)
            nome_usuario = str(vendedor_id)

        # Registra o acesso à informação de vendas utilizando o nome da session
        log_acesso_info_vendas(nome_usuario)

        try:
            data_inicio = datetime.datetime.strptime(data_inicio, "%Y-%m-%d %H:%M:%S")
            data_fim = datetime.datetime.strptime(data_fim, "%Y-%m-%d %H:%M:%S")
        except (TypeError, ValueError):
            return jsonify({"erro": "As datas devem estar no formato 'YYYY-MM-DD HH:MM:SS'."}), 400

        with pyodbc.connect(conn_str) as conn:

            def run_query(status):
                query = """
                WITH VendaUnica AS (
                  SELECT DISTINCT 
                         Pedido, 
                         Valor, 
                         TabComissao, 
                         VENDEDOR,
                         CONVERT(varchar, DataVenda, 23) AS Dia
                  FROM VENDA
                  WHERE IDEmpresa = ?
                    AND DataVenda BETWEEN ? AND ?
                    AND STATUS = ?
                    AND Desativo = 'False'
                ),
                ProdutoAgregado AS (
                  SELECT 
                         Pedido,
                         SUM(COALESCE(Frete, 0)) AS TotalFrete,
                         SUM(COALESCE(CustoProd, 0) * COALESCE(Quantidade, 0)) AS Custo_Total
                  FROM Produto_Venda
                  WHERE IDEmpresa = ?
                  GROUP BY Pedido
                ),
                Totals AS (
                  SELECT
                    SUM(vu.Valor) AS TotalValor,
                    SUM(COALESCE(pa.TotalFrete, 0)) AS TotalFrete,
                    SUM(vu.Valor) - SUM(COALESCE(pa.TotalFrete, 0)) AS TotalValorBruto
                  FROM VendaUnica vu
                  LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
                ),
                TotalsVendedor AS (
                  SELECT
                    SUM(vu.Valor) - SUM(COALESCE(pa.TotalFrete, 0)) AS TotalValorBruto_Vendedor
                  FROM VendaUnica vu
                  LEFT JOIN Vendedor v ON v.ID_Vendedor = vu.VENDEDOR
                  LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
                  WHERE v.Ativo = 'True'
                    AND v.OBS = 'vendedor'
                    AND v.IDEmpresa = ?
                ),
                Base AS (
                  SELECT 
                    v.ID_Vendedor,  
                    v.LogON AS Vendedor,
                    v.OBS AS Cargo,
                    vu.Dia,
                    COUNT(vu.Pedido) AS Orçamentos,
                    SUM(vu.Valor) AS TotalVenda,
                    CASE
                      WHEN v.OBS = 'gerente' THEN 
                           (0.2/100.0) * T.TotalValorBruto
                      WHEN v.OBS = 'supervisor' THEN 
                           SUM((vu.TabComissao / 100.0) * vu.Valor)
                           - SUM((vu.TabComissao / 100.0) * COALESCE(pa.TotalFrete, 0))
                      ELSE
                           SUM((vu.TabComissao / 100.0) * vu.Valor)
                           - SUM((vu.TabComissao / 100.0) * COALESCE(pa.TotalFrete, 0))
                    END AS TotalComissao,
                    SUM(vu.Valor)
                      - SUM((vu.TabComissao / 100.0) * vu.Valor)
                      - SUM(COALESCE(pa.TotalFrete, 0))
                      - SUM(COALESCE(pa.Custo_Total, 0)) AS Lucro
                  FROM Vendedor v
                  LEFT JOIN VendaUnica vu ON v.ID_Vendedor = vu.VENDEDOR
                  LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
                  CROSS JOIN Totals T
                  CROSS JOIN TotalsVendedor TV
                  WHERE 
                      v.Ativo = 'True'
                    AND v.OBS IN ('vendedor', 'supervisor', 'gerente', 'representante')
                    AND v.IDEmpresa = ?
                  GROUP BY 
                    v.ID_Vendedor, v.LogON, v.OBS, vu.Dia, T.TotalValorBruto, TV.TotalValorBruto_Vendedor
                )
                SELECT * FROM Base
                WHERE ID_Vendedor = ?
                UNION ALL
                SELECT 
                  NULL AS ID_Vendedor, 
                  'TOTAL' AS Vendedor,
                  'TOTAL' AS Cargo,
                  NULL AS Dia,
                  SUM(Orçamentos) AS Orçamentos,
                  SUM(TotalVenda) AS TotalVenda,
                  SUM(TotalComissao) AS TotalComissao,
                  SUM(Lucro) AS Lucro
                FROM Base
                WHERE ID_Vendedor = ?;
                """
                params = [
                    id_empresa, data_inicio, data_fim, status,  # VendaUnica
                    id_empresa,                                 # ProdutoAgregado
                    id_empresa,                                 # TotalsVendedor
                    id_empresa,                                 # Base
                    vendedor_id,                                # Filtro para diárias
                    vendedor_id                                 # Filtro para total
                ]
                cursor = conn.cursor()
                cursor.execute(query, params)
                resultado = cursor.fetchall()
                columns = [column[0] for column in cursor.description]
                vendas = [dict(zip(columns, row)) for row in resultado]
                diarias = [row for row in vendas if row["Dia"] is not None]
                total = next((row for row in vendas if row["Dia"] is None), None)
                if total is None:
                    total = {"TotalVenda": 0, "TotalComissao": 0, "Orçamentos": 0, "Lucro": 0}
                return {"diarias": diarias, "total": total}

            def run_query_supervisor_gerente():
                query = """
                WITH VendaUnica AS (
                  SELECT DISTINCT 
                         Pedido, 
                         Valor, 
                         TabComissao, 
                         VENDEDOR
                  FROM VENDA
                  WHERE IDEmpresa = ?
                    AND DataVenda BETWEEN ? AND ?
                    AND STATUS = 'V'
                    AND Desativo = 'False'
                ),
                ProdutoAgregado AS (
                  SELECT 
                         Pedido,
                         SUM(COALESCE(Frete, 0)) AS TotalFrete,
                         SUM(COALESCE(CustoProd, 0) * COALESCE(Quantidade, 0)) AS Custo_Total
                  FROM Produto_Venda
                  WHERE IDEmpresa = ?
                  GROUP BY Pedido
                ),
                Totals AS (
                  SELECT
                    SUM(vu.Valor) AS TotalValor,
                    SUM(COALESCE(pa.TotalFrete, 0)) AS TotalFrete,
                    SUM(vu.Valor) - SUM(COALESCE(pa.TotalFrete, 0)) AS TotalValorBruto
                  FROM VendaUnica vu
                  LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
                ),
                TotalsVendedor AS (
                  SELECT
                    SUM(vu.Valor) - SUM(COALESCE(pa.TotalFrete, 0)) AS TotalValorBruto_Vendedor
                  FROM VendaUnica vu
                  INNER JOIN Vendedor v ON v.ID_Vendedor = vu.VENDEDOR
                  LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
                  WHERE v.Ativo = 'True'
                    AND v.OBS = 'vendedor'
                    AND v.IDEmpresa = ?
                )
                SELECT 
                  v.OBS AS Cargo,
                  CASE
                    WHEN v.OBS = 'gerente' THEN 
                         (0.2 / 100.0) * T.TotalValorBruto
                    WHEN v.OBS = 'supervisor' THEN 
                         (SUM((vu.TabComissao / 100.0) * vu.Valor)
                          - SUM((vu.TabComissao / 100.0) * COALESCE(pa.TotalFrete, 0)))
                         + ((0.2 / 100.0) * TV.TotalValorBruto_Vendedor)
                    ELSE
                         SUM((vu.TabComissao / 100.0) * vu.Valor)
                         - SUM((vu.TabComissao / 100.0) * COALESCE(pa.TotalFrete, 0))
                  END AS Comissao_Venda
                FROM VendaUnica vu
                INNER JOIN Vendedor v ON v.ID_Vendedor = vu.VENDEDOR
                LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
                LEFT JOIN Totals T ON 1 = 1
                LEFT JOIN TotalsVendedor TV ON 1 = 1
                WHERE v.Ativo = 'True'
                  AND v.OBS IN ('supervisor', 'gerente')
                  AND v.IDEmpresa = ?
                GROUP BY 
                  v.OBS, T.TotalValorBruto, TV.TotalValorBruto_Vendedor;
                """
                params = [
                    id_empresa, data_inicio, data_fim,
                    id_empresa,
                    id_empresa,
                    id_empresa
                ]
                cursor = conn.cursor()
                cursor.execute(query, params)
                resultado = cursor.fetchall()
                resultado_dict = {}
                columns = [column[0] for column in cursor.description]
                for row in resultado:
                    registro = dict(zip(columns, row))
                    cargo = registro.get("Cargo", "").lower()
                    resultado_dict[cargo] = registro.get("Comissao_Venda")
                return resultado_dict

            realizadas = run_query('V')
            if cargo_usuario in ("supervisor", "gerente"):
                alt_result = run_query_supervisor_gerente()
                if realizadas.get("total") is not None and alt_result.get(cargo_usuario) is not None:
                    realizadas["total"]["TotalComissao"] = alt_result[cargo_usuario]
                    realizadas["total"]["Comissao_Venda"] = alt_result[cargo_usuario]
            pendentes = run_query('S')

        return jsonify({"realizadas": realizadas, "pendentes": pendentes})

    except Exception as e:
        return jsonify({"erro": f"Erro ao processar a solicitação: {e}"}), 500

@info_bp.route("/api/meta", methods=["POST"])
def obter_meta():
    try:
        if not request.is_json:
            return jsonify({"erro": "O cabeçalho Content-Type deve ser 'application/json'."}), 415

        dados = request.get_json()
        id_empresa = int(dados.get("IDEMPRESA") or 5)
        vendedor_id = dados.get("usuario")
        if not vendedor_id:
            return jsonify({"erro": "Usuário não informado."}), 400

        now = datetime.datetime.now()
        mes_n = now.month
        ano = now.year

        with pyodbc.connect(conn_str) as conn:
            query = """
                SELECT *
                FROM Meta_Vendedor
                WHERE IDEmpresa = ? AND Mes_N = ? AND Ano = ? AND ID_Vendedor = ?
            """
            cursor = conn.cursor()
            cursor.execute(query, (id_empresa, mes_n, ano, vendedor_id))
            row = cursor.fetchone()
            if row:
                columns = [column[0] for column in cursor.description]
                meta = dict(zip(columns, row))
            else:
                meta = None
        return jsonify({"meta": meta})
    except Exception as e:
        return jsonify({"erro": f"Erro ao processar a solicitação: {e}"}), 500
