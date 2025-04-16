from flask import Blueprint, render_template, jsonify, request, session, Response, url_for
import requests
from services.database import get_connection
from datetime import datetime
from services.decrypt_api import descriptografar_api
from services.log import log_consulta_cnpj, log_atualiza_cnpj  # Importa as funções de log

cnpj_bp = Blueprint('cnpj', __name__)

api_config = descriptografar_api()
API_KEY = api_config.get("API_KEY")
API_URL = api_config.get("API_URL")


@cnpj_bp.route('/cnpj', methods=['GET'])
def cnpj_page():
    return render_template('cnpj.html')


@cnpj_bp.route('/api/consultar_cnpj', methods=['POST'])
def consultar_cnpj():
    data = request.json
    cnpj = data.get("cnpj")
    
    if not cnpj:
        return jsonify({"erro": "CNPJ não fornecido."}), 400

    # Consulta o CNPJ via API
    url = f"{API_URL}{cnpj}"
    headers = {'Authorization': API_KEY}
    params = {'simples': 'true'}

    response = requests.get(url, headers=headers, params=params)
    if response.status_code != 200:
        return jsonify({"erro": f"Não foi possível consultar o CNPJ. Código {response.status_code}"}), response.status_code

    dados = response.json()
    estado = dados.get("address", {}).get("state")
    if estado:
        params["registrations"] = estado
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            dados = response.json()

    # Processa inscrições estaduais
    registrations = dados.get("registrations")
    if registrations and len(registrations) > 0:
        inscricao_raw = registrations[0].get("number", "")
        inscricao_estadual = formatar_inscricao_estadual(inscricao_raw) if inscricao_raw else ""
        inscricao_habilitada = registrations[0].get("enabled", False)
        tipo_ie = registrations[0].get("type", {}).get("text", "")
    else:
        inscricao_estadual = "NÃO CONSTA"
        inscricao_habilitada = False
        tipo_ie = "IE Não Contribuinte"
    
    simples_optant = dados.get("company", {}).get("simples", {}).get("optant", False)
    simples_valor = 1 if simples_optant else 0
    inscricao_habilitada_valor = 1 if inscricao_habilitada else 0

    # Formata o telefone
    phones = dados.get("phones")
    if phones and isinstance(phones, list) and len(phones) > 0 and phones[0].get("number"):
        area = phones[0].get("area", "")
        number = phones[0].get("number", "")
        telefone_formatado = f"({area}) {number[:4]}-{number[4:]}"
    else:
        telefone_formatado = "NÃO CONSTA"

    # Processa os sócios – se houver, gera uma lista com cada sócio no formato "Cargo: Nome"
    membros = dados.get("company", {}).get("members", [])
    if not membros:
        socios = "Nenhum Sócio registrado"
    else:
        socios_lista = []
        for membro in membros:
            cargo = membro.get("role", {}).get("text", "Cargo não informado")
            nome = membro.get("person", {}).get("name", "Nome não informado")
            socios_lista.append(f"{cargo}: {nome}")
        socios = socios_lista

    resultado_filtrado = {
        "Razao Social": dados.get("company", {}).get("name", "N/D"),
        "Endereco": f"{dados.get('address', {}).get('street', '')} {dados.get('address', {}).get('number', '')}",
        "Municipio": dados.get("address", {}).get("city", "N/D"),
        "Bairro": dados.get("address", {}).get("district", "N/D"),
        "Telefone": telefone_formatado,
        "UF": estado or "N/D",
        "CEP": (f"{dados.get('address', {}).get('zip', '')[:5]}-{dados.get('address', {}).get('zip', '')[5:]}"
                if dados.get("address", {}).get("zip") else "N/D"),
        "Inscricao Estadual": inscricao_estadual,
        "Simples Nacional": simples_valor,
        "Inscricao Habilitada": inscricao_habilitada_valor,
        "Contribuinte": 2 if "IE Não Contribuinte" in tipo_ie else (0 if "IE Normal" in tipo_ie else None),
        "Socios": socios
    }
    
    # ——— NOVO: URLs para o modal ———
    resultado_filtrado['MapUrl']    = url_for('cnpj.consultar_cnpj_map',    cnpj=cnpj)
    resultado_filtrado['StreetUrl'] = url_for('cnpj.consultar_cnpj_street', cnpj=cnpj)
    # ————————————————————————————————

    usuario = session.get("usuario", "Usuário desconhecido")
    razao_social = dados.get("company", {}).get("name", "")
    log_consulta_cnpj(usuario, cnpj, razao_social)
    
    return jsonify(resultado_filtrado)

