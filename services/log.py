import logging
from datetime import datetime

# Configuração do logger
logger = logging.getLogger('app_logger')
logger.setLevel(logging.INFO)
file_handler = logging.FileHandler('access_log.txt')
file_handler.setLevel(logging.INFO)

formatter = logging.Formatter('%(asctime)s - %(message)s', datefmt='%d/%m/%Y %H:%M')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Log de login
def log_event(usuario):
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} entrou no sistema"
    logger.info(log_message)

# Log de logout (quando a sessão se encerra)
def log_logout(usuario):
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} saiu do sistema"
    logger.info(log_message)

# Log de pesquisa no estoque
def log_pesquisa(usuario, pesquisa, filtro):
    filtro_mapping = {
        'description': 'descricao',
        'code': 'codigo',
        'barcode': 'codigo de barras'
    }
    tipo = filtro_mapping.get(filtro, filtro)
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} pesquisou por {pesquisa} usando {tipo}"
    logger.info(log_message)

# Log de visualização de produto no estoque
def log_produto(usuario, id_produto):
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} olhou o produto {id_produto}"
    logger.info(log_message)

# Log de pesquisa de vendas
def log_venda_pesquisa(usuario, data_inicio, data_fim):
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} pesquisou por produtos vendidos no intervalo de {data_inicio} a {data_fim}"
    logger.info(log_message)

# Log de conferência de produto (atualização da data)
def log_conferencia(usuario, id_produto):
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} conferiu o produto {id_produto}"
    logger.info(log_message)

def log_entrega(usuario, pedido):
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} gerou uma entrega para o pedido {pedido}"
    logger.info(log_message)

def log_acesso_info_vendas(usuario):
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} acessou suas vendas"
    logger.info(log_message)

import datetime

def format_cnpj(cnpj):
    return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"

def log_search(user, cnpj, razao_social):
    formatted_cnpj = format_cnpj(cnpj)
    timestamp = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    log_entry = f"{timestamp} - {user} pesquisou pelo CNPJ {formatted_cnpj} de razao social {razao_social}\n"
    with open("log.txt", "a") as log_file:
        log_file.write(log_entry)

def log_update(user, cnpj):
    formatted_cnpj = format_cnpj(cnpj)
    timestamp = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    log_entry = f"{timestamp} - {user} atualizou dados do CNPJ {formatted_cnpj} em clientes\n"
    with open("log.txt", "a") as log_file:
        log_file.write(log_entry)

def formatar_cnpj(cnpj):
    """Formata o CNPJ no padrão 00.000.000/0000-00"""
    cnpj_numeros = ''.join(filter(str.isdigit, cnpj))
    if len(cnpj_numeros) == 14:
        return f"{cnpj_numeros[:2]}.{cnpj_numeros[2:5]}.{cnpj_numeros[5:8]}/{cnpj_numeros[8:12]}-{cnpj_numeros[12:]}"
    return cnpj

def log_consulta_cnpj(usuario, cnpj, razao_social=None):
    usuario_formatado = usuario.title()
    cnpj_formatado = formatar_cnpj(cnpj)
    if razao_social:
        log_message = f"{usuario_formatado} pesquisou pelo CNPJ {cnpj_formatado} de razao social {razao_social}"
    else:
        log_message = f"{usuario_formatado} pesquisou pelo CNPJ {cnpj_formatado}"
    logger.info(log_message)

def log_atualiza_cnpj(usuario, cnpj, tipo):
    usuario_formatado = usuario.title()
    cnpj_formatado = formatar_cnpj(cnpj)
    log_message = f"{usuario_formatado} atualizou dados do CNPJ {cnpj_formatado} em {tipo}"
    logger.info(log_message)

def log_pix_acesso(usuario):
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} acessou a pagina do pix"
    logger.info(log_message)

def log_pix_qr_gerado(usuario, pedido):
    usuario_formatado = usuario.title()
    log_message = f"{usuario_formatado} gerou um QR Code para o pedido {pedido}"
    logger.info(log_message)

def log_pix_pago(pedido, gerou_qr):
    log_message = f"O QR Code de pedido {pedido} gerado por {gerou_qr} foi pago"
    logger.info(log_message)

def log_pix_expirado(pedido, gerou_qr):
    log_message = f"O QR Code de pedido {pedido} gerado por {gerou_qr} foi expirado"
    logger.info(log_message)

def log_pix_cancelado(pedido, gerou_qr):
    log_message = f"O QR Code de pedido {pedido} gerado por {gerou_qr} foi cancelado"
    logger.info(log_message)
