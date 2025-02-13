import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import pandas as pd
from datetime import datetime
import json
import pyodbc
from tabulate import tabulate

# ==================== FUNÇÃO DE FORMATAÇÃO CUSTOMIZADA ====================
def format_dataframe_custom(df, col_widths, default_width=10, tablefmt='psql'):
    """
    Formata as colunas do DataFrame de acordo com a largura máxima especificada em col_widths.
    Se uma coluna não estiver presente em col_widths, usa default_width.
    Se o valor exceder a largura, ele é truncado e termina com "..."
    """
    def format_cell(cell, width):
        cell_str = str(cell).strip()
        if len(cell_str) > width:
            if width > 3:
                return cell_str[:width-3] + '...'
            else:
                return cell_str[:width]
        else:
            return cell_str.ljust(width)

    df_formatted = df.copy()
    for col in df_formatted.columns:
        width = col_widths.get(col, default_width)
        df_formatted[col] = df_formatted[col].astype(str).apply(lambda x: format_cell(x, width))
    return tabulate(df_formatted, headers='keys', tablefmt=tablefmt, showindex=False)

# ==================== FUNÇÃO PARA OBTER O ÚLTIMO ID NO BANCO ====================
def get_last_id(tabela):
    """
    Busca no banco o maior ID da tabela informada.
    Se nenhum registro for encontrado, retorna 0.
    """
    try:
        with open("credenciais.json", "r") as f:
            cred = json.load(f)
    except Exception as e:
        messagebox.showerror("Erro", f"Erro ao ler o arquivo 'credenciais.json': {e}")
        return None

    conn_str = (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        f"SERVER={cred.get('server')};"
        f"DATABASE={cred.get('database')};"
        f"UID={cred.get('username')};"
        f"PWD={cred.get('password')}"
    )

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
        query = f"SELECT MAX(ID) FROM dbo.{tabela}"
        cursor.execute(query)
        result = cursor.fetchone()
        last_id = result[0] if result[0] is not None else 0
        cursor.close()
        conn.close()
        return last_id
    except Exception as e:
        messagebox.showerror("Erro", f"Erro ao buscar último ID da tabela {tabela}: {e}")
        return None

# ==================== FUNÇÕES DE NEGÓCIO (LÓGICA ORIGINAL) ====================
def gerar_registros(ultimo_id, ncm, cfop, origens, codigos):
    registros = []
    carac_trib = {2: "A", 1: "D", 8: "PF", 7: "PJ", 3: "V"}
    map_finalidade = {0: 'R', 1: 'I', 2: 'U'}
    data_atual = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    usuario = 124  # Valor fixo conforme solicitado

    current_id = ultimo_id + 1 

    for ct_code in [2, 1, 8, 7, 3]:
        for finalidade in [0, 1, 2]:
            for simples in [False, True]:
                for origem in origens:
                    regime = 'simples' if simples else 'normal'
                    cod_regime = codigos[origem][regime]
                    desc = f"{ncm} - {carac_trib[ct_code]} {map_finalidade[finalidade]} {'S' if simples else ''} {origem} {cfop}"
                    registros.append([
                        current_id,
                        desc,
                        cfop,
                        ct_code,
                        finalidade,
                        origem,
                        cod_regime['ipi'],
                        cod_regime['pis_cofins'],
                        cod_regime['trib'],
                        data_atual,
                        usuario,
                        1 if simples else 0
                    ])
                    current_id += 1  

    return registros

def exibir_resultados(registros):
    df = pd.DataFrame(registros, columns=[
        'Id', 'Descricao', 'Cfop', 'CaracTributacao', 'Finalidade',
        'Origem', 'RegraIpi', 'RegraPisCofins', 'RegraTrib',
        'DataAlteracao', 'UsuarioAlteracao', 'SimplesNacional'
    ])
    
    col_widths = {
        'Id': 6,
        'Descricao': 50,
        'Cfop': 6,
        'CaracTributacao': 6,
        'Finalidade': 10,
        'Origem': 10,
        'RegraIpi': 8,
        'RegraPisCofins': 8,
        'RegraTrib': 8,
        'DataAlteracao': 19,
        'UsuarioAlteracao': 6,
        'SimplesNacional': 6
    }
    
    preview = "\n" + "="*80 + "\n"
    preview += "PRÉ-VISUALIZAÇÃO DA TABELA PerfilFiscal\n"
    preview += "="*80 + "\n"
    preview += format_dataframe_custom(df, col_widths, default_width=10, tablefmt='psql')
    return df, preview

