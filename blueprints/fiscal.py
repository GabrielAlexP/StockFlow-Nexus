from flask import Blueprint, render_template, jsonify, request
from datetime import datetime
import pandas as pd
from services.database import get_connection
from email.utils import parsedate_to_datetime

fiscal_bp = Blueprint('fiscal', __name__)

def get_last_id(tabela):
    """Obtém o último ID da tabela usando a conexão do Flask"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        query = f"SELECT MAX(ID) FROM dbo.{tabela}"
        cursor.execute(query)
        result = cursor.fetchone()
        last_id = result[0] if result[0] is not None else 0
        cursor.close()
        conn.close()
        return last_id
    except Exception as e:
        print(f"Erro ao buscar último ID: {str(e)}")
        return None

def gerar_registros(ultimo_id, ncm, cfop, origens, codigos):
    registros = []
    carac_trib = {2: "A", 1: "D", 8: "PF", 7: "PJ", 3: "V"}
    map_finalidade = {0: 'R', 1: 'I', 2: 'U'}
    data_atual = datetime.now().strftime("%Y-%m-%d %H:%M:00")
    usuario = 124  

    current_id = ultimo_id + 1

    for ct_code in [2, 1, 8, 7, 3]:
        for finalidade in [0, 1, 2]:
            for simples in [False, True]:
                for origem in origens:
                    regime = 'simples' if simples else 'normal'
                    cod_regime = codigos[origem][regime]
                    desc = f"{ncm} - {carac_trib[ct_code]} {map_finalidade[finalidade]} {'S' if simples else ''} {origem} {cfop}"
                    registros.append([
                        current_id,
                        desc,
                        cfop,
                        ct_code,
                        finalidade,
                        origem,
                        cod_regime['ipi'],
                        cod_regime['pis_cofins'],
                        cod_regime['trib'],
                        data_atual,
                        usuario,
                        1 if simples else 0
                    ])
                    current_id += 1
    return registros

def gerar_registros_empresa(df_perfil, ultimo_id_empresa, empresa):
    registros = []
    current_id = ultimo_id_empresa + 1
    for id_perfil in df_perfil['Id']:
        registros.append([current_id, empresa, id_perfil])
        current_id += 1
    return pd.DataFrame(registros, columns=["Id", "IDEmpresa", "IdPerfil"])

def gerar_registros_ncm(df_perfil, ultimo_id_ncm, ncm_valor):
    registros = []
    current_id = ultimo_id_ncm + 1
    for id_perfil in df_perfil['Id']:
        registros.append([current_id, ncm_valor, id_perfil])
        current_id += 1
    return pd.DataFrame(registros, columns=["Id", "NCM", "IdPerfil"])

def gerar_registros_uf(df_perfil, ultimo_id_uf, uf):
    registros = []
    current_id = ultimo_id_uf + 1
    for id_perfil in df_perfil['Id']:
        registros.append([current_id, uf, id_perfil])
        current_id += 1
    return pd.DataFrame(registros, columns=["Id", "UF", "IdPerfil"])


def verificar_existencia_regra_ipi(regra_ipi):
    """Verifica se a RegraIpi existe na tabela PerfilFiscal_IPI"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM dbo.PerfilFiscal_IPI WHERE Id = ?", (regra_ipi,))
        existe = cursor.fetchone()[0] > 0
        cursor.close()
        conn.close()
        return existe
    except Exception as e:
        print(f"Erro ao verificar RegraIpi: {str(e)}")
        return False

