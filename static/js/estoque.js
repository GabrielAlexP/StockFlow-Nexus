async function carregarEmpresas() {
    try {
        const response = await fetch('/api/empresas');
        if (!response.ok) throw new Error('Erro ao carregar empresas');
        const empresas = await response.json();
        const select = document.getElementById('empresa-select');
        select.innerHTML = '<option value="">Empresas:</option>';

        empresas.forEach(empresa => {
            const option = document.createElement('option');
            option.value = empresa.IDEmpresa;  
            option.textContent = `${empresa.IDEmpresa}`;
            select.appendChild(option);
        });
    } catch (error) {
        alert('Erro ao carregar a lista de empresas.');
    }
}
document.addEventListener('DOMContentLoaded', carregarEmpresas);
document.getElementById('empresa-select').addEventListener('change', function() {
    const select = document.getElementById('empresa-select');
    if (select.value === "") {
        select.classList.remove('reduzido');
        select.classList.add('expandido');
    } else {
        select.classList.remove('expandido');
        select.classList.add('reduzido');
    }
});

async function carregarMarcas() {
    const marcaSelect = document.getElementById('marca');
    try {
        const response = await fetch('/api/marcas');
        if (!response.ok) throw new Error('Erro ao carregar marcas');
        const marcas = await response.json();

        marcaSelect.innerHTML = '<option value="all">Marca:</option>';  
        marcas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca.Codigo;
            option.textContent = marca.Descricao;
            marcaSelect.appendChild(option);
        });
    } catch (error) {
        alert('Erro ao carregar as marcas');
    }
}

async function buscarInformacoes() {
const searchContainer = document.getElementById('search-container');
const resultados = document.getElementById('resultados');
const buscandoTexto = document.getElementById('buscando-texto');
const listaResultados = document.getElementById('lista-resultados');
const filtroElement = document.querySelector('input[name="filter"]:checked');
if (!filtroElement) {
alert("Por favor, selecione um filtro.");
return;
}
const filtro = filtroElement.value;
const ativos = document.getElementById('ativos').value; 
const marca = document.getElementById('marca').value; 
const valor = document.getElementById('search-input').value;
const empresaId = document.getElementById('empresa-select').value;
buscandoTexto.style.display = 'block';

let url = `/api/consulta?filtro=${filtro}&valor=${valor}&ativos=${ativos}&marca=${marca}`; 
if (empresaId && empresaId !== "null") {
url += `&empresaId=${empresaId}`; 
}

try {
const response = await fetch(url);
if (!response.ok) throw new Error('Erro ao buscar informações');
const data = await response.json();
listaResultados.innerHTML = '';
data.forEach(item => {
    const div = document.createElement('div');
    div.classList.add('resultado-item');
    div.innerHTML = `
        <p><strong>Nome:</strong> ${item.DescProduto}</p>
        <p><strong>Código:</strong> ${item.ID}</p>
    `;
    div.onclick = () => mostrarDetalhes(item, empresaId);
    listaResultados.appendChild(div);
});
setTimeout(() => {
    resultados.classList.add('show');
}, 300);
} catch (error) {
alert('Erro ao buscar informações');
}
}

async function carregarMarcas() {
const marcaSelect = document.getElementById('marca');
try {
const response = await fetch('/api/marcas');
if (!response.ok) throw new Error('Erro ao carregar marcas');
const marcas = await response.json();

marcaSelect.innerHTML = '<option value="all">Marca:</option>';  
marcas.forEach(marca => {
    const option = document.createElement('option');
    option.value = marca.Codigo;
    option.textContent = marca.Descricao;
    marcaSelect.appendChild(option);
});
} catch (error) {
alert('Erro ao carregar as marcas');
}
}

