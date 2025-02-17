import pyodbc
from .encryption import descriptografar_credenciais

credenciais = descriptografar_credenciais()

prefered_drivers = [
    'ODBC Driver 18 for SQL Server',
    'ODBC Driver 17 for SQL Server',
    'ODBC Driver 13 for SQL Server',
    'ODBC Driver 11 for SQL Server',
    'SQL Server' 
]

installed_drivers = pyodbc.drivers()

selected_driver = None
for driver in prefered_drivers:
    if driver in installed_drivers:
        selected_driver = driver
        break

if not selected_driver:
    raise Exception("Nenhum driver ODBC compatível encontrado. Verifique a instalação dos drivers ODBC para SQL Server.")

conn_str = (
    f'DRIVER={{{selected_driver}}};'
    f'SERVER={credenciais["server"]};'
    f'DATABASE={credenciais["database"]};'
    f'UID={credenciais["username"]};'
    f'PWD={credenciais["password"]};'
    f'TrustServerCertificate=yes'
)

def get_connection():
    return pyodbc.connect(conn_str)