def inserir_no_banco(df, tabela, insert_query):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(f"SET IDENTITY_INSERT dbo.{tabela} ON")
        conn.commit()

        values_list = []
        for _, row in df.iterrows():
            if tabela == "PerfilFiscal":
                data_alteracao = row['DataAlteracao']
                if isinstance(data_alteracao, str):
                    data_alteracao = parsedate_to_datetime(data_alteracao).replace(tzinfo=None)
                elif isinstance(data_alteracao, pd.Timestamp):
                    data_alteracao = data_alteracao.to_pydatetime()
                regra_ipi = int(row['RegraIpi'])
                if not verificar_existencia_regra_ipi(regra_ipi):
                    print(f"Erro: RegraIpi {regra_ipi} não existe na tabela PerfilFiscal_IPI.")
                    return False
                valores = (
                    int(row['Id']),
                    str(row['Descricao']),
                    int(row['Cfop']),
                    int(row['CaracTributacao']),
                    int(row['Finalidade']),
                    int(row['Origem']),
                    regra_ipi,
                    int(row['RegraPisCofins']),
                    int(row['RegraTrib']),
                    data_alteracao,
                    int(row['UsuarioAlteracao']),
                    int(row['SimplesNacional'])
                )
            elif tabela == "PerfilFiscal_Empresa":
                valores = (
                    int(row['Id']),
                    str(row['IDEmpresa']),
                    int(row['IdPerfil'])
                )
            elif tabela == "PerfilFiscal_NCM":
                valores = (
                    int(row['Id']),
                    str(row['NCM']),
                    int(row['IdPerfil'])
                )
            elif tabela == "PerfilFiscal_UF":
                valores = (
                    int(row['Id']),
                    str(row['UF']),
                    int(row['IdPerfil'])
                )
            else:
                valores = tuple(row)
            values_list.append(valores)
        cursor.executemany(insert_query, values_list)
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Erro na inserção: {str(e)}")
        return False
    finally:
        try:
            cursor.execute(f"SET IDENTITY_INSERT dbo.{tabela} OFF")
            conn.commit()
            cursor.close()
            conn.close()
        except:
            pass

@fiscal_bp.route('/fiscal', methods=['GET'])
def fiscal_page():
    return render_template('fiscal.html')



@fiscal_bp.route('/gerar-perfil', methods=['POST'])
def gerar_perfil_route():
    data = request.json
    try:
        ncm = data['ncm'].strip()
        cfop = data['cfop'].strip()
        origens = data['origens']
        
        if not all([ncm, cfop, origens]):
            return jsonify({"error": "Campos obrigatórios faltando"}), 400

        codigos = {}
        for origem in origens:
            valor = origem['valor'].strip()
            codigos[valor] = {
                'normal': {
                    'ipi': int(origem['normal']['ipi']),
                    'pis_cofins': int(origem['normal']['pis_cofins']),
                    'trib': int(origem['normal']['trib'])
                },
                'simples': {
                    'ipi': int(origem['simples']['ipi']),
                    'pis_cofins': int(origem['simples']['pis_cofins']),
                    'trib': int(origem['simples']['trib'])
                }
            }

        ultimo_id = get_last_id("PerfilFiscal")
        if ultimo_id is None:
            return jsonify({"error": "Erro ao acessar o banco"}), 500

        registros = gerar_registros(ultimo_id, ncm, cfop, list(codigos.keys()), codigos)
        df_perfil = pd.DataFrame(registros, columns=[
            'Id', 'Descricao', 'Cfop', 'CaracTributacao', 'Finalidade',
            'Origem', 'RegraIpi', 'RegraPisCofins', 'RegraTrib',
            'DataAlteracao', 'UsuarioAlteracao', 'SimplesNacional'
        ]).astype({
            'Id': 'int32',
            'CaracTributacao': 'int8',
            'Finalidade': 'int8',
            'Origem': 'int8',
            'RegraIpi': 'int32',
            'RegraPisCofins': 'int32',
            'RegraTrib': 'int32',
            'UsuarioAlteracao': 'int32',
            'SimplesNacional': 'int8',
            'DataAlteracao': 'datetime64[ns]'
        })

        return jsonify({
            "success": True,
            "perfil": df_perfil.to_dict(orient='records'),
            "preview": df_perfil.to_html(index=False)
        })

    except Exception as e:
        return jsonify({"error": f"Erro no processamento: {str(e)}"}), 500

