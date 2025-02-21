from flask import Blueprint, render_template, jsonify, request
import requests
from services.database import get_connection
from datetime import datetime
from services.decrypt_api import descriptografar_api

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

    # Monta a URL usando o CNPJ (ajuste se necessário)
    url = f"{API_URL}{cnpj}"
    headers = {'Authorization': API_KEY}
    params = {'simples': 'true'}

    response = requests.get(url, headers=headers, params=params)

    if response.status_code == 200:
        dados = response.json()
        estado = dados.get("address", {}).get("state")
        
        if estado:
            params["registrations"] = estado
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                dados = response.json()
        
        # Processar registrations de forma segura
        registrations = dados.get("registrations")
        if registrations and len(registrations) > 0:
            inscricao_raw = registrations[0].get("number", "")
            inscricao_estadual = formatar_inscricao_estadual(inscricao_raw) if inscricao_raw else ""
            inscricao_habilitada = registrations[0].get("enabled", False)
            tipo_ie = registrations[0].get("type", {}).get("text", "")
        else:
            inscricao_estadual = "NÃO CONSTA"
            inscricao_habilitada = False
            # Para este caso, definimos o tipo como "IE Não Contribuinte" para que o valor seja 2
            tipo_ie = "IE Não Contribuinte"
        
        # Simples Nacional
        simples_optant = dados.get("company", {}).get("simples", {}).get("optant", False)
        simples_valor = 1 if simples_optant else 0

        inscricao_habilitada_valor = 1 if inscricao_habilitada else 0

        # Contribuinte: 2 para "IE Não Contribuinte", 0 para "IE Normal"
        if "IE Não Contribuinte" in tipo_ie:
            contribuinte_valor = 2
        elif "IE Normal" in tipo_ie:
            contribuinte_valor = 0
        else:
            contribuinte_valor = None
        
        resultado_filtrado = {
            "Razao Social": dados.get("company", {}).get("name"),
            "Endereco": f"{dados.get('address', {}).get('street', '')} {dados.get('address', {}).get('number', '')}",
            "Rua": dados.get("address", {}).get("street", ""),
            "Numero": dados.get("address", {}).get("number", ""),
            "Municipio": dados.get("address", {}).get("city"),
            "Bairro": dados.get("address", {}).get("district"),
            "Telefone": f"({dados.get('phones', [{}])[0].get('area', '')}) {dados.get('phones', [{}])[0].get('number', '')[:4]}-{dados.get('phones', [{}])[0].get('number', '')[4:]}",
            "UF": estado,
            "CEP": (f"{dados.get('address', {}).get('zip', '')[:5]}-{dados.get('address', {}).get('zip', '')[5:]}"
                    if dados.get("address", {}).get("zip") else ""),
            "Inscricao Estadual": inscricao_estadual,
            "Simples Nacional": simples_valor,
            "Inscricao Habilitada": inscricao_habilitada_valor,
            "Contribuinte": contribuinte_valor
        }
        
        return jsonify(resultado_filtrado)
    else:
        return jsonify({"erro": f"Não foi possível consultar o CNPJ. Código {response.status_code}"}), response.status_code

def formatar_inscricao_estadual(ie):
    """Formata a Inscrição Estadual no formato XX.XXX.XX-X, se tiver 8 dígitos"""
    ie = ie.strip() if ie else ""
    if ie and len(ie) == 8 and ie.isdigit():
        return f"{ie[:2]}.{ie[2:5]}.{ie[5:7]}-{ie[7:]}"
    return ie  # Retorna sem formatação se não atender ao esperado

