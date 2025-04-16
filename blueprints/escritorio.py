import datetime
from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc

escritorio_bp = Blueprint('escritorio', __name__)

@escritorio_bp.route('/escritorio')
def escritorio():
    return render_template('escritorio.html')

@escritorio_bp.route('/api/vendas_escritorio', methods=['POST'])
def listar_vendas():
    try:
        # 1) valida JSON
        if not request.is_json:
            return jsonify({"erro": "O cabeçalho Content-Type deve ser 'application/json'."}), 415

        dados = request.get_json()
        data_inicio_str = dados.get("data_inicio")
        data_fim_str    = dados.get("data_fim")
        id_empresa      = dados.get("IDEMPRESA")

        # 2) valida campos obrigatórios
        if not id_empresa:
            return jsonify({"erro": "IDEMPRESA é obrigatório."}), 400

        # 3) converte strings em datetime
        try:
            data_inicio = datetime.datetime.strptime(data_inicio_str, "%Y-%m-%d %H:%M:%S")
            data_fim    = datetime.datetime.strptime(data_fim_str,    "%Y-%m-%d %H:%M:%S")
        except (TypeError, ValueError):
            return jsonify({"erro": "As datas devem estar no formato 'YYYY-MM-DD HH:MM:SS'."}), 400

        # 4) monta a query (igual à sua original)
        query = """
        WITH VendaUnica AS (
          SELECT DISTINCT Pedido, Valor, TabComissao, VENDEDOR
          FROM VENDA
          WHERE IDEmpresa = ?
            AND DataVenda BETWEEN ? AND ?
            AND STATUS = 'V'
            AND Desativo = 'False'
        ),
        ProdutoAgregado AS (
          SELECT Pedido,
                 SUM(COALESCE(Frete,0)) AS TotalFrete,
                 SUM(COALESCE(CustoProd,0)*COALESCE(Quantidade,0)) AS Custo_Total
          FROM Produto_Venda
          WHERE IDEmpresa = ?
          GROUP BY Pedido
        ),
        Totals AS (
          SELECT COALESCE(SUM(vu.Valor),0)        AS TotalValor,
                 COALESCE(SUM(COALESCE(pa.TotalFrete,0)),0) AS TotalFrete,
                 COALESCE(SUM(vu.Valor),0) - COALESCE(SUM(COALESCE(pa.TotalFrete,0)),0) AS TotalValorBruto
          FROM VendaUnica vu
          LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
        ),
        TotalsVendedor AS (
          SELECT COALESCE(SUM(vu.Valor),0)
                 - COALESCE(SUM(COALESCE(pa.TotalFrete,0)),0) AS TotalValorBruto_Vendedor
          FROM VendaUnica vu
          LEFT JOIN Vendedor v ON v.ID_Vendedor = vu.VENDEDOR
          LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
          WHERE v.Ativo = 'True'
            AND v.IDEmpresa = ?
        ),
        Base AS (
          SELECT v.ID_Vendedor,
                 v.LogON    AS Vendedor,
                 v.OBS      AS Cargo,
                 COUNT(vu.Pedido) AS Orçamentos,
                 COALESCE(SUM(vu.Valor),0) AS Valor,
                 CASE
                   WHEN v.OBS = 'gerente'    THEN (0.2/100.0) * T.TotalValorBruto
                   WHEN v.OBS = 'supervisor' THEN
                        (COALESCE(SUM((vu.TabComissao/100.0)*vu.Valor),0)
                         - COALESCE(SUM((vu.TabComissao/100.0)*COALESCE(pa.TotalFrete,0)),0))
                        + ((0.2/100.0) * TV.TotalValorBruto_Vendedor)
                   ELSE
                        COALESCE(SUM((vu.TabComissao/100.0)*vu.Valor),0)
                        - COALESCE(SUM((vu.TabComissao/100.0)*COALESCE(pa.TotalFrete,0)),0)
                 END AS Comissao_Venda,
                 COALESCE(SUM(vu.Valor),0)
                   - COALESCE(SUM((vu.TabComissao/100.0)*vu.Valor),0)
                   - COALESCE(SUM(COALESCE(pa.TotalFrete,0)),0)
                   - COALESCE(SUM(COALESCE(pa.Custo_Total,0)),0) AS Lucro
          FROM Vendedor v
          LEFT JOIN VendaUnica vu ON v.ID_Vendedor = vu.VENDEDOR
          LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
          CROSS JOIN Totals T
          CROSS JOIN TotalsVendedor TV
          WHERE v.Ativo = 'True'
            AND v.IDEmpresa = ?
            AND v.OBS IN ('gerente','vendedor','supervisor','representante')
          GROUP BY v.ID_Vendedor, v.LogON, v.OBS, T.TotalValorBruto, TV.TotalValorBruto_Vendedor
        )
        SELECT * FROM Base
        UNION ALL
        SELECT NULL AS ID_Vendedor,
               'TOTAL' AS Vendedor,
               'TOTAL' AS Cargo,
               SUM(Orçamentos)     AS Orçamentos,
               SUM(Valor)          AS Valor,
               SUM(Comissao_Venda) AS Comissao_Venda,
               SUM(Lucro)          AS Lucro
        FROM Base;
        """

        params = [
            id_empresa,
            data_inicio,
            data_fim,
            id_empresa,
            id_empresa,
            id_empresa
        ]

        # 5) executa no banco e retorna JSON
        with pyodbc.connect(conn_str) as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            cols = [c[0] for c in cursor.description]
            resultados = [dict(zip(cols, row)) for row in cursor.fetchall()]

        return jsonify(resultados)

    except Exception as e:
        return jsonify({"erro": f"Erro ao processar a solicitação: {e}"}), 500