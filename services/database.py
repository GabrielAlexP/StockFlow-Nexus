import pyodbc
from .encryption import descriptografar_credenciais

credenciais = descriptografar_credenciais()

conn_str = (
    f'DRIVER={{ODBC Driver 17 for SQL Server}};'
    f'SERVER={credenciais["server"]};'
    f'DATABASE={credenciais["database"]};'
    f'UID={credenciais["username"]};'
    f'PWD={credenciais["password"]}'
)

def get_connection():
    return pyodbc.connect(conn_str)