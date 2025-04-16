from flask import Blueprint, render_template, jsonify, request, Response, url_for
from services.database import conn_str
import pyodbc
import pdfkit
from datetime import datetime
import base64
from io import BytesIO
from PIL import Image
import os
import tempfile
from services.log import log_entrega 
import platform

entrega_bp = Blueprint('entrega', __name__)

def get_empresa_from_request():
    """
    Tenta obter o IDEmpresa do query string (GET) ou do corpo JSON (POST).
    Se não for possível convertê-lo para inteiro, lança exceção.
    """
    empresa = None
    if request.method == 'GET':
        empresa = request.args.get('empresa')
    elif request.method == 'POST':
        data = request.get_json() or {}
        empresa = data.get('empresa')
    try:
        return int(empresa)
    except Exception as e:
        raise ValueError("IDEmpresa não informado ou inválido")

@entrega_bp.route('/entrega')
def entrega():
    return render_template('entrega.html')

# Endpoint para buscar os vendedores
@entrega_bp.route('/vendedores', methods=['GET'])
def vendedores():
    try:
        ide = get_empresa_from_request()
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        query = ("SELECT ID_Vendedor, LogON FROM Vendedor "
                 "WHERE IDEmpresa = ? AND OBS IN ('vendedor', 'gerente', 'supervisor', 'admin')")
        cursor.execute(query, ide)
        sellers = []
        for row in cursor.fetchall():
            sellers.append({
                'ID_Vendedor': row.ID_Vendedor,
                'LogON': row.LogON
            })
        return jsonify(sellers)
    except Exception as e:
        return jsonify({'error': str(e)})
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass

# Endpoint para pesquisar vendas
@entrega_bp.route('/pesquisar', methods=['GET'])
def pesquisar():
    filtro = request.args.get('filtro')
    valor = request.args.get('valor', '').strip()
    vendedor = request.args.get('vendedor', '').strip()  # opcional

    if not filtro:
        return jsonify({'error': 'Por favor, selecione um filtro'})

    try:
        ide = get_empresa_from_request()
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        base_query = ("SELECT v.Pedido, v.NomeCliente, v.IDCliente, v.DataVenda, v.Situação, "
                      "ven.LogON as Vendedor FROM Venda v JOIN Vendedor ven ON v.Vendedor = ven.ID_Vendedor "
                      "WHERE v.IDEmpresa = ? AND v.STATUS = 'V' AND v.Desativo = 'False' ")
        params = [ide]

        if filtro.lower() == 'pedido':
            try:
                pedido = int(valor)
            except ValueError:
                return jsonify({'error': 'Valor de pedido inválido'})
            base_query += "AND v.Pedido = ? "
            params.append(pedido)
        elif filtro.lower() == 'cliente':
            base_query += "AND v.NomeCliente LIKE ? "
            params.append(f"%{valor}%")
        else:
            return jsonify({'error': 'Filtro inválido'})

        if vendedor:
            base_query += "AND v.Vendedor = ? "
            params.append(vendedor)

        cursor.execute(base_query, params)
        rows = cursor.fetchall()
        results = []
        for row in rows:
            results.append({
                'Pedido': row.Pedido,
                'NomeCliente': row.NomeCliente,
                'IDCliente': row.IDCliente,
                'DataVenda': row.DataVenda.strftime('%Y-%m-%d') if row.DataVenda else None,
                'Situação': row.Situação,
                'Vendedor': row.Vendedor
            })
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)})
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass

# Endpoint para retornar os detalhes do modal
@entrega_bp.route('/modal_detalhes', methods=['GET'])
def modal_detalhes():
    pedido = request.args.get('pedido', '').strip()
    if not pedido:
        return jsonify({'error': 'Pedido não informado'})
    try:
        pedido_int = int(pedido)
    except ValueError:
        return jsonify({'error': 'Pedido inválido'})

    try:
        ide = get_empresa_from_request()
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        query_pv = ("SELECT IDProduto, Descrição, Quantidade FROM Produto_Venda "
                    "WHERE IDEmpresa = ? AND Pedido = ?")
        cursor.execute(query_pv, ide, pedido_int)
        produtos = {}
        for row in cursor.fetchall():
            produtos[row.IDProduto] = {
                'IDProduto': row.IDProduto,
                'Descrição': row.__getattribute__('Descrição'),
                'Quantidade': row.Quantidade
            }

        query_der = ("SELECT IDProduto, Qtd FROM DetEntrega_Romaneio "
                     "WHERE IDEmpresa = ? AND Pedido = ?")
        cursor.execute(query_der, ide, pedido_int)
        entregas = {}
        for row in cursor.fetchall():
            if row.IDProduto in entregas:
                entregas[row.IDProduto] += row.Qtd
            else:
                entregas[row.IDProduto] = row.Qtd

        result = []
        for idproduto, prod in produtos.items():
            qtd_entregue = entregas.get(idproduto, 0)
            result.append({
                'IDProduto': prod['IDProduto'],
                'Descrição': prod['Descrição'],
                'Quantidade': prod['Quantidade'],
                'QtdEntregue': qtd_entregue
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)})
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass

