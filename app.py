import os
from flask import Flask
from flask_cors import CORS

from blueprints.auth import auth_bp
from blueprints.estoque import estoque_bp
from blueprints.status import status_bp 
from blueprints.ranking import ranking_bp
from blueprints.cnpj import cnpj_bp
from blueprints.fiscal import fiscal_bp
from blueprints.dashboard import admin_bp, gerente_bp, vendedor_bp
from blueprints.vendas import venda_bp
from blueprints.info import info_bp
from blueprints.tela_venda import tela_venda_bp
from blueprints.pix import pix_bp
from blueprints.escritorio import escritorio_bp
from blueprints.meta import meta_bp
from blueprints.cad import cad_usuario_bp
from blueprints.entrega import entrega_bp
from blueprints.produtos import produtos_bp

from services.email import iniciar_agendamento, set_flask_app
from services.pdf import report_bp, currency_format
from services.decrypt_secret import descriptografar_secret_key

secret_data = descriptografar_secret_key()

app = Flask(__name__)
app.config["SECRET_KEY"] = secret_data["secret_key"]
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.jinja_env.filters['currency_format'] = currency_format

app.register_blueprint(auth_bp)
app.register_blueprint(estoque_bp)
app.register_blueprint(status_bp)
app.register_blueprint(ranking_bp)
app.register_blueprint(cnpj_bp)
app.register_blueprint(fiscal_bp)
app.register_blueprint(venda_bp)
app.register_blueprint(pix_bp)
app.register_blueprint(escritorio_bp)
app.register_blueprint(info_bp)
app.register_blueprint(tela_venda_bp)
app.register_blueprint(meta_bp)
app.register_blueprint(cad_usuario_bp)
app.register_blueprint(entrega_bp)
app.register_blueprint(produtos_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(gerente_bp)
app.register_blueprint(vendedor_bp)
app.register_blueprint(report_bp)

set_flask_app(app)

if __name__ == "__main__":
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        iniciar_agendamento()
    app.run(host="0.0.0.0", port=5000, debug=False)