def gerar_registros_empresa(df_perfil, ultimo_id_empresa, empresa):
    registros = []
    current_id = ultimo_id_empresa + 1
    for id_perfil in df_perfil['Id']:
        registros.append([current_id, empresa, id_perfil])
        current_id += 1
    
    df_empresa = pd.DataFrame(registros, columns=["Id", "IDEmpresa", "IdPerfil"])
    return df_empresa

def exibir_resultados_empresa(df_empresa):
    preview = "\n" + "="*80 + "\n"
    preview += "PRÉ-VISUALIZAÇÃO DA TABELA PerfilFiscal_Empresa\n"
    preview += "="*80 + "\n"
    preview += tabulate(df_empresa, headers='keys', tablefmt='psql', showindex=False)
    return preview

def gerar_registros_ncm(df_perfil, ultimo_id_ncm, ncm_valor):
    registros = []
    current_id = ultimo_id_ncm + 1
    for id_perfil in df_perfil['Id']:
        registros.append([current_id, ncm_valor, id_perfil])
        current_id += 1
    df_ncm = pd.DataFrame(registros, columns=["Id", "NCM", "IdPerfil"])
    return df_ncm

def exibir_resultados_ncm(df_ncm):
    preview = "\n" + "="*80 + "\n"
    preview += "PRÉ-VISUALIZAÇÃO DA TABELA PerfilFiscal_NCM\n"
    preview += "="*80 + "\n"
    preview += tabulate(df_ncm, headers='keys', tablefmt='psql', showindex=False)
    return preview

def gerar_registros_uf(df_perfil, ultimo_id_uf, uf):
    registros = []
    current_id = ultimo_id_uf + 1
    for id_perfil in df_perfil['Id']:
        registros.append([current_id, uf, id_perfil])
        current_id += 1
    df_uf = pd.DataFrame(registros, columns=["Id", "UF", "IdPerfil"])
    return df_uf

def exibir_resultados_uf(df_uf):
    preview = "\n" + "="*80 + "\n"
    preview += "PRÉ-VISUALIZAÇÃO DA TABELA PerfilFiscal_UF\n"
    preview += "="*80 + "\n"
    preview += tabulate(df_uf, headers='keys', tablefmt='psql', showindex=False)
    return preview