@fiscal_bp.route('/inserir-dados', methods=['POST'])
def inserir_dados():
    try:
        data = request.json
        tabelas = {
            'PerfilFiscal': data.get('perfil'),
            'PerfilFiscal_Empresa': data.get('empresa'),
            'PerfilFiscal_NCM': data.get('ncm'),
            'PerfilFiscal_UF': data.get('uf')
        }

        queries = {
            'PerfilFiscal': """INSERT INTO dbo.PerfilFiscal 
                (Id, Descricao, Cfop, CaracTributacao, Finalidade, Origem, RegraIpi, RegraPisCofins, RegraTrib, DataAlteracao, UsuarioAlteracao, SimplesNacional) 
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            'PerfilFiscal_Empresa': """INSERT INTO dbo.PerfilFiscal_Empresa 
                (Id, IDEmpresa, IdPerfil) 
                VALUES (?,?,?)""",
            'PerfilFiscal_NCM': """INSERT INTO dbo.PerfilFiscal_NCM 
                (Id, NCM, IdPerfil) 
                VALUES (?,?,?)""",
            'PerfilFiscal_UF': """INSERT INTO dbo.PerfilFiscal_UF 
                (Id, UF, IdPerfil) 
                VALUES (?,?,?)"""
        }
        for tabela, dados in tabelas.items():
            if dados:
                if tabela == "PerfilFiscal":
                    df = pd.DataFrame(dados)
                    
                    df['DataAlteracao'] = pd.to_datetime(df['DataAlteracao']).dt.tz_localize(None)
                    df = df.astype({
                        'Id': 'int32',
                        'CaracTributacao': 'int8',
                        'Finalidade': 'int8',
                        'Origem': 'int8',
                        'RegraIpi': 'int32',
                        'RegraPisCofins': 'int32',
                        'RegraTrib': 'int32',
                        'UsuarioAlteracao': 'int32',
                        'SimplesNacional': 'int8'
                    })
                elif tabela == "PerfilFiscal_Empresa":
                    df = pd.DataFrame(dados, columns=["Id", "IDEmpresa", "IdPerfil"])
                    df = df.astype({'Id': 'int32', 'IdPerfil': 'int32'})
                elif tabela == "PerfilFiscal_NCM":
                    df = pd.DataFrame(dados, columns=["Id", "NCM", "IdPerfil"])
                    df = df.astype({'Id': 'int32', 'IdPerfil': 'int32'})
                elif tabela == "PerfilFiscal_UF":
                    df = pd.DataFrame(dados, columns=["Id", "UF", "IdPerfil"])
                    df = df.astype({'Id': 'int32', 'IdPerfil': 'int32'})
                if not inserir_no_banco(df, tabela, queries[tabela]):
                    return jsonify({"error": f"Falha ao inserir {tabela}"}), 500

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Erro geral: {str(e)}"}), 500

@fiscal_bp.route('/gerar-empresa', methods=['POST'])
def gerar_empresa_route():
    try:
        data = request.json
        if not data or 'empresa' not in data or 'perfil' not in data:
            return jsonify({"error": "Dados incompletos ou formato inválido"}), 400

        empresa = data['empresa'].strip()
        if not empresa:
            return jsonify({"error": "Empresa não informada"}), 400

        try:
            df_perfil = pd.DataFrame(data['perfil'])
            if 'Id' not in df_perfil.columns:
                return jsonify({"error": "Dados do PerfilFiscal inválidos"}), 400
        except Exception as e:
            return jsonify({"error": f"Erro ao processar perfil: {str(e)}"}), 400

        ultimo_id = get_last_id("PerfilFiscal_Empresa")
        if ultimo_id is None:
            return jsonify({"error": "Erro ao acessar o banco"}), 500

        df_empresa = gerar_registros_empresa(df_perfil, ultimo_id, empresa)
        return jsonify({
            "success": True,
            "empresa": df_empresa.to_dict(orient='records'),
            "preview": df_empresa.to_html(index=False)
        })
    except Exception as e:
        return jsonify({"error": f"Erro interno: {str(e)}"}), 500

@fiscal_bp.route('/gerar-ncm', methods=['POST'])
def gerar_ncm_route():
    try:
        data = request.json
        df_perfil = pd.DataFrame(data['perfil'])
        ncm_valor = data['ncm'].strip()

        if not ncm_valor:
            return jsonify({"error": "NCM não informado"}), 400

        ultimo_id = get_last_id("PerfilFiscal_NCM")
        if ultimo_id is None:
            return jsonify({"error": "Erro ao acessar o banco"}), 500

        df_ncm = gerar_registros_ncm(df_perfil, ultimo_id, ncm_valor)
        return jsonify({
            "success": True,
            "ncm": df_ncm.to_dict(orient='records'),
            "preview": df_ncm.to_html(index=False)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@fiscal_bp.route('/gerar-uf', methods=['POST'])
def gerar_uf_route():
    try:
        data = request.json
        df_perfil = pd.DataFrame(data['perfil'])
        uf = data['uf'].strip().upper()

        if not uf or len(uf) != 2:
            return jsonify({"error": "UF inválida"}), 400

        ultimo_id = get_last_id("PerfilFiscal_UF")
        if ultimo_id is None:
            return jsonify({"error": "Erro ao acessar o banco"}), 500

        df_uf = gerar_registros_uf(df_perfil, ultimo_id, uf)
        return jsonify({
            "success": True,
            "uf": df_uf.to_dict(orient='records'),
            "preview": df_uf.to_html(index=False)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
