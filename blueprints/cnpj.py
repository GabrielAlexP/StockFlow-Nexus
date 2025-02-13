from flask import Blueprint, render_template, jsonify, request
import requests
from services.database import get_connection
from datetime import datetime

cnpj_bp = Blueprint('cnpj', __name__)

API_KEY = "147b9e92-75c2-49d0-a626-41d035948f34-0321b847-0e74-4bf8-bb43-0fcc8d73d061"
API_URL = "https://api.cnpja.com/office/"

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

        if not cnpj:
            return jsonify({"erro": "CNPJ não fornecido."}), 400
        if not vendedor:
            return jsonify({"erro": "Vendedor não fornecido."}), 400

        # Remover formatação do CNPJ para a consulta
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

        # Processar registrations de forma segura
        registrations = dados_consulta.get("registrations")
        if registrations and len(registrations) > 0:
            inscricao_raw = registrations[0].get("number", "")
            inscricao_estadual = formatar_inscricao_estadual(inscricao_raw) if inscricao_raw else ""
            inscricao_habilitada = registrations[0].get("enabled", False)
        else:
            inscricao_estadual = "NÃO CONSTA"
            inscricao_habilitada = False

        # Condicionais atualizadas
        carac_tributacao = 3 if inscricao_habilitada else 7
        finalidade = 0 if inscricao_habilitada else 2
        consumidor_final = 0 if inscricao_habilitada else 1

        simples_optant = dados_consulta.get("company", {}).get("simples", {}).get("optant", False)
        simples_valor = 1 if simples_optant else 0

        # Nova lógica baseada em carac_tributacao
        if carac_tributacao == 7:
            indIEdest_valor = 2
        elif carac_tributacao == 3:
            indIEdest_valor = 0
        else:
            indIEdest_valor = None

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

            # Verificar se o CNPJ já existe
            cursor.execute("""
                WITH CTE AS (
                    SELECT *, ROW_NUMBER() OVER (PARTITION BY CNPJ ORDER BY (SELECT 0)) AS rn
                    FROM dbo.Pjuridica
                )
                SELECT CNPJ FROM CTE WHERE rn = 1 AND CNPJ = ?
            """, (cnpj,))
            resultado = cursor.fetchone()

            if resultado:
                # Se o CNPJ existir, faz UPDATE (limitando "RasSocial" a 65 caracteres)
                placeholders = ','.join(['?'] * len(empresas))
                update_query = f'''
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
                        SimplesNacional = ?,
                        indIEDest = ?,
                        CaracTributacao = ?,
                        Finalidade = ?,
                        consumidorFinal = ?
                    WHERE CNPJ = ? AND IDEmpresa IN ({placeholders})
                '''
                params_update = (
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
                    update_data["Vendedor"],
                    simples_valor,
                    indIEdest_valor,
                    carac_tributacao,
                    finalidade,
                    consumidor_final,
                    cnpj,
                    *empresas
                )
                cursor.execute(update_query, params_update)
                conn.commit()
                return jsonify({"mensagem": "Dados atualizados com sucesso."})
            else:
                # Se o CNPJ não existir, faz INSERT para cada empresa ativa
                cursor.execute("SELECT MAX(ID_Pjuridica) FROM dbo.Pjuridica;")
                row = cursor.fetchone()
                max_id = row[0] if row and row[0] is not None else 0
                novo_id = max_id  # Inicializa novo_id

                # Lista de 92 colunas (incluindo IDEmpresa e DataReg)
                columns_insert = [
                    "ID_Pjuridica", "IDEmpresa", "CNPJ", "RasSocial", "InscEstadual", "Rua", "Num", "Bairro", "CEP", "Cidade", "UF",
                    "Tel01", "DataAlteracao", "DataReg", "Vendedor", "SimplesNacional", "indIEDest", "CaracTributacao", "Finalidade", "consumidorFinal",
                    "NomeFantasia", "Contato", "Atividade", "Complemento", "Email", "FAX", "Tel02", "HomePage",
                    "Sócio01", "CPFSócio01", "RGSócio01", "Sócio02", "CPFSócio02", "RGSócio02", "Sócio03", "CPFSócio03", "RGSócio03",
                    "RefComercial01", "RefComercial02", "RefBancária01", "RefBancária02", "Bloqueio", "Situação", "Crédito", "Conceito", "OBS",
                    "Revenda", "BloqueioAVista", "BloqueioAPrazo", "StatusAtivo", "RuaC", "NumC", "ComplementoC", "BairroC", "CEPC", "CidadeC", "UFC",
                    "RuaE", "NumE", "ComplementoE", "BairroE", "CEPE", "CidadeE", "UFE", "IDTransportadora", "CODUF", "CODMUNICIPIO", "CODUFC", "CODMUNICIPIOC", "CODUFE", "CODMUNICIPIOE",
                    "OBSVENDA", "TipoE", "CFOPe", "TipoS", "CFOPs", "PersonalizaE", "PersonalizaS", "SETOR", "EspePagamento", "Usuario", "Senha", "ECF", "InscMun", "IND_TRANSITO_PARA_SCWEB",
                    "COD_EXTERNO_SCWEB", "LIMITE_CAIXAS", "EmailC", "DescontoBoleto", "Indicacao", "TodosAtende", "IdEstrangeiro"
                ]
                placeholders_insert = ", ".join(["?"] * len(columns_insert))
                insert_query = f'''
                    INSERT INTO dbo.Pjuridica 
                    ({", ".join(columns_insert)})
                    VALUES ({placeholders_insert})
                '''
                # Parâmetros fixos para as 20 primeiras posições (exceto ID_Pjuridica e IDEmpresa)
                base_params = (
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
                    data_alteracao,  # DataReg
                    update_data["Vendedor"],
                    simples_valor,
                    indIEdest_valor,
                    carac_tributacao,
                    finalidade,
                    consumidor_final
                )
                # Parâmetros adicionais fixos (72 valores)
                additional_params = (
                    None,    # NomeFantasia
                    None,    # Contato
                    None,    # Atividade
                    None,    # Complemento
                    None,    # Email
                    '',      # FAX
                    '',      # Tel02
                    None,    # HomePage
                    None,    # Sócio01
                    None,    # CPFSócio01
                    None,    # RGSócio01
                    None,    # Sócio02
                    None,    # CPFSócio02
                    None,    # RGSócio02
                    None,    # Sócio03
                    None,    # CPFSócio03
                    None,    # RGSócio03
                    None,    # RefComercial01
                    None,    # RefComercial02
                    None,    # RefBancária01
                    None,    # RefBancária02
                    'NÃO',   # Bloqueio
                    'BOM',   # Situação
                    0.0000,  # Crédito
                    'BOM',   # Conceito
                    None,    # OBS
                    1,       # Revenda
                    0,       # BloqueioAVista
                    0,       # BloqueioAPrazo
                    1,       # StatusAtivo
                    None,    # RuaC
                    None,    # NumC
                    None,    # ComplementoC
                    None,    # BairroC
                    None,    # CEPC
                    None,    # CidadeC
                    None,    # UFC
                    None,    # RuaE
                    None,    # NumE
                    None,    # ComplementoE
                    None,    # BairroE
                    None,    # CEPE
                    None,    # CidadeE
                    None,    # UFE
                    None,    # IDTransportadora
                    None,    # CODUF
                    None,    # CODMUNICIPIO
                    None,    # CODUFC
                    None,    # CODMUNICIPIOC
                    None,    # CODUFE
                    None,    # CODMUNICIPIOE
                    0,       # OBSVENDA
                    None,    # TipoE
                    None,    # CFOPe
                    None,    # TipoS
                    None,    # CFOPs
                    0,       # PersonalizaE
                    0,       # PersonalizaS
                    None,    # SETOR
                    0,       # EspePagamento
                    None,    # Usuario
                    None,    # Senha
                    1,       # ECF
                    None,    # InscMun
                    None,    # IND_TRANSITO_PARA_SCWEB
                    None,    # COD_EXTERNO_SCWEB
                    None,    # LIMITE_CAIXAS
                    None,    # EmailC
                    None,    # DescontoBoleto
                    None,    # Indicacao
                    0,       # TodosAtende
                    None     # IdEstrangeiro
                )
                inserted_ids = []
                # Para cada empresa ativa, insere um registro novo.
                for empresa in empresas:
                    novo_id += 1
                    params_insert = (novo_id, empresa) + base_params + additional_params
                    cursor.execute(insert_query, params_insert)
                    inserted_ids.append(novo_id)
                conn.commit()
                return jsonify({"mensagem": "Novo registro inserido com sucesso.", "IDs_Pjuridica": inserted_ids})

    except Exception as e:
        print(f"Erro ao atualizar dados: {e}")
        return jsonify({"erro": str(e)}), 500
