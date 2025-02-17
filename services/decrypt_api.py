from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import json

def carregar_chave(caminho):
    with open(caminho, 'rb') as file:
        return file.read()

def descriptografar_api():
    chave1 = carregar_chave('config/chaveapi1.key')
    chave2 = carregar_chave('config/chaveapi2.key')
    
    with open('config/api.json.enc', 'rb') as file:
        iv1 = file.read(16)
        iv2 = file.read(16)
        dados_criptografados = file.read()
    
    cipher1 = AES.new(chave1, AES.MODE_CBC, iv=iv1)
    cipher2 = AES.new(chave2, AES.MODE_CBC, iv=iv2)
    
    dados_decrypt = unpad(cipher1.decrypt(cipher2.decrypt(dados_criptografados)), AES.block_size)
    return json.loads(dados_decrypt.decode())
