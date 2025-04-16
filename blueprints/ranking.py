from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc
import datetime

ranking_bp = Blueprint('ranking', __name__)

@ranking_bp.route('/ranking')
def status_pedidos():
    return render_template('ranking.html')

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
),
Base AS (
  SELECT 
    v.ID_Vendedor,       
    v.LogON AS Vendedor,
    v.OBS AS Cargo,
    COUNT(vu.Pedido) AS Orçamentos,
    SUM(vu.Valor) AS Valor,
    CASE
      WHEN v.OBS = 'gerente' THEN 
           (0.2/100.0) * T.TotalValorBruto
      WHEN v.OBS = 'supervisor' THEN 
           (SUM((vu.TabComissao / 100.0) * vu.Valor)
            - SUM((vu.TabComissao / 100.0) * COALESCE(pa.TotalFrete, 0)))
           + ((0.2/100.0) * TV.TotalValorBruto_Vendedor)
      ELSE
           SUM((vu.TabComissao / 100.0) * vu.Valor)
           - SUM((vu.TabComissao / 100.0) * COALESCE(pa.TotalFrete, 0))
    END AS Comissao_Venda,
    SUM(vu.Valor)
      - SUM((vu.TabComissao / 100.0) * vu.Valor)
      - SUM(COALESCE(pa.TotalFrete, 0))
      - SUM(COALESCE(pa.Custo_Total, 0)) AS Lucro
  FROM VendaUnica vu
  INNER JOIN Vendedor v ON v.ID_Vendedor = vu.VENDEDOR
  LEFT JOIN ProdutoAgregado pa ON pa.Pedido = vu.Pedido
  CROSS JOIN Totals T
  CROSS JOIN TotalsVendedor TV
  WHERE 
      v.Ativo = 'True'
    AND v.OBS = 'vendedor'
    AND v.IDEmpresa = ?
  GROUP BY 
    v.ID_Vendedor, v.LogON, v.OBS, T.TotalValorBruto, TV.TotalValorBruto_Vendedor
)
SELECT * FROM Base
UNION ALL
SELECT 
  NULL AS ID_Vendedor,
  'TOTAL' AS Vendedor,
  'TOTAL' AS Cargo,
  SUM(Orçamentos) AS Orçamentos,
  SUM(Valor) AS Valor,
  SUM(Comissao_Venda) AS Comissao_Venda,
  SUM(Lucro) AS Lucro
FROM Base;
        """
        # Ordem dos parâmetros:
        # 1: id_empresa (VendaUnica), 2: data_inicio, 3: data_fim,
        # 4: id_empresa (ProdutoAgregado), 5: id_empresa (TotalsVendedor), 6: id_empresa (Base)
        params = [id_empresa, data_inicio, data_fim, id_empresa, id_empresa, id_empresa]
        with pyodbc.connect(conn_str) as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            resultado = cursor.fetchall()
            columns = [column[0] for column in cursor.description]
            vendas = [dict(zip(columns, row)) for row in resultado]
        return jsonify(vendas)
    except Exception as e:
        return jsonify({"erro": f"Erro ao processar a solicitação: {e}"}), 500
