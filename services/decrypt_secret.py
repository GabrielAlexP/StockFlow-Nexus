import os
import json
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

def carregar_chave(caminho):
    with open(caminho, 'rb') as file:
        return file.read()

def descriptografar_secret_key():
    # Obtém o diretório do arquivo atual (services)
    dir_atual = os.path.dirname(os.path.abspath(__file__))
    
    # Constrói o caminho absoluto para os arquivos de chave na pasta "config"
    caminho_chave1 = os.path.join(dir_atual, os.pardir, 'config', 'chave1_ses.key')
    caminho_chave2 = os.path.join(dir_atual, os.pardir, 'config', 'chave2_ses.key')
    caminho_enc = os.path.join(dir_atual, os.pardir, 'config', 'secret_key.json.enc')
    
    chave1 = carregar_chave(caminho_chave1)
    chave2 = carregar_chave(caminho_chave2)
    
    with open(caminho_enc, 'rb') as file:
        iv1 = file.read(16)  # IV da primeira camada
        iv2 = file.read(16)  # IV da segunda camada
        dados_criptografados = file.read()
    
    # Primeira decriptação: camada 2
    cipher2 = AES.new(chave2, AES.MODE_CBC, iv=iv2)
    camada1 = cipher2.decrypt(dados_criptografados)
    
    # Segunda decriptação: camada 1
    cipher1 = AES.new(chave1, AES.MODE_CBC, iv=iv1)
    dados_decrypt = unpad(cipher1.decrypt(camada1), AES.block_size)
    
    return json.loads(dados_decrypt.decode())