def inserir_no_banco(df, tabela, insert_query):
    try:
        with open("credenciais.json", "r") as f:
            cred = json.load(f)
    except Exception as e:
        messagebox.showerror("Erro", f"Erro ao ler o arquivo 'credenciais.json': {e}")
        return

    conn_str = (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        f"SERVER={cred.get('server')};"
        f"DATABASE={cred.get('database')};"
        f"UID={cred.get('username')};"
        f"PWD={cred.get('password')}"
    )

    try:
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()
    except Exception as e:
        messagebox.showerror("Erro", f"Erro ao conectar no banco de dados: {e}")
        return

    try:
        cursor.execute(f"SET IDENTITY_INSERT dbo.{tabela} ON")
        conn.commit()

        for index, row in df.iterrows():
            if tabela == "PerfilFiscal":
                valores = (
                    int(row['Id']),
                    row['Descricao'],
                    row['Cfop'],
                    int(row['CaracTributacao']),
                    int(row['Finalidade']),
                    row['Origem'],
                    int(row['RegraIpi']),
                    int(row['RegraPisCofins']),
                    int(row['RegraTrib']),
                    row['DataAlteracao'],
                    int(row['UsuarioAlteracao']),
                    int(row['SimplesNacional'])
                )
            elif tabela == "PerfilFiscal_Empresa":
                valores = (
                    int(row['Id']),
                    row['IDEmpresa'],
                    int(row['IdPerfil'])
                )
            elif tabela == "PerfilFiscal_NCM":
                valores = (
                    int(row['Id']),
                    row['NCM'],
                    int(row['IdPerfil'])
                )
            elif tabela == "PerfilFiscal_UF":
                valores = (
                    int(row['Id']),
                    row['UF'],
                    int(row['IdPerfil'])
                )
            cursor.execute(insert_query, valores)

        conn.commit()
        messagebox.showinfo("Sucesso", f"Dados inseridos com sucesso na tabela dbo.{tabela}!")
    except Exception as e:
        conn.rollback()
        messagebox.showerror("Erro", f"Erro durante a inserção dos dados em {tabela}: {e}")
    finally:
        try:
            cursor.execute(f"SET IDENTITY_INSERT dbo.{tabela} OFF")
            conn.commit()
        except Exception as ex:
            messagebox.showerror("Erro", f"Erro ao desabilitar o IDENTITY_INSERT em {tabela}: {ex}")
        cursor.close()
        conn.close()

