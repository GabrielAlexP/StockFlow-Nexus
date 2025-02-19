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
from services.email import iniciar_agendamento, set_flask_app
from services.pdf import report_bp, currency_format

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.jinja_env.filters['currency_format'] = currency_format

# Registra os blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(estoque_bp)
app.register_blueprint(status_bp)
app.register_blueprint(ranking_bp)
app.register_blueprint(cnpj_bp)
app.register_blueprint(fiscal_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(gerente_bp)
app.register_blueprint(vendedor_bp)
app.register_blueprint(report_bp)

set_flask_app(app)

if __name__ == "__main__":
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        iniciar_agendamento()
    app.run(host="0.0.0.0", port=5000, debug=True)