async function buscarInformacoes() {
const searchContainer = document.getElementById('search-container');
const resultados = document.getElementById('resultados');
const buscandoTexto = document.getElementById('buscando-texto');
const listaResultados = document.getElementById('lista-resultados');
const filtroElement = document.querySelector('input[name="filter"]:checked');
if (!filtroElement) {
alert("Por favor, selecione um filtro.");
return;
}
const filtro = filtroElement.value;
const ativos = document.getElementById('ativos').value;
const marca = document.getElementById('marca').value; 
const valor = document.getElementById('search-input').value;
const empresaId = document.getElementById('empresa-select').value;
buscandoTexto.style.display = 'block';

let url = `/api/consulta?filtro=${filtro}&valor=${valor}&ativos=${ativos}&marca=${marca}`;
if (empresaId && empresaId !== "null") {
url += `&empresaId=${empresaId}`; 
}

try {
const response = await fetch(url);
if (!response.ok) throw new Error('Erro ao buscar informações');
const data = await response.json();
listaResultados.innerHTML = '';
data.forEach(item => {
    const div = document.createElement('div');
    div.classList.add('resultado-item');
    div.innerHTML = `
        <p><strong>Nome:</strong> ${item.DescProduto}</p>
        <p><strong>Código:</strong> ${item.ID}</p>
    `;
    div.onclick = () => mostrarDetalhes(item, empresaId);
    listaResultados.appendChild(div);
});
setTimeout(() => {
    resultados.classList.add('show');
}, 300);
} catch (error) {
alert('Erro ao buscar informações');
}
}

document.getElementById('search-input').addEventListener('keypress', function(event) {
if (event.key === 'Enter') {
buscarInformacoes();
}
});

window.onload = carregarMarcas;

document.getElementById('search-input').addEventListener('keypress', function(event) {
if (event.key === 'Enter') {
buscarInformacoes();
}
});