def formatar_inscricao_estadual(ie):
    """Formata a Inscrição Estadual no formato XX.XXX.XX-X, se tiver 8 dígitos"""
    ie = ie.strip() if ie else ""
    if ie and len(ie) == 8 and ie.isdigit():
        return f"{ie[:2]}.{ie[2:5]}.{ie[5:7]}-{ie[7:]}"
    return ie 


@cnpj_bp.route('/api/atualizar_dados', methods=['POST'])
def atualizar_dados():
    try:
        dados_input = request.json
        cnpj = dados_input.get("cnpj")
        vendedor = dados_input.get("vendedor")
        nome_usuario = dados_input.get("nome")
        empresa_usuario = dados_input.get("empresa")
        inserir_em = dados_input.get("inserir_em")  

        if not cnpj:
            return jsonify({"erro": "CNPJ não fornecido."}), 400
        if not vendedor:
            return jsonify({"erro": "Vendedor não fornecido."}), 400
        if inserir_em not in ["cliente", "fornecedor", "ambos"]:
            return jsonify({"erro": "Opção de atualização inválida."}), 400
        if not nome_usuario or not empresa_usuario:
            return jsonify({"erro": "Dados do usuário incompletos."}), 400

        cnpj_numeros = cnpj.replace(".", "").replace("/", "").replace("-", "")
        url = f"{API_URL}{cnpj_numeros}"
        headers = {'Authorization': API_KEY}
        params = {'simples': 'true'}

        response = requests.get(url, headers=headers, params=params)
        if response.status_code != 200:
            return jsonify({"erro": f"Não foi possível consultar o CNPJ para atualização. Código {response.status_code}"}), response.status_code

        dados_consulta = response.json()
        estado = dados_consulta.get("address", {}).get("state")
        if estado:
            params["registrations"] = estado
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                dados_consulta = response.json()

        registrations = dados_consulta.get("registrations")
        if registrations and len(registrations) > 0:
            inscricao_raw = registrations[0].get("number", "")
            inscricao_estadual = formatar_inscricao_estadual(inscricao_raw) if inscricao_raw else ""
            inscricao_habilitada = registrations[0].get("enabled", False)
        else:
            inscricao_estadual = "NÃO CONSTA"
            inscricao_habilitada = False

        if inscricao_estadual.upper() == "NÃO CONSTA":
            inscricao_estadual = ""

        carac_tributacao = 3 if inscricao_habilitada else 7
        finalidade = 0 if inscricao_habilitada else 2
        consumidor_final = 0 if inscricao_habilitada else 1
        simples_optant = dados_consulta.get("company", {}).get("simples", {}).get("optant", False)
        simples_valor = 1 if simples_optant else 0
        indIEdest_valor = 2 if carac_tributacao == 7 else 0 if carac_tributacao == 3 else None
        data_alteracao = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        phones = dados_consulta.get("phones")
        if phones and isinstance(phones, list) and len(phones) > 0 and phones[0].get("number"):
            area = phones[0].get("area", "")
            number = phones[0].get("number", "")
            telefone_formatado = f"({area}) {number[:4]}-{number[4:]}"
        else:
            telefone_formatado = ""

        # Atualizei update_data para incluir a chave "Vendedor"
        update_data = {
            "Razao Social": dados_consulta.get("company", {}).get("name") or "",
            "Inscricao Estadual": inscricao_estadual,
            "Rua": dados_consulta.get("address", {}).get("street") or "",
            "Numero": dados_consulta.get("address", {}).get("number") or "",
            "Bairro": dados_consulta.get("address", {}).get("district") or "",
            "CEP": (f"{dados_consulta.get('address', {}).get('zip', '')[:5]}-{dados_consulta.get('address', {}).get('zip', '')[5:]}"
                    if dados_consulta.get("address", {}).get("zip") else ""),
            "Municipio": dados_consulta.get("address", {}).get("city") or "",
            "UF": estado or "",
            "Telefone": telefone_formatado,
            "DataAlteracao": data_alteracao,
            "Vendedor": vendedor
        }
        
        # Obtém o ID do usuário para alteração
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT ID FROM dbo.Usuário WHERE IDEmpresa = ? AND USUARIO = ?", (empresa_usuario, nome_usuario))
            usuario_row = cursor.fetchone()
        id_usuario_alteracao = usuario_row[0] if usuario_row else None

        # Processa os sócios: extrai os nomes dos sócios (máximo 3)
        membros = dados_consulta.get("company", {}).get("members", [])
        if membros:
            socios_list = [membro.get("person", {}).get("name", "") for membro in membros]
            socios_list = socios_list[:3]
        else:
            socios_list = []
        socio1 = socios_list[0] if len(socios_list) >= 1 else ""
        socio2 = socios_list[1] if len(socios_list) >= 2 else ""
        socio3 = socios_list[2] if len(socios_list) >= 3 else ""

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT ID FROM dbo.Dados_Empresa WHERE Ativo = 'True'")
            empresas = [row.ID for row in cursor.fetchall()]
            if not empresas:
                return jsonify({"erro": "Nenhuma empresa ativa encontrada."}), 404

            placeholders = ','.join(['?'] * len(empresas))
            cursor.execute("SELECT ID_Pjuridica FROM dbo.Pjuridica WHERE CNPJ = ?", (cnpj,))
            resultado_pjuridica = cursor.fetchone()
            msg_pjuridica = ""
            msg_fornecedor = ""
            
            if inserir_em in ["cliente", "ambos"]:
                if resultado_pjuridica:
                    update_query_pjuridica = f'''
                        UPDATE dbo.Pjuridica
                        SET RasSocial = CASE WHEN ? = '' THEN RasSocial ELSE ? END,
                            InscEstadual = CASE WHEN ? = '' THEN InscEstadual ELSE ? END,
                            Rua = CASE WHEN ? = '' THEN Rua ELSE ? END,
                            Num = CASE WHEN ? = '' THEN Num ELSE ? END,
                            Bairro = CASE WHEN ? = '' THEN Bairro ELSE ? END,
                            CEP = CASE WHEN ? = '' THEN CEP ELSE ? END,
                            Cidade = CASE WHEN ? = '' THEN Cidade ELSE ? END,
                            UF = CASE WHEN ? = '' THEN UF ELSE ? END,
                            Tel01 = CASE WHEN ? = '' THEN Tel01 ELSE ? END,
                            DataAlteracao = ?,
                            Vendedor = CASE WHEN ? = '' THEN Vendedor ELSE ? END,
                            UsuarioAlteracao = ?,
                            SimplesNacional = ?,
                            indIEDest = ?,
                            CaracTributacao = ?,
                            Finalidade = ?,
                            consumidorFinal = ?,
                            Sócio01 = ?,
                            Sócio02 = ?,
                            Sócio03 = ?
                        WHERE CNPJ = ? AND IDEmpresa IN ({placeholders})
                    '''
                    params_update_pjuridica = (
                        update_data["Razao Social"][:65], update_data["Razao Social"][:65],
                        update_data["Inscricao Estadual"], update_data["Inscricao Estadual"],
                        update_data["Rua"], update_data["Rua"],
                        update_data["Numero"], update_data["Numero"],
                        update_data["Bairro"], update_data["Bairro"],
                        update_data["CEP"], update_data["CEP"],
                        update_data["Municipio"], update_data["Municipio"],
                        update_data["UF"], update_data["UF"],
                        update_data["Telefone"], update_data["Telefone"],
                        data_alteracao,
                        update_data["Vendedor"], update_data["Vendedor"],
                        id_usuario_alteracao,
                        simples_valor,
                        indIEdest_valor,
                        carac_tributacao,
                        finalidade,
                        consumidor_final,
                        socio1,
                        socio2,
                        socio3,
                        cnpj,
                        *empresas
                    )
                    cursor.execute(update_query_pjuridica, params_update_pjuridica)
                    msg_pjuridica = "Dados PJuridica atualizados com sucesso."
                else:
                    cursor.execute("SELECT MAX(ID_Pjuridica) FROM dbo.Pjuridica;")
                    row = cursor.fetchone()
                    max_id = row[0] if row and row[0] is not None else 0
                    novo_id = max_id
                    columns_insert_pjuridica = [
                        "ID_Pjuridica", "IDEmpresa", "CNPJ", "RasSocial", "InscEstadual", "Rua", "Num", "Bairro", "CEP", "Cidade", "UF",
                        "Tel01", "DataAlteracao", "DataReg", "Vendedor", "UsuarioAlteracao", "SimplesNacional", "indIEDest",
                        "CaracTributacao", "Finalidade", "consumidorFinal",
                        "Sócio01", "Sócio02", "Sócio03",
                        "NomeFantasia", "Contato", "Atividade", "Complemento", "Email", "FAX", "Tel02", "HomePage"
                    ]
                    placeholders_insert_pjuridica = ", ".join(["?"] * len(columns_insert_pjuridica))
                    insert_query_pjuridica = f'''
                        INSERT INTO dbo.Pjuridica 
                        ({", ".join(columns_insert_pjuridica)})
                        VALUES ({placeholders_insert_pjuridica})
                    '''
                    base_params_pjuridica = (
                        cnpj,
                        update_data["Razao Social"][:65],
                        update_data["Inscricao Estadual"],
                        update_data["Rua"],
                        update_data["Numero"],
                        update_data["Bairro"],
                        update_data["CEP"],
                        update_data["Municipio"],
                        update_data["UF"],
                        update_data["Telefone"],
                        update_data["DataAlteracao"],
                        data_alteracao,
                        update_data["Vendedor"],
                        id_usuario_alteracao,
                        simples_valor,
                        indIEdest_valor,
                        carac_tributacao,
                        finalidade,
                        consumidor_final,
                        socio1,
                        socio2,
                        socio3
                    )
                    additional_params = (
                        None, None, None, None, None, '', '', None
                    )
                    inserted_ids = []
                    for empresa in empresas:
                        novo_id += 1
                        params_insert_pjuridica = (novo_id, empresa) + base_params_pjuridica + additional_params
                        cursor.execute(insert_query_pjuridica, params_insert_pjuridica)
                        inserted_ids.append(novo_id)
                    msg_pjuridica = f"Novo registro PJuridica inserido com sucesso. IDs: {inserted_ids}"
            
            if inserir_em in ["fornecedor", "ambos"]:
                cursor.execute("SELECT CNPJ FROM dbo.Fornecedor WHERE CNPJ = ?", (cnpj,))
                resultado_fornecedor = cursor.fetchone()
                if resultado_fornecedor:
                    update_query_fornecedor = f'''
                        UPDATE dbo.Fornecedor
                        SET RasSocial = ?,
                            InscEsdatual = ?,
                            Atividade = ?,
                            Rua = ?,
                            Num = ?,
                            Bairro = ?,
                            Cep = ?,
                            Cidade = ?,
                            UF = ?,
                            Tel01 = ?,
                            Compras = ?,
                            PontoColeta = ?,
                            Estoque = ?,
                            EmpresaOS = ?,
                            ContasPagar = ?,
                            Fabricante = ?,
                            CaracTributacao = ?,
                            SimplesNacional = ?,
                            UsuarioAlteracao = ?,
                            DataAlteracao = ?
                        WHERE CNPJ = ? AND IDEmpresa IN ({placeholders})
                    '''
                    params_update_fornecedor = (
                        (dados_consulta.get("company", {}).get("name") or "")[:65],
                        update_data["Inscricao Estadual"],
                        "REVENDA",
                        dados_consulta.get("address", {}).get("street") or "",
                        dados_consulta.get("address", {}).get("number") or "",
                        dados_consulta.get("address", {}).get("district") or "",
                        update_data["CEP"],
                        dados_consulta.get("address", {}).get("city") or "",
                        estado or "",
                        update_data["Telefone"],
                        True, True, True, True, True, True,
                        carac_tributacao,
                        simples_valor,
                        id_usuario_alteracao,
                        data_alteracao,
                        cnpj,
                        *empresas
                    )
                    cursor.execute(update_query_fornecedor, params_update_fornecedor)
                    msg_fornecedor = "Dados Fornecedor atualizados com sucesso."
                else:
                    cursor.execute("SELECT MAX(ID) FROM dbo.Fornecedor;")
                    row_fornecedor = cursor.fetchone()
                    max_id_fornecedor = row_fornecedor[0] if row_fornecedor and row_fornecedor[0] is not None else 0
                    novo_fornecedor_id = max_id_fornecedor
                    columns_insert_fornecedor = [
                        "ID", "IDEmpresa", "CNPJ", "RasSocial", "NomeFantasia", "InscEsdatual", "Contato", "Atividade",
                        "Rua", "Num", "Complemento", "Bairro", "Cep", "Cidade", "UF", "DataReg", "Tel01", "Tel02", "Email", "HomePage",
                        "OBS", "Compras", "PontoColeta", "Estoque", "EmpresaOS", "ContasPagar", "Fabricante", "Markup", "Limite",
                        "TipoLimiteTotal", "COD_EXTERNO_SCWEB", "ProdRural", "TemPerfil", "PagarPara", "UsarPagarPara", "CONTA",
                        "CLASSE", "SUBCLASSE", "Cnpj_Prod_Rural", "ContaContabil", "IND_TRANSITO_PARA_SCWEB", "CaracTributacao",
                        "SimplesNacional", "UsuarioAlteracao", "DataAlteracao", "CodComprador", "Credenciadora"
                    ]
                    placeholders_insert_fornecedor = ", ".join(["?"] * len(columns_insert_fornecedor))
                    insert_query_fornecedor = f'''
                        INSERT INTO dbo.Fornecedor
                        ({", ".join(columns_insert_fornecedor)})
                        VALUES ({placeholders_insert_fornecedor})
                    '''
                    inserted_fornecedor_ids = []
                    for empresa in empresas:
                        novo_fornecedor_id += 1
                        params_insert_fornecedor = (
                            novo_fornecedor_id,
                            empresa,
                            cnpj,
                            (dados_consulta.get("company", {}).get("name") or "")[:65],
                            "",  
                            update_data["Inscricao Estadual"],
                            None,
                            "REVENDA",
                            dados_consulta.get("address", {}).get("street") or "",
                            dados_consulta.get("address", {}).get("number") or "",
                            "",  
                            dados_consulta.get("address", {}).get("district") or "",
                            update_data["CEP"],
                            dados_consulta.get("address", {}).get("city") or "",
                            estado or "",
                            data_alteracao,  
                            update_data["Telefone"],
                            "",  
                            "",  
                            None,  
                            None,  
                            True, True, True, True, True, True,
                            0.0000, 0.0000, 0, 0, 0, 0, 0, 0,
                            None, None, None, None, None, 0,
                            carac_tributacao,
                            simples_valor,
                            id_usuario_alteracao,
                            data_alteracao,
                            0,
                            0
                        )
                        cursor.execute(insert_query_fornecedor, params_insert_fornecedor)
                        inserted_fornecedor_ids.append(novo_fornecedor_id)
                    msg_fornecedor = f"Novo registro Fornecedor inserido com sucesso. IDs: {inserted_fornecedor_ids}"

            conn.commit()
            
            if inserir_em == "cliente":
                tipo = "clientes"
            elif inserir_em == "fornecedor":
                tipo = "fornecedor"
            elif inserir_em == "ambos":
                tipo = "clientes e fornecedor"
            else:
                tipo = ""
            
            id_usuario_log = session.get("usuario", nome_usuario)
            log_atualiza_cnpj(id_usuario_log, cnpj, tipo)
            
            return jsonify({"mensagem": f"{msg_pjuridica} {msg_fornecedor}"})
    except Exception as e:
        print(f"Erro ao atualizar dados: {e}")
        return jsonify({"erro": str(e)}), 500

@cnpj_bp.route('/api/consultar_cnpj/map/<cnpj>', methods=['GET'])
def consultar_cnpj_map(cnpj):
    """Proxy para o mapa aéreo"""
    remote = f"{API_URL}{cnpj}/map"
    headers = {'Authorization': API_KEY}
    r = requests.get(remote, headers=headers, stream=True)
    if r.status_code != 200:
        return jsonify({"erro": "Não foi possível obter o mapa."}), r.status_code
    return Response(r.content, mimetype='image/png')


@cnpj_bp.route('/api/consultar_cnpj/street/<cnpj>', methods=['GET'])
def consultar_cnpj_street(cnpj):
    """Proxy para a visão de rua"""
    remote = f"{API_URL}{cnpj}/street"
    headers = {'Authorization': API_KEY}
    r = requests.get(remote, headers=headers, stream=True)
    if r.status_code != 200:
        return jsonify({"erro": "Não foi possível obter a visão de rua."}), r.status_code
    return Response(r.content, mimetype='image/png')