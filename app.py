from flask import Flask
from flask_cors import CORS
from blueprints.auth import auth_bp
from blueprints.estoque import estoque_bp
from blueprints.status import status_bp 
from blueprints.ranking import ranking_bp
from blueprints.cnpj import cnpj_bp
from blueprints.fiscal import fiscal_bp
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(auth_bp)
app.register_blueprint(estoque_bp)
app.register_blueprint(status_bp)
app.register_blueprint(ranking_bp)
app.register_blueprint(cnpj_bp)
app.register_blueprint(fiscal_bp)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)