@cnpj_bp.route('/api/atualizar_dados', methods=['POST'])
def atualizar_dados():
    try:
        dados_input = request.json
        cnpj = dados_input.get("cnpj")
        vendedor = dados_input.get("vendedor")
        nome_usuario = dados_input.get("nome")
        empresa_usuario = dados_input.get("empresa")
        inserir_em = dados_input.get("inserir_em")  # deve ser "cliente", "fornecedor" ou "ambos"

        if not cnpj:
            return jsonify({"erro": "CNPJ não fornecido."}), 400
        if not vendedor:
            return jsonify({"erro": "Vendedor não fornecido."}), 400
        if inserir_em not in ["cliente", "fornecedor", "ambos"]:
            return jsonify({"erro": "Opção de atualização inválida."}), 400
        if not nome_usuario or not empresa_usuario:
            return jsonify({"erro": "Dados do usuário incompletos."}), 400

        # Remove formatação do CNPJ para a consulta
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

        # Processa a inscrição estadual
        registrations = dados_consulta.get("registrations")
        if registrations and len(registrations) > 0:
            inscricao_raw = registrations[0].get("number", "")
            inscricao_estadual = formatar_inscricao_estadual(inscricao_raw) if inscricao_raw else ""
            inscricao_habilitada = registrations[0].get("enabled", False)
        else:
            inscricao_estadual = "NÃO CONSTA"
            inscricao_habilitada = False

        # Se for "NÃO CONSTA", converte para string vazia
        if inscricao_estadual.upper() == "NÃO CONSTA":
            inscricao_estadual = ""

        # Cálculos e definições adicionais
        carac_tributacao = 3 if inscricao_habilitada else 7
        finalidade = 0 if inscricao_habilitada else 2
        consumidor_final = 0 if inscricao_habilitada else 1
        simples_optant = dados_consulta.get("company", {}).get("simples", {}).get("optant", False)
        simples_valor = 1 if simples_optant else 0
        indIEdest_valor = 2 if carac_tributacao == 7 else 0 if carac_tributacao == 3 else None
        data_alteracao = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

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
            "Telefone": (f"({dados_consulta.get('phones', [{}])[0].get('area', '')}) "
                         f"{dados_consulta.get('phones', [{}])[0].get('number', '')[:4]}-"
                         f"{dados_consulta.get('phones', [{}])[0].get('number', '')[4:]}"
                         if dados_consulta.get("phones") and dados_consulta.get("phones")[0].get("number") else ""),
            "DataAlteracao": data_alteracao,
            "Vendedor": vendedor
        }

        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT ID FROM dbo.Dados_Empresa WHERE Ativo = 'True'")
            empresas = [row.ID for row in cursor.fetchall()]
            if not empresas:
                return jsonify({"erro": "Nenhuma empresa ativa encontrada."}), 404

            # Define os placeholders para uso nas cláusulas IN
            placeholders = ','.join(['?'] * len(empresas))

            # Consulta o ID do usuário para preencher UsuarioAlteracao
            cursor.execute("SELECT ID FROM dbo.Usuário WHERE IDEmpresa = ? AND USUARIO = ?", (empresa_usuario, nome_usuario))
            usuario_row = cursor.fetchone()
            usuario_alteracao = usuario_row[0] if usuario_row else None

            msg_pjuridica = ""
            msg_fornecedor = ""

            # Se atualizar em Cliente (PJuridica) ou em Ambos
            if inserir_em in ["cliente", "ambos"]:
                cursor.execute("""
                    WITH CTE AS (
                        SELECT *, ROW_NUMBER() OVER (PARTITION BY CNPJ ORDER BY (SELECT 0)) AS rn
                        FROM dbo.Pjuridica
                    )
                    SELECT CNPJ FROM CTE WHERE rn = 1 AND CNPJ = ?
                """, (cnpj,))
                resultado_pjuridica = cursor.fetchone()
                if resultado_pjuridica:
                    # UPDATE em PJuridica
                    update_query_pjuridica = f'''
                        UPDATE dbo.Pjuridica
                        SET RasSocial = ?,
                            InscEstadual = ?,
                            Rua = ?,
                            Num = ?,
                            Bairro = ?,
                            CEP = ?,
                            Cidade = ?,
                            UF = ?,
                            Tel01 = ?,
                            DataAlteracao = ?,
                            Vendedor = ?,
                            UsuarioAlteracao = ?,
                            SimplesNacional = ?,
                            indIEDest = ?,
                            CaracTributacao = ?,
                            Finalidade = ?,
                            consumidorFinal = ?
                        WHERE CNPJ = ? AND IDEmpresa IN ({placeholders})
                    '''
                    params_update_pjuridica = (
                        update_data["Razao Social"][:65],
                        update_data["Inscricao Estadual"],
                        update_data["Rua"],
                        update_data["Numero"],
                        update_data["Bairro"],
                        update_data["CEP"],
                        update_data["Municipio"],
                        update_data["UF"],
                        update_data["Telefone"],
                        data_alteracao,
                        update_data["Vendedor"],
                        usuario_alteracao,
                        simples_valor,
                        indIEdest_valor,
                        carac_tributacao,
                        finalidade,
                        consumidor_final,
                        cnpj,
                        *empresas
                    )
                    cursor.execute(update_query_pjuridica, params_update_pjuridica)
                    msg_pjuridica = "Dados PJuridica atualizados com sucesso."
                else:
                    # INSERT em PJuridica
                    cursor.execute("SELECT MAX(ID_Pjuridica) FROM dbo.Pjuridica;")
                    row = cursor.fetchone()
                    max_id = row[0] if row and row[0] is not None else 0
                    novo_id = max_id
                    columns_insert_pjuridica = [
                        "ID_Pjuridica", "IDEmpresa", "CNPJ", "RasSocial", "InscEstadual", "Rua", "Num", "Bairro", "CEP", "Cidade", "UF",
                        "Tel01", "DataAlteracao", "DataReg", "Vendedor", "UsuarioAlteracao", "SimplesNacional", "indIEDest",
                        "CaracTributacao", "Finalidade", "consumidorFinal",
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
                        usuario_alteracao,
                        simples_valor,
                        indIEdest_valor,
                        carac_tributacao,
                        finalidade,
                        consumidor_final
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

            # Se atualizar em Fornecedor ou em Ambos
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
                        usuario_alteracao,
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
                            "",  # NomeFantasia
                            update_data["Inscricao Estadual"],
                            None,
                            "REVENDA",
                            dados_consulta.get("address", {}).get("street") or "",
                            dados_consulta.get("address", {}).get("number") or "",
                            "",  # Complemento
                            dados_consulta.get("address", {}).get("district") or "",
                            update_data["CEP"],
                            dados_consulta.get("address", {}).get("city") or "",
                            estado or "",
                            data_alteracao,  # DataReg
                            update_data["Telefone"],
                            "",  # Tel02
                            "",  # Email
                            None,  # HomePage
                            None,  # OBS
                            True, True, True, True, True, True,
                            0.0000, 0.0000, 0, 0, 0, 0, 0, 0,
                            None, None, None, None, None, 0,
                            carac_tributacao,
                            simples_valor,
                            usuario_alteracao,
                            data_alteracao,
                            0,
                            0
                        )
                        cursor.execute(insert_query_fornecedor, params_insert_fornecedor)
                        inserted_fornecedor_ids.append(novo_fornecedor_id)
                    msg_fornecedor = f"Novo registro Fornecedor inserido com sucesso. IDs: {inserted_fornecedor_ids}"

            conn.commit()
            return jsonify({"mensagem": f"{msg_pjuridica} {msg_fornecedor}"})
    except Exception as e:
        print(f"Erro ao atualizar dados: {e}")
        return jsonify({"erro": str(e)}), 500