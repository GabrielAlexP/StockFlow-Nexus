import pdfkit
from flask import Blueprint, render_template, make_response, request, current_app
import pyodbc
from datetime import datetime, timedelta
import calendar
from services.database import conn_str

path_wkhtmltopdf = r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe"
config = pdfkit.configuration(wkhtmltopdf=path_wkhtmltopdf)

report_bp = Blueprint('report', __name__)

def get_report_data_for_period(start_date, end_date, report_date_label):
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    
    query = f"""
    WITH VendaUnica AS (
      SELECT DISTINCT 
             Pedido, 
             Valor, 
             TabComissao, 
             VENDEDOR
      FROM VENDA
      WHERE IDEmpresa = 5
        AND DataVenda BETWEEN '{start_date}' AND '{end_date}'
        AND STATUS = 'V'
        AND Desativo = 'False'
    ),
    ProdutoAgregado AS (
      SELECT 
             Pedido,
             SUM(COALESCE(Frete, 0)) AS TotalFrete,
             SUM(COALESCE(CustoProd, 0) * COALESCE(Quantidade, 0)) AS Custo_Total
      FROM Produto_Venda
      WHERE IDEmpresa = 5
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
        AND v.IDEmpresa = 5
    ),
    Base AS (
      SELECT 
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
        AND v.OBS IN ('vendedor', 'supervisor', 'gerente')
        AND v.IDEmpresa = 5
      GROUP BY 
        v.LogON, v.OBS, T.TotalValorBruto, TV.TotalValorBruto_Vendedor
    )
    SELECT * FROM Base
    UNION ALL
    SELECT 
      'TOTAL' AS Vendedor,
      NULL AS Cargo,
      SUM(Orçamentos) AS Orçamentos,
      SUM(Valor) AS Valor,
      SUM(Comissao_Venda) AS Comissao_Venda,
      SUM(Lucro) AS Lucro
    FROM Base;
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    columns = [column[0] for column in cursor.description]
    data_list = [dict(zip(columns, row)) for row in rows]

    vendedores = []
    supervisores = []
    gerentes = []
    total = None

    for item in data_list:
        if item["Vendedor"] == "TOTAL":
            total = {
                'nome': item["Vendedor"],
                'venda': item["Valor"],
                'lucro': item["Lucro"],
                'comissao': item["Comissao_Venda"],
                'orcamentos': item["Orçamentos"]
            }
        else:
            data_item = {
                'nome': item["Vendedor"],
                'venda': item["Valor"],
                'lucro': item["Lucro"],
                'comissao': item["Comissao_Venda"],
                'orcamentos': item["Orçamentos"]
            }
            if item["Cargo"] == "vendedor":
                vendedores.append(data_item)
            elif item["Cargo"] == "supervisor":
                supervisores.append(data_item)
            elif item["Cargo"] == "gerente":
                gerentes.append(data_item)

    report_data = {
        'report_date': report_date_label,
        'vendedores': vendedores,
        'supervisores': supervisores,
        'gerentes': gerentes,
        'total': total,
    }

    conn.close()
    return report_data

def get_report_data():
    today = datetime.now()
    yesterday = today - timedelta(days=1)

    # Período de Ontem
    ontem_start = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0)
    ontem_end = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59)
    data_ontem = get_report_data_for_period(
        ontem_start.strftime('%Y-%m-%d %H:%M:%S'),
        ontem_end.strftime('%Y-%m-%d %H:%M:%S'),
        yesterday.strftime('%d/%m/%Y')
    )

    # Mapeamento dos meses para os nomes em português
    month_names = {
        1: "Janeiro",
        2: "Fevereiro",
        3: "Março",
        4: "Abril",
        5: "Maio",
        6: "Junho",
        7: "Julho",
        8: "Agosto",
        9: "Setembro",
        10: "Outubro",
        11: "Novembro",
        12: "Dezembro"
    }

    # Período do Mês de Ontem
    month_start = datetime(yesterday.year, yesterday.month, 1, 0, 0, 0)
    last_day = calendar.monthrange(yesterday.year, yesterday.month)[1]
    month_end = datetime(yesterday.year, yesterday.month, last_day, 23, 59, 59)
    data_mes = get_report_data_for_period(
        month_start.strftime('%Y-%m-%d %H:%M:%S'),
        month_end.strftime('%Y-%m-%d %H:%M:%S'),
        month_names[yesterday.month]
    )

    return {
        'ontem': data_ontem,
        'mes': data_mes,
    }

def generate_pdf(report_data):
    rendered_html = render_template('relatorio.html', data=report_data)
    options = {
        'page-size': 'A4',
        'encoding': 'UTF-8',
        'margin-top': '0in', 
        'margin-right': '0in', 
        'margin-bottom': '0in', 
        'margin-left': '0in'
    }
    pdf = pdfkit.from_string(rendered_html, False, options=options, configuration=config)
    return pdf

def gerar_relatorio_completo_bytes():
    data = get_report_data()
    rendered_html = render_template('relatorio.html', data=data)
    options = {
        'page-size': 'A4',
        'encoding': 'UTF-8',
    }
    pdf_bytes = pdfkit.from_string(rendered_html, False, options=options, configuration=config)
    return ("relatorio.pdf", pdf_bytes)

def currency_format(value):
    try:
        value = float(value)
        formatted = format(value, ",.2f")
        formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")
        return "R$ " + formatted
    except (ValueError, TypeError):
        return value

@report_bp.before_app_request
def register_filters():

    current_app.jinja_env.filters['currency_format'] = currency_format

@report_bp.route('/relatorio')
def relatorio():
    data = get_report_data()
    if request.args.get('pdf', '').lower() in ['true', '1']:
        pdf = generate_pdf(data)
        response = make_response(pdf)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = 'inline; filename=relatorio.pdf'
        return response
    return render_template('relatorio.html', data=data)