async function mostrarDetalhes(item, empresaId) {
    const resultados = document.getElementById('resultados');
    const detalhes = document.getElementById('detalhes');
    const detalhesConteudo = document.getElementById('detalhes-conteudo');
    const sistemaBox = document.getElementById('sistema-info');
    const paraEntregarBox = document.getElementById('para-entregar');
    const fisicoBox = document.getElementById('fisico');
    const tabelaPedidos = document.getElementById('tabela-pedidos').getElementsByTagName('tbody')[0];
    const pedidosNaoEntreguesBox = document.getElementById('pedidos-nao-entregues');
    resultados.style.display = 'none';
    detalhes.style.display = 'none';
    const formatarNumero = valor => {
        if (typeof valor === 'string') {
            valor = parseFloat(valor);
        }
        if (typeof valor === 'number' && !isNaN(valor)) {
            if (Number.isInteger(valor)) {
                return valor.toString();
            } else {
                return valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
            }
        }
        return '0';
    };
    const exibirData = (data) => {
        if (!data) return 'Data inválida';
        const date = new Date(data);
        if (isNaN(date)) {
            return 'Data inválida';
        }
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = date.getFullYear();
        return `${dia}/${mes}/${ano}`;
    };
    const exibirDataUltimoInventario = (data) => {
        if (!data) return 'Data inválida';
        if (data.includes('/')) {
            const partes = data.split('/');
            if (partes.length === 3) {
                const [dia, mes, ano] = partes;
                return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
            }
        }
        if (data.includes('-')) {
            const partes = data.split('-');
            if (partes.length === 3) {
                const [ano, mes, dia] = partes;
                return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
            }
        }
        return 'Data inválida';
    };
    detalhesConteudo.innerHTML = `
        <p><strong>Código:</strong> ${item.ID}</p>
        <p><strong>Descrição:</strong> ${item.DescProduto}</p>
        <p><strong>Código de Barras:</strong> ${item.CodBarra}</p>
    `;
    let estoqueAtual = 0;
    let ativo = false;
    let dataUltimaConferencia = '';
    try {
        const response = await fetch(`/api/detalhes?id=${item.ID}&empresaId=${empresaId}`);
        if (!response.ok) throw new Error('Erro ao buscar detalhes do produto');
        const data = await response.json();
        estoqueAtual = parseFloat(data.EstAtual || 0);
        ativo = data.Ativo === 'True' || data.Ativo === true;
        dataUltimaConferencia = exibirDataUltimoInventario(data.DataUltimoInventario);
        sistemaBox.textContent = `Estoque Atual: ${formatarNumero(estoqueAtual)}`;
        detalhesConteudo.innerHTML += `
            <p><strong>Ativo:</strong> ${ativo ? 'Ativado' : 'Desativado'}</p>
            <p><strong>Data da última conferência:</strong> ${dataUltimaConferencia}</p>
        `;
    } catch (error) {
        sistemaBox.textContent = 'Erro ao buscar informações do sistema';
    }
    let pendente = 0;
    let produtosPendentes = [];
    try {
        const response = await fetch('/api/produtos_pendentes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ IDProduto: item.ID, IDEmpresa: empresaId }),
        });
        if (!response.ok) throw new Error('Erro na requisição');
        const data = await response.json();
        produtosPendentes = data.produtos_pendentes.filter(p => String(p.IDProduto) === String(item.ID));
        pendente = produtosPendentes.reduce((total, pedido) => {
            return total + parseFloat(pedido.QuantidadePendente || 0);
        }, 0);
        paraEntregarBox.textContent = `Para Entregar: ${formatarNumero(pendente)}`;
        fisicoBox.textContent = `Físico: ${formatarNumero(estoqueAtual + pendente)}`;
    } catch (error) {
        paraEntregarBox.textContent = 'Erro ao buscar pendentes';
    }
    tabelaPedidos.innerHTML = '';
    if (produtosPendentes.length > 0) {
        produtosPendentes.forEach(pedido => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pedido.Pedido}</td>
                <td>${pedido.Cliente}</td>
                <td>${exibirData(pedido.DataVenda)}</td>
                <td>${pedido.Situação || 'Sem Situação'}</td>
                <td>${formatarNumero(pedido.QuantidadePendente || 0)}</td>
            `;
            tabelaPedidos.appendChild(tr);
        });
        pedidosNaoEntreguesBox.style.display = 'block';
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5">Nenhum pedido pendente encontrado</td>`;
        tabelaPedidos.appendChild(tr);
        pedidosNaoEntreguesBox.style.display = 'none';
    }
    detalhes.style.display = 'block';
}
function fecharDetalhes() {
    const detalhes = document.getElementById('detalhes');
    const resultados = document.getElementById('resultados');
    const pedidosNaoEntreguesBox = document.getElementById('pedidos-nao-entregues');
    detalhes.style.display = 'none';
    pedidosNaoEntreguesBox.style.display = 'none';
    resultados.style.display = 'block';
}

document.addEventListener("DOMContentLoaded", function () {
    // Recupera os dados do usuário armazenados
    const usuarioData = sessionStorage.getItem("usuario");
    
    if (usuarioData) {
        const usuario = JSON.parse(usuarioData);
    } else {
        console.warn("Nenhum dado de usuário encontrado.");
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
            // Se for o link /fiscal, só adiciona se o usuário for admin
            if (link.url === '/fiscal') {
                if (usuario.Cargo.trim().toLowerCase() !== 'admin') {
                    return; // Não adiciona o link para usuários que não são admin
                }
            }

            const li = document.createElement('li');
            li.innerHTML = `<a href="${link.url}">${link.icone} ${link.texto}</a>`;
            li.querySelector('a').addEventListener('click', function(e) {
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
            { url: '/pedidos', texto: 'Status de Pedido', icone: '🔄' },
            { url: '/fiscal', texto: 'Perfil Fiscal V2', icone: '📋' },
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
    // Recupera os dados do usuário armazenados
    const usuarioData = sessionStorage.getItem("usuario");

    if (!usuarioData) {
        alert("Usuário não autenticado! Redirecionando para a página de login...");
        window.location.href = "/"; // Ajuste a URL conforme necessário
    }
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
        sessionStorage.clear(); // Remove todas as informações do sessionStorage
        window.location.href = "/"; // Redireciona para a página inicial
    });
});