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