@entrega_bp.route('/gerar_pdf', methods=['POST'])
def gerar_pdf():
    try:
        data = request.get_json()

        # Obtém a variável 'situacao' enviada pelo front-end
        situacao = data.get('situacao')
        if not situacao:
            return jsonify({'error': 'Situação não informada'}), 400

        try:
            idCliente = int(data.get('idCliente'))
        except (ValueError, TypeError):
            return jsonify({'error': 'IDCliente inválido'}), 400

        pedido = data.get('pedido')
        if not pedido:
            return jsonify({'error': 'Pedido não informado'}), 400

        produtos = data.get('produtos', [])

        # Processamento da assinatura
        assinatura_base64 = data.get('assinatura')
        assinatura_path = None
        if assinatura_base64:
            try:
                assinatura_data = base64.b64decode(assinatura_base64.split(",")[1])
                assinatura_image = Image.open(BytesIO(assinatura_data))
                temp_dir = tempfile.gettempdir()
                assinatura_path = os.path.join(temp_dir, "assinatura.png")
                assinatura_image.save(assinatura_path, format="PNG")
            except Exception as e:
                return jsonify({'error': 'Erro ao processar assinatura: ' + str(e)}), 500
        else:
            return jsonify({'error': 'Assinatura não confirmada'}), 400

        # Obtém o IDEmpresa do payload
        try:
            ide = int(data.get('empresa'))
        except Exception as e:
            return jsonify({'error': 'IDEmpresa não informado ou inválido'}), 400

        # Atualiza o status na tabela Venda
        try:
            conn_update = pyodbc.connect(conn_str)
            cursor_update = conn_update.cursor()
            update_query = "UPDATE Venda SET Situação = ? WHERE IDEmpresa = ? AND Pedido = ?"
            cursor_update.execute(update_query, (situacao, ide, pedido))
            conn_update.commit()
            cursor_update.close()
            conn_update.close()
        except Exception as e:
            return jsonify({'error': 'Erro ao atualizar status da venda: ' + str(e)}), 500

        # Consulta para obter informações do cliente
        client_info = {}
        try:
            conn = pyodbc.connect(conn_str)
            cursor = conn.cursor()
            query_pf = """
                SELECT Nome, Rua, Num, Bairro, CEP, Cidade, UF, CPF, TelResid 
                FROM PFisica 
                WHERE ID_Pfisica = ?
            """
            cursor.execute(query_pf, idCliente)
            pf = cursor.fetchone()
            if pf:
                client_info = {
                    'clienteNome': pf.Nome,
                    'clienteRua': pf.Rua,
                    'clienteNum': pf.Num,
                    'clienteBairro': pf.Bairro,
                    'clienteCEP': pf.CEP,
                    'clienteCidade': pf.Cidade,
                    'clienteUF': pf.UF,
                    'clienteDocumento': pf.CPF,
                    'clienteTelefone': pf.TelResid,
                    'clienteIE': ""
                }
            else:
                query_pj = """
                    SELECT RasSocial, InscEstadual, CNPJ, Rua, Num, Bairro, CEP, Cidade, UF, Tel01 
                    FROM PJuridica 
                    WHERE ID_Pjuridica = ?
                """
                cursor.execute(query_pj, idCliente)
                pj = cursor.fetchone()
                if pj:
                    client_info = {
                        'clienteNome': pj.RasSocial,
                        'clienteRua': pj.Rua,
                        'clienteNum': pj.Num,
                        'clienteBairro': pj.Bairro,
                        'clienteCEP': pj.CEP,
                        'clienteCidade': pj.Cidade,
                        'clienteUF': pj.UF,
                        'clienteDocumento': pj.CNPJ,
                        'clienteTelefone': pj.Tel01,
                        'clienteIE': pj.InscEstadual,
                    }
                else:
                    return jsonify({'error': 'Cliente não encontrado'}), 404
            cursor.close()
            conn.close()
        except Exception as e:
            return jsonify({'error': 'Erro ao buscar informações do cliente: ' + str(e)}), 500

        # Define o texto do status para o PDF
        orderStatus = "Pedido Entregue" if situacao == 'Entregue' else "Pedido Entregue Part."

        now = datetime.now()
        dataRegistro = now.strftime('%d/%m/%Y')
        horaRegistro = now.strftime('%H:%M:%S')

        # Consulta para obter o novo CodEntrega
        try:
            conn_barcode = pyodbc.connect(conn_str)
            cursor_barcode = conn_barcode.cursor()
            query_cod = "SELECT MAX(CodEntrega) AS MaiorCodEntrega FROM DetEntrega_Romaneio WHERE IDEmpresa = ?"
            cursor_barcode.execute(query_cod, ide)
            result_cod = cursor_barcode.fetchone()
            maiorCod = result_cod.MaiorCodEntrega if result_cod and result_cod.MaiorCodEntrega is not None else 0
            novoCodEntrega = maiorCod + 1
            cursor_barcode.close()
            conn_barcode.close()
        except Exception as e:
            return jsonify({'error': 'Erro ao obter novo CodEntrega: ' + str(e)}), 500

        # Prepara os valores para o insert na tabela Entrega_Romaneio
        dataEntrega = now.strftime('%Y-%m-%d') + " 00:00:00"
        horario = "1900-01-01 " + now.strftime('%H:%M:%S.%f')[:-3]
        idTransportadora = data.get('transportadora')
        conferido_por = data.get('conferido_por', '')

        # Recupera o ID do usuário logado com base no nome (conferido_por)
        try:
            conn_usuario = pyodbc.connect(conn_str)
            cursor_usuario = conn_usuario.cursor()
            query_usuario = "SELECT ID FROM dbo.[Usuário] WHERE IDEmpresa = ? AND USUARIO = ?"
            cursor_usuario.execute(query_usuario, (ide, conferido_por))
            row_usuario = cursor_usuario.fetchone()
            if not row_usuario:
                return jsonify({'error': 'Usuário não encontrado'}), 404
            user_id = row_usuario.ID
            cursor_usuario.close()
            conn_usuario.close()
        except Exception as e:
            return jsonify({'error': 'Erro ao obter ID do usuário: ' + str(e)}), 500

        try:
            conn_inserts = pyodbc.connect(conn_str)
            cursor_inserts = conn_inserts.cursor()

            insert_query = """
            INSERT INTO Entrega_Romaneio 
            (Pedido, CodEntrega, DataEntrega, Horario, USUARIO, Tipo, IDTransportadora, Conferido, IDEmpresa, OBS, Layout)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            params = (
                pedido,
                novoCodEntrega,
                dataEntrega,
                horario,
                user_id,        
                situacao,  
                idTransportadora,
                conferido_por,
                ide,
                '',
                1
            )
            cursor_inserts.execute(insert_query, params)

            insert_detail_query = """
            INSERT INTO DetEntrega_Romaneio (Pedido, IDProduto, Qtd, IDEmpresa, CodEntrega, Item, XGrade, YGrade)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            item_number = 1
            for prod in produtos:
                try:
                    qtd = float(prod.get('qtd', 0))
                except (ValueError, TypeError):
                    qtd = 0
                if qtd > 0:
                    cursor_inserts.execute(insert_detail_query, 
                        (pedido, prod.get('codigo'), qtd, ide, novoCodEntrega, item_number, 0, 0))
                    item_number += 1

            conn_inserts.commit()
            cursor_inserts.close()
            conn_inserts.close()
        except Exception as e:
            return jsonify({'error': 'Erro ao inserir registros de entrega: ' + str(e)}), 500

        # Renderiza o template do PDF
        logo_url = url_for('static', filename='img/logo.png', _external=True)
        html = render_template('rel_entrega.html',
                               orderStatus=orderStatus,
                               dataRegistro=dataRegistro,
                               horaRegistro=horaRegistro,
                               novoCodEntrega=novoCodEntrega,
                               pedido=pedido,
                               logo_url=logo_url,
                               assinatura_path=assinatura_path,
                               responsavel_nome=data.get('responsavel_nome', ''),
                               responsavel_telefone=data.get('responsavel_telefone', ''),
                               responsavel_cpf=data.get('responsavel_cpf', ''),
                               conferido_por=conferido_por,
                               transportadora_nome=data.get('transportadora_nome', ''),
                               **client_info,
                               produtos=produtos)
        
        if not html.strip() or "<body>" not in html.lower():
            html = "<html><body><div style='min-height:100vh;'><h1>Relatório de Entrega</h1><p>Conteúdo não disponível.</p></div></body></html>"

        if platform.system() == "Windows":
            path_wkhtmltopdf = r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe"
        else:
            path_wkhtmltopdf = "/usr/bin/wkhtmltopdf"

        config_pdf = pdfkit.configuration(wkhtmltopdf=path_wkhtmltopdf)

        options = {
            'page-size': 'A4',
            'encoding': 'UTF-8',
            'margin-top': '0in',
            'margin-right': '0in',
            'margin-bottom': '0in',
            'margin-left': '0in',
            'enable-local-file-access': '',
            'print-media-type': ''
        }
        pdf = pdfkit.from_string(html, False, options=options, configuration=config_pdf)

        if not pdf or len(pdf) < 100:
            return jsonify({'error': 'PDF gerado está vazio ou inválido.'}), 500

        dat_inclusao = now.strftime('%Y-%m-%d %H:%M:%S')

        # Verifica se já existe um arquivo com este nome e define um nome único utilizando parênteses
        conn_doc_check = pyodbc.connect(conn_str)
        cursor_doc_check = conn_doc_check.cursor()
        query_check = "SELECT NOM_ARQUIVO FROM cadarquivos WHERE COD_EMPRESA = ? AND NOM_ARQUIVO LIKE ?"
        pedidoPattern = f"{pedido}%.pdf"
        cursor_doc_check.execute(query_check, (ide, pedidoPattern))
        existing_files = [row.NOM_ARQUIVO for row in cursor_doc_check.fetchall()]
        cursor_doc_check.close()
        conn_doc_check.close()

        fileName = f"{pedido}.pdf"
        if fileName in existing_files:
            i = 2
            while f"{pedido}({i}).pdf" in existing_files:
                i += 1
            fileName = f"{pedido}({i}).pdf"

        # Insere o documento na tabela cadarquivos
        conn_doc = pyodbc.connect(conn_str)
        cursor_doc = conn_doc.cursor()
        insert_doc_query = """
        INSERT INTO cadarquivos 
        (IND_LOCAL, COD_EMPRESA, COD_DOCUMENTO, NOM_ARQUIVO, DAT_INCLUSAO, IND_TIPO, ARQ_01, ARQ_02)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        doc_params = (
            6,
            ide,
            novoCodEntrega,
            fileName,
            dat_inclusao,
            5,
            pdf,
            None
        )
        cursor_doc.execute(insert_doc_query, doc_params)
        conn_doc.commit()
        cursor_doc.close()
        conn_doc.close()

        # Insere os dados de contato na tabela Contato_Entrega
        try:
            conn_contato = pyodbc.connect(conn_str)
            cursor_contato = conn_contato.cursor()
            insert_contato_query = """
            INSERT INTO Contato_Entrega (Nome, CPF, Tel, Data, IDEmpresa, Pedido)
            VALUES (?, ?, ?, ?, ?, ?)
            """
            contato_params = (
                data.get('responsavel_nome'),
                data.get('responsavel_cpf'),
                data.get('responsavel_telefone'),
                dat_inclusao,
                ide,
                pedido
            )
            cursor_contato.execute(insert_contato_query, contato_params)
            conn_contato.commit()
            cursor_contato.close()
            conn_contato.close()
        except Exception as e:
            return jsonify({'error': 'Erro ao inserir informações de contato: ' + str(e)}), 500

        # --- Novo: Log de entrega ---
        log_entrega(conferido_por, pedido)

        response = Response(pdf, mimetype='application/pdf')
        response.headers['Content-Disposition'] = f'inline; filename={fileName}'
        return response

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@entrega_bp.route('/transportadoras', methods=['GET'])
def transportadoras():
    try:
        ide = get_empresa_from_request()
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        query = ("SELECT IDTransportadora, RasSocial FROM Transportadora WHERE IDEmpresa = ?")
        cursor.execute(query, ide)
        transportadoras = []
        for row in cursor.fetchall():
            transportadoras.append({
                'IDTransportadora': row.IDTransportadora,
                'RasSocial': row.RasSocial
            })
        return jsonify(transportadoras)
    except Exception as e:
        return jsonify({'error': str(e)})
    finally:
        try:
            cursor.close()
            conn.close()
        except:
            pass
