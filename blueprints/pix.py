import os
import json
import datetime
import random
import requests
import urllib3
import threading
import time
from flask import Blueprint, render_template, jsonify, request, session
from services.database import get_connection
from services.decrypt_itau import descriptografar_api
from services.log import (
    log_pix_acesso,
    log_pix_qr_gerado,
    log_pix_pago,
    log_pix_expirado,
    log_pix_cancelado
)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Carrega a configuração criptografada 
config = descriptografar_api()
itau_api_key = config.get("itau_api_key")
client_cert = config.get("client_cert_path")
client_key = config.get("client_key_path")
token_url = config.get("token_url")
pix_endpoint_template = config.get("pix_endpoint")

pix_bp = Blueprint('pix', __name__)

def load_config():
    return descriptografar_api()

def get_access_token():
    config_local = load_config()
    url = config_local.get("token_url")
    payload = {
        'grant_type': 'client_credentials',
        'client_id': config_local.get('client_id'),
        'client_secret': config_local.get('client_secret')
    }
    headers = {
        'x-itau-flowID': config_local.get('flow_id', "1"),
        'x-itau-correlationID': config_local.get('correlation_id', "2"),
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    response = requests.post(url=url, data=payload, headers=headers,
                             cert=(client_cert, client_key), verify=False)
    if response.status_code != 200:
        raise Exception(f"Erro ao obter access_token: {response.status_code} - {response.text}")
    data = response.json()
    return data.get("access_token")

def monitor_qr_status(txid, vencimento_str):
    try:
        vencimento = datetime.datetime.strptime(vencimento_str, "%Y-%m-%d %H:%M:%S")
    except Exception as e:
        return

    while True:
        now = datetime.datetime.now()
        if now > vencimento:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE Pix_QR SET Status = 'EXPIRADO' WHERE TxID = ?", (txid,))
            conn.commit()
            # Se já passou da validade, encerra o monitoramento
            break
           
        try:
            access_token = get_access_token()
        except Exception as e:
            time.sleep(5)
            continue

        headers = {
            "Content-Type": "application/json",
            "x-itau-apikey": itau_api_key,
            "Authorization": f"Bearer {access_token}"
        }
        # Utiliza o endpoint configurado, formatando com o txid
        url = pix_endpoint_template.format(txid=txid)
        try:
            response = requests.get(url, headers=headers, cert=(client_cert, client_key), verify=False)
        except Exception as e:
            time.sleep(5)
            continue

        if response.status_code != 200:
            time.sleep(5)
            continue

        status_json = response.json()
        current_status = status_json.get("status", "").upper()
        if current_status in ["PAGA", "CONCLUIDA"]:
            try:
                conn = get_connection()
                cursor = conn.cursor()
                # Recupera os dados de Pedido e IDEmpresa da linha Pix_QR
                cursor.execute("SELECT Pedido, IDEmpresa FROM Pix_QR WHERE TxID = ?", (txid,))
                row = cursor.fetchone()
                pedido = row[0] if row else None
                empresa = row[1] if row else None

                # Obtenha o endToEndId (para IDPag) e os demais detalhes
                end_doc = get_endtoendid(txid)
                details = get_pix_details(txid)
                horario_pag = details.get("horario")
                ident_pagador = details.get("infoPagador")
                nome_pagador = details.get("nomePagador")

                cursor.execute("""
                    UPDATE Pix_QR
                    SET Status = 'PAGO',
                        IDPag = ?,
                        NomePagador = ?,
                        IdentPagador = ?,
                        DataPag = ?
                    WHERE TxID = ?
                """, (end_doc, nome_pagador, ident_pagador, horario_pag, txid))
                conn.commit()

                # Atualiza também a tabela VENDA, se possível
                if pedido and empresa:
                    cursor.execute("""
                        UPDATE VENDA
                        SET DataVenda = ?, HoraVenda = ?
                        WHERE IDEmpresa = ? AND Pedido = ?
                    """, (horario_pag, horario_pag, empresa, pedido))
                    conn.commit()
                break
            except Exception as e:
                break

        time.sleep(5)

@pix_bp.route('/pix')
def pix():
    return render_template('pix.html')

@pix_bp.route('/get_order', methods=['POST'])
def get_order():
    data = request.get_json()
    pedido = data.get("pedido")
    if not pedido:
        return jsonify({"error": "Número do pedido não informado"}), 400

    try:
        conn = get_connection()
        cursor = conn.cursor()
        query = """
            SELECT NomeCliente, CNPJeCPF, Valor, FormaPagamento, DataVenda, IDCliente, OBS, Vendedor 
            FROM Venda 
            WHERE IDEmpresa = 5 AND Pedido = ? AND Status = 'S' AND Desativo = 'False'
        """
        cursor.execute(query, (pedido,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Pedido está desativado, ou já foi vendido. Por favor, insira um pedido válido"}), 400

        nome, cnpjecpf, valor, forma_pag, data_venda, id_cliente, obs, vendedor = row

        cursor.execute("""
            SELECT vfp.Parcela, vfp.Valor, tp.Descrição
            FROM Venda_FormaPag vfp
            JOIN TipoPagamento tp ON vfp.IDTipoPag = tp.IDPagamento
            WHERE vfp.IDEmpresa = 5 AND vfp.Pedido = ?
            ORDER BY vfp.Parcela
        """, (pedido,))
        parcelas = cursor.fetchall()
        parcelas_list = []
        all_pix = True
        for p in parcelas:
            parcela, valor_parcela, descricao = p
            parcelas_list.append({
                "Parcela": parcela,
                "Valor": f"{float(valor_parcela):.2f}",
                "Descrição": descricao
            })
            if descricao.strip().upper() != "PIX":
                all_pix = False

        valor_formatado = f"{float(valor):.2f}"
        order_data = {
            "nome": nome,
            "cnpjecpf": cnpjecpf,
            "valor": valor_formatado,
            "formaPagamento": forma_pag,
            "dataVenda": data_venda,
            "IDCliente": id_cliente,
            "OBS": obs,
            "Vendedor": vendedor,
            "pedido": pedido,
            "parcelas": parcelas_list
        }
        if not all_pix:
            order_data["tipoPagamentoNegado"] = True
        return jsonify(order_data)
    except Exception as e:
        return jsonify({"error": "Erro na consulta do pedido", "detalhes": str(e)}), 500


@pix_bp.route('/gerar_qr', methods=['POST'])
def gerar_qr():
    try:
        data = request.get_json()
        pedido = data.get("pedido")
        nome = data.get("nome")
        cnpjecpf = data.get("cnpjecpf")
        empresa = data.get("empresa")  # Deve ser enviado pelo front-end (usuário.Empresa)
        usuario_nome = data.get("usuarioNome")  # Nome do usuário que gerou o QR
        if not (pedido and nome and cnpjecpf and empresa):
            return jsonify({"error": "Dados incompletos do pedido"}), 400

        cnpjecpf_clean = ''.join(filter(str.isdigit, cnpjecpf))
        devedor = {"nome": nome}
        if len(cnpjecpf_clean) == 11:
            devedor["cpf"] = cnpjecpf_clean
        elif len(cnpjecpf_clean) == 14:
            devedor["cnpj"] = cnpjecpf_clean
        else:
            return jsonify({"error": "CNPJeCPF inválido"}), 400

        conn = get_connection()
        cursor = conn.cursor()

        # Recupera o Vendedor a partir da tabela Venda para o Pedido e Empresa informados
        cursor.execute("SELECT Vendedor FROM Venda WHERE IDEmpresa = ? AND Pedido = ?", (empresa, pedido))
        vendedor_result = cursor.fetchone()
        if vendedor_result:
            vendedor_id = vendedor_result[0]
            # Recupera o LogON da tabela Vendedor com base no ID_Vendedor
            cursor.execute("SELECT LogON FROM Vendedor WHERE IDEmpresa = ? AND ID_Vendedor = ?", (empresa, vendedor_id))
            logon_result = cursor.fetchone()
            logon = logon_result[0] if logon_result else ''
        else:
            logon = ''

        # Recupera os registros já existentes na tabela Pix_QR para este pedido
        cursor.execute("""
            SELECT ID, TxID, PixCopia, Vencimento, Status, Parcela 
            FROM Pix_QR 
            WHERE Pedido = ? AND IDEmpresa = ? 
            ORDER BY Parcela, ID DESC
        """, (pedido, empresa))
        registros = cursor.fetchall()

        # Recupera as formas de pagamento do pedido
        cursor.execute("""
            SELECT TipoPag, Valor, IDTipoPag 
            FROM Venda_FormaPag 
            WHERE PEDIDO = ? AND IDEmpresa = 5
        """, (pedido,))
        rows = cursor.fetchall()
        if not rows:
            return jsonify({"error": "Nenhuma forma de pagamento encontrada"}), 404

        total_parcelas = len(rows)
        qr_list = []
        expired_ocorreu = False  # Flag para indicar se ao menos um QR expirou

        # Nova validação: para cada parcela, valida via IDTipoPag na tabela TipoPagamento
        for i, row in enumerate(rows):
            id_tipo_pag = row[2]
            cursor.execute("SELECT Descrição FROM TipoPagamento WHERE IDPagamento = ?", (id_tipo_pag,))
            tipo_result = cursor.fetchone()
            if not tipo_result:
                return jsonify({"error": f"O IDPagamento {id_tipo_pag} não existe na tabela TipoPagamento."}), 400
            descricao = tipo_result[0]
            if descricao.strip().upper() != "PIX":
                return jsonify({"error": "Detectado outro tipo de pagamento. Por favor, só coloque Pix"}), 400

        # Mantém a lógica original para formar o dicionário de registros já ativos ou pagos
        registros_dict = {}
        for rec in registros:
            status = rec[4].strip().upper() if rec[4] else ""
            parcela = rec[5]
            if status in ["ATIVO", "PAGO"]:
                if parcela not in registros_dict:
                    registros_dict[parcela] = rec

        now = datetime.datetime.now()
        # Define vencimento e emissão para novas gerações (neste exemplo, vencimento com 0.02 horas)
        vencimento_new_dt = now + datetime.timedelta(hours=3)
        vencimento_new = vencimento_new_dt.strftime("%Y-%m-%d %H:%M:%S")
        emissao_new = now.strftime("%Y-%m-%d %H:%M:%S")
        hoje = now.strftime("%Y-%m-%d")
        access_token = get_access_token()
        headers = {
            "Content-Type": "application/json",
            "x-itau-apikey": itau_api_key,
            "Authorization": f"Bearer {access_token}"
        }

        # Processa cada parcela individualmente
        for i, row in enumerate(rows):
            parcela_num = i + 1
            gerar_novo = False  # Flag para indicar se deve gerar novo QR para esta parcela

            if parcela_num in registros_dict:
                id_reg, txid_reg, pix_copia, vencimento_from_db, status_reg, _ = registros_dict[parcela_num]
                status_norm = status_reg.strip().upper() if status_reg else ""
                # Converte o vencimento para datetime
                if isinstance(vencimento_from_db, datetime.datetime):
                    vencimento_dt = vencimento_from_db
                else:
                    vencimento_dt = datetime.datetime.strptime(vencimento_from_db, "%Y-%m-%d %H:%M:%S")

                if status_norm == "ATIVO" and vencimento_dt and now > vencimento_dt:
                    cursor.execute("""
                        UPDATE Pix_QR
                        SET Status = 'EXPIRADO'
                        WHERE TxID = ?
                    """, (txid_reg,))
                    conn.commit()
                    expired_ocorreu = True
                    gerar_novo = True
                elif status_norm in ["EXPIRADO", "DESATIVADO"]:
                    expired_ocorreu = True
                    gerar_novo = True
                elif status_norm == "PAGO":
                    valor_parcela = float(row[1])
                    qr_list.append({
                        "qrcode": pix_copia,
                        "valor": f"{valor_parcela:.2f}",
                        "txid": txid_reg,
                        "IDTipoPag": None,
                        "parcela": parcela_num
                    })
                    continue
                else:
                    valor_parcela = float(row[1])
                    qr_list.append({
                        "qrcode": pix_copia,
                        "valor": f"{valor_parcela:.2f}",
                        "txid": txid_reg,
                        "IDTipoPag": None,
                        "parcela": parcela_num
                    })
                    vencimento_str = vencimento_dt.strftime("%Y-%m-%d %H:%M:%S")
                    threading.Thread(target=monitor_qr_status, args=(txid_reg, vencimento_str)).start()
            else:
                gerar_novo = True

            if gerar_novo:
                # Gera novo QR apenas se o status não for PAGO
                tipo_pag, valor_pag, id_tipo_pag = row
                txid = ''.join(random.choices('0123456789abcdef', k=32))
                payload = {
                    "calendario": {
                        "dataDeVencimento": hoje,
                        "validadeAposVencimento": 0
                    },
                    "devedor": devedor,
                    "valor": { "original": f"{float(valor_pag):.2f}" },
                    "chave": config.get("pix_key")
                }
                url = pix_endpoint_template.format(txid=txid)
                response = requests.put(url, json=payload, headers=headers, timeout=30,
                                          cert=(client_cert, client_key), verify=False)
                if response.status_code != 201:
                    return jsonify({"error": "Erro ao emitir cobrança", "detalhes": response.text}), response.status_code

                resp_data = response.json()
                pix_copia = resp_data.get("pixCopiaECola", "QR Code gerado com sucesso")
                valor_parcela = float(valor_pag)
                # Insere o novo QR na tabela Pix_QR, incluindo a informação de quem gerou (usuario_nome)
                cursor.execute("""
                    INSERT INTO Pix_QR (TxID, IDPag, Pedido, Status, PixCopia, Vencimento, IDEmpresa, NomePagador, IdentPagador, Vendedor, GerouQR, Parcela, ValorParc)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (txid, '', pedido, "ATIVO", pix_copia, vencimento_new, empresa, '', '', logon, usuario_nome, parcela_num, valor_parcela))
                conn.commit()

                qr_list.append({
                    "qrcode": pix_copia,
                    "valor": f"{valor_parcela:.2f}",
                    "txid": txid,
                    "IDTipoPag": id_tipo_pag,
                    "parcela": parcela_num
                })
                try:
                    threading.Thread(target=monitor_qr_status, args=(txid, vencimento_new)).start()
                except Exception as e:
                    continue

        # Define mensagem de confirmação conforme situação
        confirmation_msg = "QR Code(s) já existente(s)."
        if expired_ocorreu:
            confirmation_msg = "QR Code do pedido expirado/desativado, gerando um novo..."
        elif len(qr_list) < total_parcelas:
            confirmation_msg = "Cobrança emitida com sucesso."

        log_pix_qr_gerado(usuario_nome, pedido)

        if qr_list:
            vencimento_resp = vencimento_new if expired_ocorreu or (not registros) else registros[0][3]
            if isinstance(vencimento_resp, datetime.datetime):
                vencimento_str = vencimento_resp.strftime("%Y-%m-%d %H:%M:%S")
                emissao_str = (vencimento_resp - datetime.timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
            else:
                vencimento_str = vencimento_resp
                emissao_str = ""
        else:
            vencimento_str = vencimento_new
            emissao_str = emissao_new

        return jsonify({
            "qrcodes": qr_list,
            "confirmation": confirmation_msg,
            "response": {
                "vencimento": vencimento_str,
                "emissao": emissao_str,
                "status": "ATIVO"
            },
            "expired": expired_ocorreu
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Erro ao gerar QR Code", "detalhes": str(e)}), 500

@pix_bp.route('/cancelar_qr', methods=['POST'])
def cancelar_qr():
    data = request.get_json()
    pedido = data.get("pedido")
    if not pedido:
        return jsonify({"error": "Pedido não informado"}), 400
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE Pix_QR SET Status = 'DESATIVADO' WHERE Pedido = ? AND Status = 'ATIVO'", (pedido,))
        conn.commit()
        # Após cancelar, consulta os QR Codes atualizados para DESATIVADO e registra log para cada um
        cursor.execute("SELECT GerouQR FROM Pix_QR WHERE Pedido = ? AND Status = 'DESATIVADO'", (pedido,))
        rows = cursor.fetchall()
        for r in rows:
            log_pix_cancelado(pedido, r[0])
        return jsonify({"message": "QR Codes cancelados."})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Erro ao cancelar QR Codes", "detalhes": str(e)}), 500

@pix_bp.route('/verificar_status', methods=['POST'])
def verificar_status():
    data = request.get_json()
    txid = data.get("txid")
    if not txid:
        return jsonify({"error": "txid não informado"}), 400

    try:
        access_token = get_access_token()
    except Exception as e:
        return jsonify({"error": "Erro ao obter access_token", "detalhes": str(e)}), 500

    headers = {
        "Content-Type": "application/json",
        "x-itau-apikey": itau_api_key,
        "Authorization": f"Bearer {access_token}"
    }
    url = pix_endpoint_template.format(txid=txid)
    response = requests.get(url, headers=headers, cert=(client_cert, client_key), verify=False)
    if response.status_code != 200:
        return jsonify({"error": "Erro ao consultar status", "detalhes": response.text}), response.status_code
    return jsonify(response.json())

@pix_bp.route('/finalizar_pagamento', methods=['POST'])
def finalizar_pagamento():
    data = request.get_json()
    pedido = data.get("pedido")
    parcelas = data.get("parcelas")
    if not (pedido and parcelas):
        return jsonify({"error": "Dados insuficientes para finalizar o pagamento. Campos ausentes: pedido ou parcelas"}), 400

    # Dados enviados ou obtidos da tabela Venda
    nome = data.get("nome")
    cnpjecpf = data.get("cnpjecpf")
    forma_pag = data.get("formaPagamento")
    data_venda = data.get("dataVenda")
    id_cliente = data.get("IDCliente")
    obs = data.get("OBS")
    empresa = data.get("empresa")  # Valor da Empresa enviado pelo front-end

    if not (nome and cnpjecpf and forma_pag and data_venda and id_cliente and obs):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            query = """
                SELECT NomeCliente, CNPJeCPF, FormaPagamento, DataVenda, IDCliente, OBS 
                FROM Venda 
                WHERE IDEmpresa = 5 AND Pedido = ?
            """
            cursor.execute(query, (pedido,))
            row = cursor.fetchone()
            if row:
                if not nome: nome = row[0]
                if not cnpjecpf: cnpjecpf = row[1]
                if not forma_pag: forma_pag = row[2]
                if not data_venda: data_venda = row[3]
                if not id_cliente: id_cliente = row[4]
                if not obs: obs = row[5]
            else:
                return jsonify({"error": "Pedido não encontrado ao tentar recuperar dados adicionais"}), 404
        except Exception as e:
            return jsonify({"error": "Erro ao recuperar dados adicionais do pedido", "detalhes": str(e)}), 500

    try:
        dt_venda = datetime.datetime.strptime(data_venda.replace(" GMT", ""), "%a, %d %b %Y %H:%M:%S")
        formatted_data_venda = dt_venda.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        formatted_data_venda = data_venda

    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Consulta os dados da tabela Venda_FormaPag para o pedido (assumindo que há uma coluna Parcela)
        cursor.execute("SELECT Parcela, TipoPag, Valor, IDTipoPag FROM Venda_FormaPag WHERE PEDIDO = ? AND IDEmpresa = 5", (pedido,))
        venda_forma_rows = cursor.fetchall()
        # Monta um dicionário com chave = número da parcela e valor = linha da consulta
        venda_forma_map = { int(row[0]): row for row in venda_forma_rows }

        # Aguarda a finalização dos QR Codes (status: PAGO, EXPIRADO ou DESATIVADO)
        allowed_statuses = ("PAGO", "EXPIRADO", "DESATIVADO")
        max_attempts = 5
        attempts = 0
        todas_finalizadas = False
        while attempts < max_attempts:
            todas_finalizadas = True
            for parcela in parcelas:
                try:
                    n_parcela = int(parcela.get("parcela"))
                except Exception:
                    n_parcela = 1
                cursor.execute(
                    "SELECT TOP 1 Status FROM Pix_QR WHERE Pedido = ? AND Parcela = ? ORDER BY ID DESC",
                    (pedido, n_parcela)
                )
                row_status = cursor.fetchone()
                status_db = str(row_status[0]).strip().upper() if row_status else ""
                if status_db not in allowed_statuses:
                    todas_finalizadas = False
            if todas_finalizadas:
                break
            time.sleep(5)
            attempts += 1

        if not todas_finalizadas:
            return jsonify({"message": "Nem todas as parcelas foram finalizadas. Tente novamente mais tarde."})

        # Se chegou até aqui, todos os QR Codes estão finalizados.
        # Agora, atualiza o pedido para 'Liberado' e Status 'V'
        update_query = """
            UPDATE Venda
            SET Situação = 'Liberado', Status = 'V'
            WHERE Pedido = ? AND IDEmpresa = 5
        """
        cursor.execute(update_query, (pedido,))
        conn.commit()
        
        # Registra log de pagamento para cada QR com status PAGO
        cursor.execute("SELECT GerouQR FROM Pix_QR WHERE Pedido = ? AND Status = 'PAGO'", (pedido,))
        rows_qr_pago = cursor.fetchall()
        for r in rows_qr_pago:
            log_pix_pago(pedido, r[0])
        
        # Em seguida, insere os registros no FluxoCaixa
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ultima_alteracao = now + ".000"
        cnpj_clean = ''.join(filter(str.isdigit, cnpjecpf))
        cursor.execute("SELECT COALESCE(MAX(ID), 0) FROM FluxoCaixa WHERE IDEmpresa = 5")
        max_id = cursor.fetchone()[0]
        novo_id = max_id + 1

        # Prepara a query de INSERT com 88 parâmetros
        placeholders = ", ".join(["?"] * 88)
        insert_query = f"""
            INSERT INTO FluxoCaixa (
                ID,                -- 1  ID: novo_id
                Descrição,         -- 2  Descrição: "PEDIDO DE VENDA N° {pedido} - API"
                DataRegistro,      -- 3  DataRegistro: now
                DataEmissão,       -- 4  DataEmissão: formatted_data_venda
                DataVencimento,    -- 5  DataVencimento: now
                Conta,             -- 6  Conta: obtido via SELECT na tabela TipoPagamento
                Classe,            -- 7  Classe: 'VENDAS'
                SubClasse,         -- 8  SubClasse: 'PRODUTOS'
                Valor,             -- 9  Valor: valor individual de cada parcela
                FormaPagamento,    -- 10 FormaPagamento: forma_pag
                TipoPagamento,     -- 11 TipoPagamento: IDTipoPag da Venda_FormaPag
                PagoPara,          -- 12 PagoPara: nome
                DespesaFixa,       -- 13 DespesaFixa: 0
                [Patrimônio],      -- 14 Patrimônio: 0
                NumDoc,            -- 15 NumDoc: txid_parcela
                CodOrientação,     -- 16 CodOrientação: 0
                OBS,               -- 17 OBS: obs
                Pedido,            -- 18 Pedido: pedido
                OS,                -- 19 OS: 0
                Compra,            -- 20 Compra: 0
                Comissão,          -- 21 Comissão: 0
                Atrazado,          -- 22 Atrazado: 0
                Status,            -- 23 Status: 'R'
                IDEmpresa,         -- 24 IDEmpresa: empresa (do front-end) ou padrão
                Inativo,           -- 25 Inativo: 0
                TEMCARTAO,         -- 26 TEMCARTAO: 0
                PAGAR,             -- 27 PAGAR: 0
                CHTerceiro,        -- 28 CHTerceiro: 0
                USUARIOG,          -- 29 USUARIOG: 0
                TOTALREAL,         -- 30 TOTALREAL: valor individual da parcela
                NumNF,             -- 31 NumNF: 0
                TipoGeracaoNF,     -- 32 TipoGeracaoNF: None
                ComissaoPaga,      -- 33 ComissaoPaga: 0
                NFCTe,             -- 34 NFCTe: None
                NFdePrestacao,     -- 35 NFdePrestacao: None
                BoletoRemessa,     -- 36 BoletoRemessa: None
                RemessaProcessada, -- 37 RemessaProcessada: None
                BoletoRetorno,     -- 38 BoletoRetorno: None
                ValorMultaAtrazo,  -- 39 ValorMultaAtrazo: None
                DiasProtesto,      -- 40 DiasProtesto: None
                Protestar,         -- 41 Protestar: None
                PercJurosDiaAtrazo,-- 42 PercJurosDiaAtrazo: None
                GerarJurosMsg,     -- 43 GerarJurosMsg: None
                PercMultaAtrazo,   -- 44 PercMultaAtrazo: None
                GerarMultaMsg,     -- 45 GerarMultaMsg: None
                ValorJurosAtrazo,  -- 46 ValorJurosAtrazo: None
                NossoNumero,       -- 47 NossoNumero: None
                NossoNumeroBoleto, -- 48 NossoNumeroBoleto: None
                TipoCliente,       -- 49 TipoCliente: 'F' se CPF ou 'J' se CNPJ
                CodCliente,        -- 50 CodCliente: id_cliente
                Devolucao,         -- 51 Devolucao: None
                PedCreditado,      -- 52 PedCreditado: 0
                DevolucaoIdx,      -- 53 DevolucaoIdx: None
                IDUSUARIO,         -- 54 IDUSUARIO: 124
                NFS,               -- 55 NFS: None
                IDExtrato,         -- 56 IDExtrato: None
                Conciliado,        -- 57 Conciliado: None
                DataHora,          -- 58 DataHora: None
                ContaContabil,     -- 59 ContaContabil: ''
                UltimaAlteracao,   -- 60 UltimaAlteracao: ultima_alteracao
                UserUltimaAlteracao, -- 61 UserUltimaAlteracao: 124
                DescontoBoleto,    -- 62 DescontoBoleto: None
                PercDescontoBoleto,-- 63 PercDescontoBoleto: None
                VL_DescontoBoleto, -- 64 VL_DescontoBoleto: None
                Venc_DescontoBoleto, -- 65 Venc_DescontoBoleto: None
                OS_AGRUP,          -- 66 OS_AGRUP: None
                COD_AG_REC,        -- 67 COD_AG_REC: None
                DATA_QUITACAO,     -- 68 DATA_QUITACAO: now
                BandeiraCartao,    -- 69 BandeiraCartao: 0
                Juros_Pedido,      -- 70 Juros_Pedido: 0.00
                CodProjeto,        -- 71 CodProjeto: 0
                Provisao,          -- 72 Provisao: 0
                ID_VINCULO_TAXA,   -- 73 ID_VINCULO_TAXA: mesmo que novo_id
                Parcela,           -- 74 Parcela: num_parcela
                Juros_Desconto,    -- 75 Juros_Desconto: 0.0000
                C_Transporte,      -- 76 C_Transporte: None
                RETORNAR,          -- 77 RETORNAR: None
                IDESTORNO_CAIXA,   -- 78 IDESTORNO_CAIXA: None
                Conferido,         -- 79 Conferido: 1
                Negociado,         -- 80 Negociado: 0
                Ajuizado,          -- 81 Ajuizado: 0
                Protestado,        -- 82 Protestado: 0
                Acordado,          -- 83 Acordado: 0
                ObsNegociacao,     -- 84 ObsNegociacao: ''
                IdCentroCusto,     -- 85 IdCentroCusto: '00'
                InclusaoSerasa,    -- 86 InclusaoSerasa: None
                IdentificadorSerasa, -- 87 IdentificadorSerasa: None
                DataCancelamento   -- 88 DataCancelamento: None
            )
            VALUES ({placeholders})
        """

        # Executa o INSERT para cada parcela
        for parcela in parcelas:
            txid_parcela = parcela.get("txid") or ""
            try:
                n_parcela = int(parcela.get("parcela"))
            except Exception:
                n_parcela = 1
            venda_forma = venda_forma_map.get(n_parcela)
            if venda_forma is None:
                return jsonify({"error": f"Não foi encontrado registro na Venda_FormaPag para a parcela {n_parcela}."})
            id_tipo_pag = venda_forma[3]  # índice 3 contém o IDTipoPag
            cursor.execute("SELECT COUNT(*) FROM TipoPagamento WHERE IDPagamento = ?", (id_tipo_pag,))
            if cursor.fetchone()[0] == 0:
                return jsonify({"error": f"O IDPagamento {id_tipo_pag} não existe na tabela TipoPagamento."})
            try:
                num_parcela = int(parcela.get("parcela"))
            except Exception:
                num_parcela = 1
            # Corrigido: utiliza o valor correto (índice 2) da Venda_FormaPag
            valor_num = float(venda_forma[2])

            cursor.execute("SELECT CONTA FROM TipoPagamento WHERE IDPagamento = ?", (id_tipo_pag,))
            rowConta = cursor.fetchone()
            conta = rowConta[0] if rowConta and rowConta[0] is not None else ''

            tipo_cliente = 'F' if len(cnpj_clean) == 11 else 'J'

            # Para cada parcela, obtém o txid informado e busca o endToEndId via GET /cobv/{txid}
            txid_parcela = parcela.get("txid")
            if not txid_parcela:
                return jsonify({"error": f"txid não informado para a parcela {parcela.get('parcela')}."}), 400

            try:
                end_doc = get_endtoendid(txid_parcela)
            except Exception as e:
                return jsonify({"error": f"Erro ao obter endToEndId para a parcela {parcela.get('parcela')}.", "detalhes": str(e)}), 400

            # Monta os parâmetros para o INSERT, utilizando o end_doc no campo NumDoc
            params = [
                novo_id,                                    # 1  ID
                f"PEDIDO DE VENDA N° {pedido}",             # 2  Descrição
                now,                                        # 3  DataRegistro
                formatted_data_venda,                       # 4  DataEmissão
                now,                                        # 5  DataVencimento
                conta,                                      # 6  Conta
                'VENDAS',                                   # 7  Classe
                'PRODUTOS',                                 # 8  SubClasse
                valor_num,                                  # 9  Valor (valor individual da parcela)
                forma_pag,                                  # 10 FormaPagamento
                id_tipo_pag,                                # 11 TipoPagamento
                nome,                                       # 12 PagoPara
                0,                                          # 13 DespesaFixa
                0,                                          # 14 Patrimônio
                end_doc,                                    # 15 NumDoc (usa o endToEndId obtido)
                0,                                          # 16 CodOrientação
                obs,                                        # 17 OBS
                pedido,                                     # 18 Pedido
                0,                                          # 19 OS
                0,                                          # 20 Compra
                0,                                          # 21 Comissão
                0,                                          # 22 Atrazado
                'R',                                        # 23 Status
                empresa if empresa else 5,                  # 24 IDEmpresa
                0,                                          # 25 Inativo
                0,                                          # 26 TEMCARTAO
                0,                                          # 27 PAGAR
                0,                                          # 28 CHTerceiro
                0,                                          # 29 USUARIOG
                valor_num,                                  # 30 TOTALREAL (valor individual da parcela)
                0,                                          # 31 NumNF
                None,                                       # 32 TipoGeracaoNF
                0,                                          # 33 ComissaoPaga
                None,                                       # 34 NFCTe
                None,                                       # 35 NFdePrestacao
                None,                                       # 36 BoletoRemessa
                None,                                       # 37 RemessaProcessada
                None,                                       # 38 BoletoRetorno
                None,                                       # 39 ValorMultaAtrazo
                None,                                       # 40 DiasProtesto
                None,                                       # 41 Protestar
                None,                                       # 42 PercJurosDiaAtrazo
                None,                                       # 43 GerarJurosMsg
                None,                                       # 44 PercMultaAtrazo
                None,                                       # 45 GerarMultaMsg
                None,                                       # 46 ValorJurosAtrazo
                None,                                       # 47 NossoNumero
                None,                                       # 48 NossoNumeroBoleto
                tipo_cliente,                               # 49 TipoCliente ('F' se CPF ou 'J' se CNPJ)
                id_cliente,                                 # 50 CodCliente
                None,                                       # 51 Devolucao
                0,                                          # 52 PedCreditado
                None,                                       # 53 DevolucaoIdx
                124,                                        # 54 IDUSUARIO
                None,                                       # 55 NFS
                None,                                       # 56 IDExtrato
                None,                                       # 57 Conciliado
                None,                                       # 58 DataHora
                '',                                         # 59 ContaContabil
                ultima_alteracao,                           # 60 UltimaAlteracao
                124,                                        # 61 UserUltimaAlteracao
                None,                                       # 62 DescontoBoleto
                None,                                       # 63 PercDescontoBoleto
                None,                                       # 64 VL_DescontoBoleto
                None,                                       # 65 Venc_DescontoBoleto
                None,                                       # 66 OS_AGRUP
                None,                                       # 67 COD_AG_REC
                now,                                        # 68 DATA_QUITACAO
                0,                                          # 69 BandeiraCartao
                0.00,                                       # 70 Juros_Pedido
                0,                                          # 71 CodProjeto
                0,                                          # 72 Provisao
                novo_id,                                    # 73 ID_VINCULO_TAXA
                num_parcela,                                # 74 Parcela
                0.0000,                                     # 75 Juros_Desconto
                None,                                       # 76 C_Transporte
                None,                                       # 77 RETORNAR
                None,                                       # 78 IDESTORNO_CAIXA
                1,                                          # 79 Conferido
                0,                                          # 80 Negociado
                0,                                          # 81 Ajuizado
                0,                                          # 82 Protestado
                0,                                          # 83 Acordado
                '',                                         # 84 ObsNegociacao
                '00',                                       # 85 IdCentroCusto
                None,                                       # 86 InclusaoSerasa
                None,                                       # 87 IdentificadorSerasa
                None                                        # 88 DataCancelamento
            ]

            cursor.execute(insert_query, tuple(params))
            novo_id += 1

        conn.commit()
        return jsonify({"message": "Pagamento finalizado, FluxoCaixa atualizado e pedido liberado."})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Erro ao finalizar pagamento", "detalhes": str(e)}), 500

@pix_bp.route('/atualizar_pix_status', methods=['POST'])
def atualizar_pix_status():
    data = request.get_json()
    txid = data.get("txid")
    pedido = data.get("pedido")
    empresa = data.get("empresa")
    
    # Validação dos dados essenciais
    if not (txid and pedido and empresa):
        return jsonify({"error": "Dados insuficientes para atualizar o status do Pix"}), 400
    
    try:
        # Obter o endToEndId com a mesma lógica usada para preencher NumDoc na tabela FluxoCaixa
        end_doc = get_endtoendid(txid)
        # Obter os demais detalhes do pagamento via API
        details = get_pix_details(txid)
        horario_pag = details.get("horario")
        ident_pagador = details.get("infoPagador")
        nome_pagador = details.get("nomePagador")
        
        # Atualiza a tabela Pix_QR
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE Pix_QR
            SET Status = 'PAGO',
                IDPag = ?,
                NomePagador = ?,
                IdentPagador = ?,
                DataPag = ?
            WHERE TxID = ?
        """, (end_doc, nome_pagador, ident_pagador, horario_pag, txid))
        
        # Atualiza a tabela VENDA com o mesmo horário (usado em DataVenda e HoraVenda)
        cursor.execute("""
            UPDATE VENDA
            SET DataVenda = ?, HoraVenda = ?
            WHERE IDEmpresa = ? AND Pedido = ?
        """, (horario_pag, horario_pag, empresa, pedido))
        
        conn.commit()
        # Registra log de pagamento para este QR
        cursor.execute("SELECT GerouQR FROM Pix_QR WHERE TxID = ?", (txid,))
        gerou_qr = cursor.fetchone()[0]
        log_pix_pago(pedido, gerou_qr)
        return jsonify({"message": "Status do Pix atualizado para PAGO, e VENDA atualizada."})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": "Erro ao atualizar status do Pix", "detalhes": str(e)}), 500

def get_endtoendid(txid):
    try:
        access_token = get_access_token()
    except Exception as e:
        raise Exception(f"Erro ao obter access token: {e}")

    headers = {
        "Content-Type": "application/json",
        "x-itau-apikey": itau_api_key,
        "Authorization": f"Bearer {access_token}"
    }
    url = pix_endpoint_template.format(txid=txid)
    response = requests.get(url, headers=headers, cert=(client_cert, client_key), verify=False)
    if response.status_code != 200:
        raise Exception(f"Erro na consulta do QR {txid}: {response.status_code} - {response.text}")
    data = response.json()
    pix_list = data.get("pix")
    if not (pix_list and isinstance(pix_list, list) and len(pix_list) > 0):
        raise Exception(f"Campo 'pix' não encontrado ou vazio na resposta do QR {txid}.")
    end_to_end = pix_list[0].get("endToEndId")
    if not end_to_end:
        raise Exception(f"endToEndId não encontrado para o QR {txid}.")
    return end_to_end

def get_pix_details(txid):
    try:
        access_token = get_access_token()
    except Exception as e:
        raise Exception(f"Erro ao obter access token: {e}")

    headers = {
        "Content-Type": "application/json",
        "x-itau-apikey": itau_api_key,
        "Authorization": f"Bearer {access_token}"
    }
    url = pix_endpoint_template.format(txid=txid)
    response = requests.get(url, headers=headers, cert=(client_cert, client_key), verify=False)
    if response.status_code != 200:
        raise Exception(f"Erro na consulta do QR {txid}: {response.status_code} - {response.text}")
    
    data = response.json()
    pix_list = data.get("pix")
    if not (pix_list and isinstance(pix_list, list) and len(pix_list) > 0):
        raise Exception("Campo 'pix' não encontrado ou vazio na resposta do QR.")
    
    pix_data = pix_list[0]
    # Extração dos dados do primeiro item do array "pix"
    horario = pix_data.get("horario")
    info_pagador = pix_data.get("infoPagador")
    # Se info_pagador estiver vazio, tenta obter de devedor.cpf ou devedor.cnpj
    if not info_pagador:
        devedor = data.get("devedor", {})
        info_pagador = devedor.get("cpf") or devedor.get("cnpj")
    nome_pagador = data.get("devedor", {}).get("nome")
    
    return {
        "horario": horario,
        "infoPagador": info_pagador,
        "nomePagador": nome_pagador
    }

monitored_qrs = set()

def monitor_qr_wrapper(txid, vencimento_str):
    try:
        monitor_qr_status(txid, vencimento_str)
    finally:
        monitored_qrs.discard(txid)

def monitor_all_active_qrs():
    while True:
        try:
            conn = get_connection()
            cursor = conn.cursor()
            # Seleciona os QR Codes com status ATIVO
            cursor.execute("SELECT TxID, Vencimento FROM Pix_QR WHERE Status = 'ATIVO'")
            registros = cursor.fetchall()
            for registro in registros:
                txid, vencimento = registro
                # Se já estiver monitorando, ignora
                if txid in monitored_qrs:
                    continue
                # Adiciona ao conjunto e inicia o monitoramento em uma nova thread
                monitored_qrs.add(txid)
                threading.Thread(target=monitor_qr_wrapper, args=(txid, vencimento)).start()
        except Exception as e:
            # Em caso de erro, log ou print pode ser adicionado aqui se necessário
            pass
        # Aguarda 1 minuto antes de verificar novamente
        time.sleep(60)

@pix_bp.route('/verificar_estoque', methods=['POST'])
def verificar_estoque():
    data = request.get_json()
    pedido = data.get("pedido")
    empresa = data.get("empresa")
    if not pedido or not empresa:
        return jsonify({"error": "Pedido ou empresa não informados"}), 400

    try:
        conn = get_connection()
        cursor = conn.cursor()
        query = """
            SELECT 
                pv.IDProduto,
                pv.Descrição,
                pv.Quantidade AS Vendido,
                de.EstAtual AS Estoque,
                (de.EstAtual - pv.Quantidade) AS Saldo
            FROM 
                Produto_Venda pv
            INNER JOIN 
                DetEstoque de ON pv.IDProduto = de.IDProduto
            WHERE 
                pv.IDEmpresa = ? 
                AND pv.Pedido = ? 
                AND de.IDEmpresa = ? 
                AND de.IDProduto IN (
                    SELECT IDProduto 
                    FROM Produto_Venda 
                    WHERE IDEmpresa = ? 
                    AND Pedido = ?
                )
        """
        cursor.execute(query, (empresa, pedido, empresa, empresa, pedido))
        rows = cursor.fetchall()
        resultado = []
        for row in rows:
            resultado.append({
                "IDProduto": row[0],
                "Descrição": row[1],
                "Vendido": row[2],
                "Estoque": row[3],
                "Saldo": row[4]
            })
        return jsonify(resultado)
    except Exception as e:
        return jsonify({"error": "Erro ao verificar estoque", "detalhes": str(e)}), 500


@pix_bp.before_app_request
def iniciar_monitoramento_automatico():
    threading.Thread(target=monitor_all_active_qrs, daemon=True).start()