# ==================== INTERFACE GRÁFICA ====================
class App:
    def __init__(self, root):
        self.root = root
        self.root.title("Interface para Cadastro e Pré-visualização das Tabelas")
        # Inicia em modo fullscreen (no Windows, usa state("zoomed"))
        self.root.state("zoomed")
        
        self.style = ttk.Style()
        self.style.theme_use('clam')
        # Configurações gerais
        self.style.configure('TFrame', background='#222222')
        self.style.configure('TLabel', background='#222222', foreground='white')
        self.style.configure('TLabelframe', background='#222222', foreground='white')
        self.style.configure('TLabelframe.Label', background='#222222', foreground='white')
        self.style.configure('TEntry', fieldbackground='#333333', foreground='white', padding=5)
        self.style.configure('Vertical.TScrollbar', background='#333333')

        self.style.configure('Rounded.TButton', padding=10, relief="flat", borderwidth=0, background='#006400', foreground='white')
        self.style.map('Rounded.TButton', background=[('active', '#008000')])
        
        # Variáveis para armazenar os DataFrames gerados
        self.df_perfil = None
        self.df_empresa = None
        self.df_ncm = None
        self.df_uf = None

        # ----------------- Área de Pré-visualização (botões no topo e área de texto) -----------------
        top_frame = ttk.Frame(root)
        top_frame.pack(fill='x', padx=5, pady=5)
        self.btn_preview_perfil = ttk.Button(top_frame, text="PerfilFiscal", style='Rounded.TButton', command=self.mostrar_perfil)
        self.btn_preview_perfil.pack(side='left', padx=5)
        self.btn_preview_empresa = ttk.Button(top_frame, text="PerfilFiscal_Empresa", style='Rounded.TButton', command=self.mostrar_empresa)
        self.btn_preview_empresa.pack(side='left', padx=5)
        self.btn_preview_ncm = ttk.Button(top_frame, text="PerfilFiscal_NCM", style='Rounded.TButton', command=self.mostrar_ncm)
        self.btn_preview_ncm.pack(side='left', padx=5)
        self.btn_preview_uf = ttk.Button(top_frame, text="PerfilFiscal_UF", style='Rounded.TButton', command=self.mostrar_uf)
        self.btn_preview_uf.pack(side='left', padx=5)

        self.txt_preview_global = scrolledtext.ScrolledText(root, height=15, font=('Courier', 10), background='#333333', foreground='white')
        self.txt_preview_global.pack(fill='both', padx=5, pady=5, expand=True)

        # ----------------- PanedWindow vertical para separar pré-visualização e inputs -----------------
        self.main_paned = ttk.PanedWindow(root, orient=tk.VERTICAL)
        self.main_paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.input_frame = ttk.Frame(self.main_paned)
        self.main_paned.add(self.input_frame, weight=1)

        # ----------------- PanedWindow horizontal para os 4 inputs lado a lado -----------------
        self.paned = ttk.PanedWindow(self.input_frame, orient=tk.HORIZONTAL)
        self.paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.frame_perfil = ttk.Labelframe(self.paned, text="PerfilFiscal", padding=5)
        self.frame_empresa = ttk.Labelframe(self.paned, text="PerfilFiscal_Empresa", padding=5)
        self.frame_ncm = ttk.Labelframe(self.paned, text="PerfilFiscal_NCM", padding=5)
        self.frame_uf = ttk.Labelframe(self.paned, text="PerfilFiscal_UF", padding=5)

        self.paned.add(self.frame_perfil, weight=1)
        self.paned.add(self.frame_empresa, weight=1)
        self.paned.add(self.frame_ncm, weight=1)
        self.paned.add(self.frame_uf, weight=1)

        self.criar_inputs_perfil()
        self.criar_inputs_empresa()
        self.criar_inputs_ncm()
        self.criar_inputs_uf()

        # ----------------- Área Inferior para os botões "Limpar dados" e "Inserir Registros" -----------------
        bottom_frame = ttk.Frame(root)
        bottom_frame.pack(fill='x', padx=5, pady=5)

        bottom_frame.columnconfigure(0, weight=0)
        bottom_frame.columnconfigure(1, weight=1)
        bottom_frame.columnconfigure(2, weight=0)
        self.btn_limpar = ttk.Button(bottom_frame, text="Limpar dados", style='Rounded.TButton', command=self.limpar_dados)
        self.btn_limpar.grid(row=0, column=0, sticky="w", padx=5)
        self.btn_insert = ttk.Button(bottom_frame, text="Inserir Registros no Banco", style='Rounded.TButton', command=self.inserir_registros)
        self.btn_insert.grid(row=0, column=1, padx=5)

        spacer = ttk.Label(bottom_frame, text="", background='#222222')
        spacer.grid(row=0, column=2, sticky="e", padx=5)

    # ---------- Método para limpar todos os dados ----------
    def limpar_dados(self):
        self.entry_ncm.delete(0, tk.END)
        self.entry_cfop.delete(0, tk.END)
        self.entry_num_origens.delete(0, tk.END)
        for widget in self.frame_origens.winfo_children():
            widget.destroy()
        self.origem_widgets = []
        self.entry_empresa.delete(0, tk.END)

        self.entry_uf.delete(0, tk.END)

        self.df_perfil = None
        self.df_empresa = None
        self.df_ncm = None
        self.df_uf = None

        self.txt_preview_global.delete("1.0", tk.END)
        messagebox.showinfo("Limpar dados", "Todos os dados foram limpos!")

    # ---------- Seção PerfilFiscal (dados para preenchimento) ----------
    def criar_inputs_perfil(self):
        frame = self.frame_perfil

        ttk.Label(frame, text="NCM do produto:").grid(row=0, column=0, sticky='w', padx=5, pady=2)
        self.entry_ncm = ttk.Entry(frame, width=20)
        self.entry_ncm.grid(row=0, column=1, padx=5, pady=2)

        ttk.Label(frame, text="CFOP:").grid(row=1, column=0, sticky='w', padx=5, pady=2)
        self.entry_cfop = ttk.Entry(frame, width=10)
        self.entry_cfop.grid(row=1, column=1, padx=5, pady=2)

        ttk.Label(frame, text="Número de Origens:").grid(row=2, column=0, sticky='w', padx=5, pady=2)
        self.entry_num_origens = ttk.Entry(frame, width=5)
        self.entry_num_origens.grid(row=2, column=1, padx=5, pady=2)

        self.btn_criar_origens = ttk.Button(frame, text="Gerar campos de Origens", style='Rounded.TButton', command=self.gerar_campos_origens)
        self.btn_criar_origens.grid(row=2, column=2, padx=5, pady=2)

        self.frame_origens = ttk.Frame(frame)
        self.frame_origens.grid(row=3, column=0, columnspan=3, sticky='w', padx=5, pady=5)

        self.btn_gerar_perfil = ttk.Button(frame, text="Gerar PerfilFiscal", style='Rounded.TButton', command=self.gerar_perfil)
        self.btn_gerar_perfil.grid(row=4, column=0, columnspan=3, pady=5)

    def gerar_campos_origens(self):
        """Gera dinamicamente os campos para inserção das origens e seus códigos."""

        for widget in self.frame_origens.winfo_children():
            widget.destroy()
        try:
            num = int(self.entry_num_origens.get())
        except ValueError:
            messagebox.showerror("Erro", "Informe um número inteiro para 'Número de Origens'")
            return

        self.origem_widgets = [] 
        for i in range(num):
            origem_dict = {}
            base_row = i * 3  

            ttk.Label(self.frame_origens, text=f"Origem {i+1}:").grid(row=base_row, column=0, sticky='w', padx=5, pady=2)
            origem_entry = ttk.Entry(self.frame_origens, width=15)
            origem_entry.grid(row=base_row, column=1, padx=5, pady=2)
            origem_dict['origem'] = origem_entry

            ttk.Label(self.frame_origens, text="(Normal) IPI, PIS/Cofins, Trib:").grid(row=base_row+1, column=0, sticky='w', padx=5, pady=2)
            normal_frame = ttk.Frame(self.frame_origens)
            normal_frame.grid(row=base_row+1, column=1, padx=5, pady=2)
            normal_ipi = ttk.Entry(normal_frame, width=5)
            normal_ipi.grid(row=0, column=0, padx=2)
            normal_pis = ttk.Entry(normal_frame, width=5)
            normal_pis.grid(row=0, column=1, padx=2)
            normal_trib = ttk.Entry(normal_frame, width=5)
            normal_trib.grid(row=0, column=2, padx=2)
            origem_dict['normal'] = {'ipi': normal_ipi, 'pis_cofins': normal_pis, 'trib': normal_trib}

            ttk.Label(self.frame_origens, text="(Simples) IPI, PIS/Cofins, Trib:").grid(row=base_row+2, column=0, sticky='w', padx=5, pady=2)
            simples_frame = ttk.Frame(self.frame_origens)
            simples_frame.grid(row=base_row+2, column=1, padx=5, pady=2)
            simples_ipi = ttk.Entry(simples_frame, width=5)
            simples_ipi.grid(row=0, column=0, padx=2)
            simples_pis = ttk.Entry(simples_frame, width=5)
            simples_pis.grid(row=0, column=1, padx=2)
            simples_trib = ttk.Entry(simples_frame, width=5)
            simples_trib.grid(row=0, column=2, padx=2)
            origem_dict['simples'] = {'ipi': simples_ipi, 'pis_cofins': simples_pis, 'trib': simples_trib}

            self.origem_widgets.append(origem_dict)

    def gerar_perfil(self):
        """Coleta os dados da seção PerfilFiscal, gera os registros e armazena o DataFrame."""
        ncm = self.entry_ncm.get().strip()
        cfop = self.entry_cfop.get().strip()
        if not ncm or not cfop:
            messagebox.showerror("Erro", "Informe NCM e CFOP.")
            return

        origens = []
        codigos = {}
        for origem_dict in self.origem_widgets:
            origem_val = origem_dict['origem'].get().strip()
            if not origem_val:
                messagebox.showerror("Erro", "Informe o valor de cada Origem.")
                return
            if origem_val in origens:
                messagebox.showerror("Erro", f"Origem '{origem_val}' repetida!")
                return
            origens.append(origem_val)
            try:
                normal_ipi = int(origem_dict['normal']['ipi'].get())
                normal_pis = int(origem_dict['normal']['pis_cofins'].get())
                normal_trib = int(origem_dict['normal']['trib'].get())
                simples_ipi = int(origem_dict['simples']['ipi'].get())
                simples_pis = int(origem_dict['simples']['pis_cofins'].get())
                simples_trib = int(origem_dict['simples']['trib'].get())
            except ValueError:
                messagebox.showerror("Erro", f"Os códigos para a origem '{origem_val}' devem ser números inteiros.")
                return
            codigos[origem_val] = {
                'normal': {'ipi': normal_ipi, 'pis_cofins': normal_pis, 'trib': normal_trib},
                'simples': {'ipi': simples_ipi, 'pis_cofins': simples_pis, 'trib': simples_trib}
            }

        ultimo_id = get_last_id("PerfilFiscal")
        if ultimo_id is None:
            return

        registros = gerar_registros(ultimo_id, ncm, cfop, origens, codigos)
        self.df_perfil, _ = exibir_resultados(registros)
        messagebox.showinfo("Sucesso", "Tabela PerfilFiscal gerada com sucesso!")

    # ---------- Seção PerfilFiscal_Empresa (dados para preenchimento) ----------
    def criar_inputs_empresa(self):
        frame = self.frame_empresa
        ttk.Label(frame, text="Empresa:").grid(row=0, column=0, sticky='w', padx=5, pady=2)
        self.entry_empresa = ttk.Entry(frame, width=20)
        self.entry_empresa.grid(row=0, column=1, padx=5, pady=2)
        self.btn_gerar_empresa = ttk.Button(frame, text="Gerar PerfilFiscal_Empresa", style='Rounded.TButton', command=self.gerar_empresa)
        self.btn_gerar_empresa.grid(row=1, column=0, columnspan=2, pady=5)

    def gerar_empresa(self):
        """Gera PerfilFiscal_Empresa a partir do DF PerfilFiscal já gerado."""
        if self.df_perfil is None:
            messagebox.showerror("Erro", "Gere primeiro a tabela PerfilFiscal.")
            return

        ultimo_id_empresa = get_last_id("PerfilFiscal_Empresa")
        if ultimo_id_empresa is None:
            return
        empresa = self.entry_empresa.get().strip()
        if not empresa:
            messagebox.showerror("Erro", "Informe a Empresa.")
            return
        self.df_empresa = gerar_registros_empresa(self.df_perfil, ultimo_id_empresa, empresa)
        messagebox.showinfo("Sucesso", "Tabela PerfilFiscal_Empresa gerada com sucesso!")

    # ---------- Seção PerfilFiscal_NCM (dados para preenchimento) ----------
    def criar_inputs_ncm(self):
        frame = self.frame_ncm

        self.btn_gerar_ncm = ttk.Button(frame, text="Gerar PerfilFiscal_NCM", style='Rounded.TButton', command=self.gerar_ncm)
        self.btn_gerar_ncm.grid(row=0, column=0, columnspan=2, pady=5)

    def gerar_ncm(self):
        """Gera PerfilFiscal_NCM a partir do DF PerfilFiscal já gerado."""
        if self.df_perfil is None:
            messagebox.showerror("Erro", "Gere primeiro a tabela PerfilFiscal.")
            return

        ultimo_id_ncm = get_last_id("PerfilFiscal_NCM")
        if ultimo_id_ncm is None:
            return

        ncm = self.entry_ncm.get().strip()
        if not ncm:
            messagebox.showerror("Erro", "NCM não informado na seção PerfilFiscal.")
            return
        self.df_ncm = gerar_registros_ncm(self.df_perfil, ultimo_id_ncm, ncm)
        messagebox.showinfo("Sucesso", "Tabela PerfilFiscal_NCM gerada com sucesso!")

    # ---------- Seção PerfilFiscal_UF (dados para preenchimento) ----------
    def criar_inputs_uf(self):
        frame = self.frame_uf
        ttk.Label(frame, text="UF:").grid(row=0, column=0, sticky='w', padx=5, pady=2)
        self.entry_uf = ttk.Entry(frame, width=5)
        self.entry_uf.grid(row=0, column=1, padx=5, pady=2)
        self.btn_gerar_uf = ttk.Button(frame, text="Gerar PerfilFiscal_UF", style='Rounded.TButton', command=self.gerar_uf)
        self.btn_gerar_uf.grid(row=1, column=0, columnspan=2, pady=5)

    def gerar_uf(self):
        """Gera PerfilFiscal_UF a partir do DF PerfilFiscal já gerado."""
        if self.df_perfil is None:
            messagebox.showerror("Erro", "Gere primeiro a tabela PerfilFiscal.")
            return
        ultimo_id_uf = get_last_id("PerfilFiscal_UF")
        if ultimo_id_uf is None:
            return
        uf = self.entry_uf.get().strip().upper()
        if not uf:
            messagebox.showerror("Erro", "Informe a UF.")
            return
        self.df_uf = gerar_registros_uf(self.df_perfil, ultimo_id_uf, uf)
        messagebox.showinfo("Sucesso", "Tabela PerfilFiscal_UF gerada com sucesso!")

    # ---------- Botões de Pré-visualização (exibem o conteúdo dos DataFrames na área global) ----------
    def mostrar_perfil(self):
        if self.df_perfil is None:
            messagebox.showerror("Erro", "Tabela PerfilFiscal não gerada.")
        else:
            _, preview = exibir_resultados(self.df_perfil)
            self.txt_preview_global.delete("1.0", tk.END)
            self.txt_preview_global.insert(tk.END, preview)

    def mostrar_empresa(self):
        if self.df_empresa is None:
            messagebox.showerror("Erro", "Tabela PerfilFiscal_Empresa não gerada.")
        else:
            preview = exibir_resultados_empresa(self.df_empresa)
            self.txt_preview_global.delete("1.0", tk.END)
            self.txt_preview_global.insert(tk.END, preview)

    def mostrar_ncm(self):
        if self.df_ncm is None:
            messagebox.showerror("Erro", "Tabela PerfilFiscal_NCM não gerada.")
        else:
            preview = exibir_resultados_ncm(self.df_ncm)
            self.txt_preview_global.delete("1.0", tk.END)
            self.txt_preview_global.insert(tk.END, preview)

    def mostrar_uf(self):
        if self.df_uf is None:
            messagebox.showerror("Erro", "Tabela PerfilFiscal_UF não gerada.")
        else:
            preview = exibir_resultados_uf(self.df_uf)
            self.txt_preview_global.delete("1.0", tk.END)
            self.txt_preview_global.insert(tk.END, preview)

    # ---------- Inserção Global no Banco ----------
    def inserir_registros(self):
        """Confirma com o usuário e insere os registros no banco para as quatro tabelas."""
        if messagebox.askyesno("Confirmação", "Deseja inserir os registros no banco de dados?"):
            if self.df_perfil is not None:
                inserir_no_banco(self.df_perfil, "PerfilFiscal", 
                    """INSERT INTO dbo.PerfilFiscal
                       (Id, Descricao, Cfop, CaracTributacao, Finalidade, Origem, RegraIpi, RegraPisCofins, RegraTrib, DataAlteracao, UsuarioAlteracao, SimplesNacional)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""")
            if self.df_empresa is not None:
                inserir_no_banco(self.df_empresa, "PerfilFiscal_Empresa", 
                    """INSERT INTO dbo.PerfilFiscal_Empresa
                       (Id, IDEmpresa, IdPerfil)
                       VALUES (?,?,?)""")
            if self.df_ncm is not None:
                inserir_no_banco(self.df_ncm, "PerfilFiscal_NCM", 
                    """INSERT INTO dbo.PerfilFiscal_NCM
                       (Id, NCM, IdPerfil)
                       VALUES (?,?,?)""")
            if self.df_uf is not None:
                inserir_no_banco(self.df_uf, "PerfilFiscal_UF", 
                    """INSERT INTO dbo.PerfilFiscal_UF
                       (Id, UF, IdPerfil)
                       VALUES (?,?,?)""")
        else:
            messagebox.showinfo("Cancelado", "Operação de inserção cancelada.")

if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()
