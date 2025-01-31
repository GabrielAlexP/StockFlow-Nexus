from flask import Blueprint, render_template, jsonify, request
from services.database import conn_str
import pyodbc
from services.database import get_connection

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/')
def login():
    return render_template('login.html')

@auth_bp.route('/portal')
def index():
    return render_template('portal.html')

@auth_bp.route('/api/empresas', methods=['GET'])
def get_empresas():
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT ID FROM dbo.Dados_Empresa WHERE Ativo = 'True'")
            empresas = [{"IDEmpresa": row.ID} for row in cursor.fetchall()]
        return jsonify(empresas)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@auth_bp.route('/api/vendedores/<int:empresa_id>', methods=['GET'])
def get_vendedores(empresa_id):
    try:
        with pyodbc.connect(conn_str) as conn:
            cursor = conn.cursor()
            query = """
                SELECT LogON FROM Vendedor
                WHERE OBS IN ('Admin', 'Gerente', 'Vendedor', 'Supervisor', 'Estoque')
                AND IDEmpresa = ?;
            """
            cursor.execute(query, empresa_id)
            vendedores = [{"LogON": row.LogON} for row in cursor.fetchall()]
        return jsonify(vendedores)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@auth_bp.route('/api/login', methods=['POST'])
def validar_login():
    try:
        data = request.json
        empresa_id = data.get("IDEmpresa")
        usuario = data.get("LogON")
        senha = data.get("Senha")

        if not empresa_id or not usuario or not senha:
            return jsonify({"sucesso": False, "mensagem": "Preencha todos os campos!"}), 400

        with pyodbc.connect(conn_str) as conn:
            cursor = conn.cursor()
            query = """
                SELECT LogON, Sexo, ID_Vendedor, Fax, OBS, Senha 
                FROM Vendedor
                WHERE LogON = ? AND IDEmpresa = ?;
            """
            cursor.execute(query, (usuario, empresa_id))
            resultado = cursor.fetchone()

            if resultado and resultado.Senha == senha:
                usuario_data = {
                    "Nome": resultado.LogON,
                    "Sexo": resultado.Sexo,
                    "Vendedor": resultado.ID_Vendedor,
                    "Meta": resultado.Fax,
                    "Cargo": resultado.OBS
                }
                return jsonify({"sucesso": True, "usuario": usuario_data})
            else:
                return jsonify({"sucesso": False, "mensagem": "Login mal-sucedido!"})

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": f"Erro no servidor: {str(e)}"}), 500