import smtplib
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email import encoders
import threading
import schedule
import time

flask_app = None

def set_flask_app(application):
    global flask_app
    flask_app = application

def enviar_email_multiplos_anexos_memoria(anexos, assunto, destinatario):
    remetente = "21988612012g@gmail.com"
    senha = "psjo dwsr qlqf fhwx"

    msg = MIMEMultipart()
    msg["From"] = remetente
    msg["To"] = destinatario
    msg["Subject"] = assunto

    corpo = "Segue em anexo o relatório completo (diário e mensal)."
    msg.attach(MIMEText(corpo, "plain"))

    for filename, pdf_bytes in anexos:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename={filename}")
        msg.attach(part)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(remetente, senha)
            server.sendmail(remetente, destinatario, msg.as_string())
            print(f"E-mail enviado com sucesso para {destinatario}")
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")

def enviar_relatorios_memoria():
    from services.pdf import gerar_relatorio_completo_bytes
    if flask_app is None:
        print("Instância do Flask não definida!")
        return
    # Utiliza o flask_app para criar um contexto da aplicação
    with flask_app.app_context():
        filename, pdf_bytes = gerar_relatorio_completo_bytes()
    anexos = [(filename, pdf_bytes)]
    enviar_email_multiplos_anexos_memoria(anexos, "Relatório Completo Diário e Mensal", "gabriel@lojascom.com.br")

def configurar_agendamento():
    schedule.every().day.at("08:00").do(enviar_relatorios_memoria)

    while True:
        schedule.run_pending()
        time.sleep(1)

def iniciar_agendamento():
    agendamento_thread = threading.Thread(target=configurar_agendamento)
    agendamento_thread.daemon = True
    agendamento_thread.start()
