import datetime
from flask import Blueprint, render_template, jsonify, request, session
from services.database import conn_str
import pyodbc
from services.database import get_connection
from services.log import log_event  # Importando o log
from werkzeug.utils import secure_filename
import os

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
                WHERE OBS <> ''
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
                SELECT LogON, Sexo, ID_Vendedor, IDEmpresa, OBS, Senha 
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
                    "Empresa": resultado.IDEmpresa,
                    "Cargo": resultado.OBS
                }
                # Aqui você pode optar por armazenar o objeto completo em session, se necessário.
                session["usuario"] = usuario_data["Nome"]  # Armazena o nome do usuário na session
                log_event(usuario)  # Registra o login no log
                return jsonify({"sucesso": True, "usuario": usuario_data})
            else:
                return jsonify({"sucesso": False, "mensagem": "Login mal-sucedido!"})

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": f"Erro no servidor: {str(e)}"}), 500

@auth_bp.route('/api/ultimas_compras', methods=['GET'])
def get_ultimas_compras():
    try:
        # Recebe o ID da empresa via query string (ex: ?empresa=1)
        empresa_id = request.args.get('empresa', type=int)
        if not empresa_id:
            return jsonify({"erro": "Parâmetro 'empresa' é obrigatório."}), 400

        query = """
        SELECT 
            dc.IDCompras, 
            dc.IDProduto, 
            dc.Qtd, 
            e.DescProduto, 
            c.DataPrevisao
        FROM 
            DetCompras dc
        JOIN 
            Estoque e ON dc.IDProduto = e.ID
        JOIN 
            (SELECT TOP 4 IDCompras, DataPrevisao
             FROM Compras
             WHERE IDEmpresa = ?  
             AND Status = 'F'
             ORDER BY IDCompras DESC) c 
        ON dc.IDCompras = c.IDCompras
        WHERE 
            dc.IDEmpresa = ?;
        """

        with pyodbc.connect(conn_str) as conn:
            cursor = conn.cursor()
            cursor.execute(query, (empresa_id, empresa_id))
            rows = cursor.fetchall()

        # Agrupa as linhas pelo IDCompras
        groups = {}
        for row in rows:
            purchase_id = row.IDCompras
            if purchase_id not in groups:
                groups[purchase_id] = []
            groups[purchase_id].append({
                "Codigo": row.IDProduto,
                "Descricao": row.DescProduto,
                "Quantidade": row.Qtd,
                "DataCompra": row.DataPrevisao.strftime("%Y-%m-%d") if isinstance(row.DataPrevisao, (datetime.date, datetime.datetime)) else row.DataPrevisao
            })

        # Ordena os grupos pelo IDCompras (do menor para o maior)
        sorted_groups = sorted(groups.items(), key=lambda x: x[0])
        if len(sorted_groups) < 4:
            return jsonify({"erro": "Não foram encontradas quatro compras recentes."}), 404

        result = {
            "Grupo 1": sorted_groups[0][1],
            "Grupo 2": sorted_groups[1][1],
            "Grupo 3": sorted_groups[2][1],
            "Grupo 4": sorted_groups[3][1]
        }
        return jsonify(result)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@auth_bp.route('/api/upload_image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'erro': 'Nenhuma imagem enviada'}), 400

    image = request.files['image']
    tipo = request.form.get('tipo')
    empresa = request.form.get('empresa')

    if tipo not in ['banner', 'promo', 'main']:
        return jsonify({'erro': 'Tipo inválido'}), 400
    if not empresa:
        return jsonify({'erro': 'Empresa não informada'}), 400
    if image.filename == '':
        return jsonify({'erro': 'Nenhum arquivo selecionado'}), 400

    filename = secure_filename(image.filename)
    base_path = os.path.join(os.getcwd(), 'static', 'img', str(empresa), tipo)
    os.makedirs(base_path, exist_ok=True)

    save_path = os.path.join(base_path, filename)
    image.save(save_path)

    image_url = f"/static/img/{empresa}/{tipo}/{filename}"
    return jsonify({'sucesso': True, 'image_url': image_url})

@auth_bp.route('/api/get_images', methods=['GET'])
def get_images():
    empresa = request.args.get("empresa")
    if not empresa:
        return jsonify({"erro": "Empresa não informada"}), 400

    base = os.path.join(os.getcwd(), "static", "img", str(empresa))
    images = {}
    for tipo in ["banner", "promo", "main"]:
        folder = os.path.join(base, tipo)
        if os.path.exists(folder):
            files = [f for f in os.listdir(folder) if os.path.isfile(os.path.join(folder, f))]
            images[tipo] = [f"/static/img/{empresa}/{tipo}/{f}" for f in files]
        else:
            images[tipo] = []
    return jsonify(images)

@auth_bp.route('/api/delete_image', methods=['POST'])
def delete_image():
    tipo = request.form.get('tipo')
    filename = request.form.get('filename')
    empresa = request.form.get('empresa')

    if tipo not in ['banner', 'promo', 'main']:
        return jsonify({'erro': 'Tipo inválido'}), 400
    if not filename or not empresa:
        return jsonify({'erro': 'Parâmetros insuficientes'}), 400

    base_path = os.path.join(os.getcwd(), 'static', 'img', str(empresa), tipo)
    file_path = os.path.join(base_path, filename)
    if not os.path.exists(file_path):
        return jsonify({'erro': 'Arquivo não encontrado'}), 400
    try:
        os.remove(file_path)
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500
