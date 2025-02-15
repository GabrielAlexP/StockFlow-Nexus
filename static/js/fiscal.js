// fiscal.js - Código completo e corrigido

// ==================== VARIÁVEIS GLOBAIS ====================
let currentPerfilData = null;   // Armazena os dados brutos do PerfilFiscal
let currentPerfilPreview = null;
let currentEmpresaData = null;  // Armazena os dados brutos da Empresa
let currentEmpresaPreview = null;
let currentNCMData = null;      // Armazena os dados brutos do NCM
let currentNCMPreview = null;
let currentUFData = null;       // Armazena os dados brutos da UF
let currentUFPreview = null;

// ==================== FUNÇÕES DE INTERFACE ====================
function gerarCamposOrigens() {
    const container = document.getElementById('origens-container');
    container.innerHTML = '';
    const num = parseInt(document.getElementById('num_origens').value);

    if (isNaN(num) || num < 1) {
        alert('Informe um número válido de origens.');
        return;
    }

    for (let i = 0; i < num; i++) {
        const groupHTML = `
            <div class="origem-group">
                <h4>Origem ${i + 1}</h4>
                <div class="form-row">
                    <label>Origem:</label>
                    <input type="text">
                </div>
                <div class="form-row small-form-row">
                    <label>(Normal) IPI, PIS/Cofins, Trib:</label>
                    <div class="small-inline">
                        <input type="number" placeholder="IPI">
                        <input type="number" placeholder="PIS/Cofins">
                        <input type="number" placeholder="Trib">
                    </div>
                </div>
                <div class="form-row small-form-row">
                    <label>(Simples) IPI, PIS/Cofins, Trib:</label>
                    <div class="small-inline">
                        <input type="number" placeholder="IPI">
                        <input type="number" placeholder="PIS/Cofins">
                        <input type="number" placeholder="Trib">
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', groupHTML);
    }
}

// ==================== FUNÇÕES DE GERAÇÃO ====================
async function gerarPerfilFiscal() {
    const ncm = document.getElementById('ncm').value;
    const cfop = document.getElementById('cfop').value;
    const origens = [];

    // Coletar dados das origens
    document.querySelectorAll('.origem-group').forEach(group => {
        const inputs = group.querySelectorAll('input');
        origens.push({
            valor: inputs[0].value,
            normal: {
                ipi: inputs[1].value,
                pis_cofins: inputs[2].value,
                trib: inputs[3].value
            },
            simples: {
                ipi: inputs[4].value,
                pis_cofins: inputs[5].value,
                trib: inputs[6].value
            }
        });
    });

    try {
        const response = await fetch('/gerar-perfil', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ncm, cfop, origens })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        currentPerfilData = data.perfil;
        currentPerfilPreview = data.preview;
        document.getElementById('preview').innerHTML = data.preview;
    } catch (error) {
        alert('Erro ao gerar PerfilFiscal: ' + error.message);
    }
}

async function gerarPerfilFiscalEmpresa() {
    const empresa = document.getElementById('empresa').value;

    try {
        if (!currentPerfilData) throw new Error('Gere o PerfilFiscal primeiro');

        const response = await fetch('/gerar-empresa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                empresa: empresa,
                perfil: currentPerfilData
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        currentEmpresaData = data.empresa;
        currentEmpresaPreview = data.preview;
        document.getElementById('preview').innerHTML = data.preview;
    } catch (error) {
        alert('Erro ao gerar Empresa: ' + error.message);
    }
}

async function gerarPerfilFiscalNCM() {
    const ncm = document.getElementById('ncm').value;

    try {
        if (!currentPerfilData) throw new Error('Gere o PerfilFiscal primeiro');

        const response = await fetch('/gerar-ncm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ncm: ncm,
                perfil: currentPerfilData
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        currentNCMData = data.ncm;
        currentNCMPreview = data.preview;
        document.getElementById('preview').innerHTML = data.preview;
    } catch (error) {
        alert('Erro ao gerar NCM: ' + error.message);
    }
}

async function gerarPerfilFiscalUF() {
    const uf = document.getElementById('uf').value;

    try {
        if (!currentPerfilData) throw new Error('Gere o PerfilFiscal primeiro');

        const response = await fetch('/gerar-uf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uf: uf,
                perfil: currentPerfilData
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        currentUFData = data.uf;
        currentUFPreview = data.preview;
        document.getElementById('preview').innerHTML = data.preview;
    } catch (error) {
        alert('Erro ao gerar UF: ' + error.message);
    }
}

// ==================== FUNÇÕES DE VISUALIZAÇÃO ====================
function mostrarPreview(tabela) {
    try {
        switch (tabela) {
            case 'PerfilFiscal':
                if (!currentPerfilPreview) throw new Error('Gere o PerfilFiscal primeiro');
                document.getElementById('preview').innerHTML = currentPerfilPreview;
                break;

            case 'PerfilFiscal_Empresa':
                if (!currentEmpresaPreview) throw new Error('Gere a tabela Empresa primeiro');
                document.getElementById('preview').innerHTML = currentEmpresaPreview;
                break;

            case 'PerfilFiscal_NCM':
                if (!currentNCMPreview) throw new Error('Gere a tabela NCM primeiro');
                document.getElementById('preview').innerHTML = currentNCMPreview;
                break;

            case 'PerfilFiscal_UF':
                if (!currentUFPreview) throw new Error('Gere a tabela UF primeiro');
                document.getElementById('preview').innerHTML = currentUFPreview;
                break;
        }
    } catch (error) {
        alert(error.message);
    }
}

// ==================== FUNÇÕES DE BANCO DE DADOS ====================
async function inserirNoBanco() {
    // Exibe a confirmação
    if (!confirm("Deseja inserir estas informações no banco de dados?")) {
        return;
    }

    // Bloqueia o botão de inserção para evitar múltiplas requisições
    const btnInsert = document.getElementById("btnInserirDados");
    btnInsert.disabled = true;

    try {
        const dadosParaEnviar = {
            perfil: currentPerfilData,
            empresa: currentEmpresaData,
            ncm: currentNCMData,
            uf: currentUFData
        };

        const response = await fetch('/inserir-dados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosParaEnviar)
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        alert('Dados inseridos com sucesso!');
    } catch (error) {
        alert('Erro na inserção: ' + error.message);
    } finally {
        btnInsert.disabled = false;
    }
}

// ==================== FUNÇÕES AUXILIARES ====================
function apagarDados() {
    // Resetar todas as variáveis
    currentPerfilData = null;
    currentPerfilPreview = null;
    currentEmpresaData = null;
    currentEmpresaPreview = null;
    currentNCMData = null;
    currentNCMPreview = null;
    currentUFData = null;
    currentUFPreview = null;

    // Limpar interface
    document.getElementById('preview').innerHTML = 'Pré-visualização';
    document.querySelectorAll('input').forEach(input => input.value = '');
    document.getElementById('origens-container').innerHTML = '';
}

// ==================== CONFIGURAÇÃO DO DIVIDER ====================
const divider = document.getElementById('divider');
divider.addEventListener('mousedown', initResize);

function initResize(e) {
    e.preventDefault();
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResize);
}

function resize(e) {
    const preview = document.getElementById('preview');
    const newHeight = e.clientY - preview.getBoundingClientRect().top;
    preview.style.height = `${newHeight}px`;
}

function stopResize() {
    window.removeEventListener('mousemove', resize);
    window.removeEventListener('mouseup', stopResize);
}

document.addEventListener("DOMContentLoaded", function () {
    // Recupera os dados do usuário armazenados
    const usuarioData = sessionStorage.getItem("usuario");
    if (!usuarioData) {
        alert("Usuário não autenticado! Redirecionando para a página de login...");
        window.location.href = "/";
        return;
    }
    const usuario = JSON.parse(usuarioData);
    
    // Verifica se o campo Cargo está definido
    if (!usuario.Cargo || usuario.Cargo.trim() === "") {
        alert("Cargo não definido! Redirecionando para a página de login...");
        window.location.href = "/";
        return;
    }
    
    // Apenas administradores podem acessar esta página
    if (usuario.Cargo.trim().toLowerCase() !== "admin") {
        alert("Acesso restrito! Apenas administradores podem acessar esta página. Redirecionando para o portal...");
        window.location.href = "/portal";
        return;
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const menuIcon = document.getElementById("menu-icon");
    const nav = document.querySelector("nav");

    menuIcon.addEventListener("click", function () {
        nav.classList.toggle("active"); // Abre/fecha o menu ao clicar
    });

    // Fecha o menu se clicar fora dele
    document.addEventListener("click", function (event) {
        if (!nav.contains(event.target) && !menuIcon.contains(event.target)) {
            nav.classList.remove("active");
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const opcoesEstoque = document.getElementById('opcoesEstoque');
    const opcoesVendas = document.getElementById('opcoesVendas');
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));

    function verificarPermissaoEstoque() {
        if (!usuario) {
            alert('Usuário não autenticado!');
            return false;
        }
        const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
        const cargosPermitidos = ['admin', 'estoque'];
        if (!cargosPermitidos.includes(cargoNormalizado)) {
            alert('Você não tem permissão para acessar esta página!');
            return false;
        }
        return true;
    }

    function verificarPermissaoVendas() {
        if (!usuario) {
            alert('Usuário não autenticado!');
            return false;
        }
        const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
        const cargosPermitidosVendas = ['admin', 'vendedor', 'gerente', 'supervisor'];
        if (!cargosPermitidosVendas.includes(cargoNormalizado)) {
            alert('Você não tem permissão para acessar esta página!');
            return false;
        }
        return true;
    }

    function adicionarLinks(lista, links, verificarPermissao, outraLista) {
        outraLista.innerHTML = '';
        lista.innerHTML = '';
        if (!verificarPermissao()) return;

        // Adiciona o título da navegação
        lista.innerHTML = `<li class="nav-title">${lista.getAttribute("id").replace('opcoes', 'Opções de ')}</li>`;

        links.forEach(link => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="${link.url}">${link.icone} ${link.texto}</a>`;
            li.querySelector('a').addEventListener('click', function (e) {
                if (!verificarPermissao()) {
                    e.preventDefault();
                    lista.innerHTML = '';
                }
            });
            lista.appendChild(li);
        });
    }

    document.getElementById('estoqueLink').addEventListener('click', function (e) {
        e.preventDefault();
        adicionarLinks(opcoesEstoque, [
            { url: '/estoque', texto: 'Consulta de Estoque', icone: '📦' },
            { url: '/pedidos', texto: 'Status de Pedido', icone: '📜' }
        ], verificarPermissaoEstoque, opcoesVendas);
    });

    document.getElementById('vendasLink').addEventListener('click', function (e) {
        e.preventDefault();
        adicionarLinks(opcoesVendas, [
            { url: '/ranking', texto: 'Ranking de Vendas', icone: '📊' },
            { url: '/cnpj', texto: 'Consulta de CNPJ', icone: '🔎' }
        ], verificarPermissaoVendas, opcoesEstoque);
    });
});

document.addEventListener("DOMContentLoaded", function () {
    const homeIcon = document.getElementById("home-icon");
    const exitIcon = document.getElementById("exit-icon");

    // Redirecionamento para /portal ao clicar no ícone de home
    homeIcon.addEventListener("click", function () {
        window.location.href = "/portal";
    });

    // Redirecionamento para / e limpeza do sessionStorage ao clicar no ícone de saída
    exitIcon.addEventListener("click", function () {
        sessionStorage.clear();
        window.location.href = "/";
    });
});
