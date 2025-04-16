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
document.getElementById('empresa-select').addEventListener('change', function () {
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
window.onload = carregarMarcas;

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
document.getElementById('search-input').addEventListener('keypress', function (event) {
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
    if (typeof valor === 'string') valor = parseFloat(valor);
    if (typeof valor === 'number' && !isNaN(valor)) {
      return Number.isInteger(valor) ? valor.toString() : valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }
    return '0';
  };
  const exibirData = data => {
    if (!data) return 'Data inválida';
    const date = new Date(data);
    if (isNaN(date)) return 'Data inválida';
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };
  const exibirDataUltimoInventario = data => {
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
  let estoqueAtual = 0, ativo = false, dataUltimaConferencia = '';
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
  let pendente = 0, produtosPendentes = [];
  try {
    const response = await fetch('/api/produtos_pendentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDProduto: item.ID, IDEmpresa: empresaId }),
    });
    if (!response.ok) throw new Error('Erro na requisição');
    const data = await response.json();
    produtosPendentes = data.produtos_pendentes.filter(p => String(p.IDProduto) === String(item.ID));
    pendente = produtosPendentes.reduce((total, pedido) => total + parseFloat(pedido.QuantidadePendente || 0), 0);
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

// ------------------------------
// Trechos removidos referentes ao header, navbar e menus:
// - Verificação de dados do usuário no sessionStorage (mantido apenas se necessário para a lógica de negócio)
// - Menu responsivo (click no menu-icon e toggling da nav)
// - Lógica dos menus (Estoque, Vendas e Admin)
// - Eventos dos ícones (Home e Sair)
// ------------------------------

// Caso a verificação de usuário seja necessária para a lógica de negócio, mantenha-a:
document.addEventListener("DOMContentLoaded", function () {
  const usuarioData = sessionStorage.getItem("usuario");
  if (usuarioData) {
    window.usuario = JSON.parse(usuarioData);
  } else {
    console.warn("Nenhum dado de usuário encontrado.");
  }
});

// Também foi mantido o redirecionamento para login se não houver usuário:
document.addEventListener("DOMContentLoaded", function () {
  const usuarioData = sessionStorage.getItem("usuario");
  if (!usuarioData) {
    alert("Usuário não autenticado! Redirecionando para a página de login...");
    window.location.href = "/";
  }
});
