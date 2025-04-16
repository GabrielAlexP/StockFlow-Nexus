const menuItems = document.querySelectorAll('.menu-item');
const resultadosDiv = document.getElementById('resultados');
const viewContainer = document.getElementById('viewContainer');
const detailView = document.getElementById('detailView');
const backButton = document.getElementById('backButton');
const metaTitle = document.getElementById('metaTitle');
const metasGrid = document.getElementById('metasGrid');
const alterarButton = document.getElementById('alterarButton');
const salvarButton = document.getElementById('salvarButton');
const yearDown = document.getElementById('yearDown');
const yearUp = document.getElementById('yearUp');
const currentYearSpan = document.getElementById('currentYear');

let currentVendor = {};
let currentCategoryIndex = null;
let selectedCategory = null; // evita requisições duplicadas
let editing = false;
let currentYear = new Date().getFullYear();

currentYearSpan.textContent = currentYear;

// Atualiza os estados dos botões conforme o estado atual
function updateButtonStates() {
  // Se não estiver em modo de edição, "alterar" é ativo (verde) e "salvar" inativo (branco e desabilitado)
  if (!editing) {
    alterarButton.classList.remove('inactive', 'disabled');
    alterarButton.classList.add('active');
    alterarButton.disabled = false;
    salvarButton.classList.remove('active');
    salvarButton.classList.add('inactive', 'disabled');
    salvarButton.disabled = true;
  } else {
    // Se estiver em modo de edição, "salvar" é ativo (verde) e "alterar" inativo (branco e desabilitado)
    salvarButton.classList.remove('inactive', 'disabled');
    salvarButton.classList.add('active');
    salvarButton.disabled = false;
    alterarButton.classList.remove('active');
    alterarButton.classList.add('inactive', 'disabled');
    alterarButton.disabled = true;
  }
}

updateButtonStates();

// Formata o nome com a primeira letra maiúscula
function formatName(name) {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// Formata para moeda ou exibe mensagem padrão
function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return "Meta não registrada";
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Preenche a grid com os dados das metas
function fillMetasGrid(metaData) {
  const meses = [
    { nome: 'Janeiro', num: 1 },
    { nome: 'Fevereiro', num: 2 },
    { nome: 'Março', num: 3 },
    { nome: 'Abril', num: 4 },
    { nome: 'Maio', num: 5 },
    { nome: 'Junho', num: 6 },
    { nome: 'Julho', num: 7 },
    { nome: 'Agosto', num: 8 },
    { nome: 'Setembro', num: 9 },
    { nome: 'Outubro', num: 10 },
    { nome: 'Novembro', num: 11 },
    { nome: 'Dezembro', num: 12 }
  ];
  metasGrid.innerHTML = "";
  const metasObj = {};
  metaData.forEach(item => {
    if (parseInt(item.Ano) === currentYear) {
      metasObj[item.mes_n] = item.Meta;
    }
  });
  meses.forEach(mes => {
    const valor = metasObj[mes.num] || 0;
    const metaExibida = editing ?
      `<input type="text" value="${(valor && valor !== 0) ? valor : ''}" placeholder="Meta não registrada" data-mes="${mes.num}" />`
      : formatCurrency(valor);
    const div = document.createElement('div');
    div.className = "meta-item";
    div.innerHTML = `<span class="meta-label">${mes.nome}</span><span class="meta-value">${metaExibida}</span>`;
    metasGrid.appendChild(div);
  });
}

// Animação na lista de vendedores
function animateResults(direction) {
  resultadosDiv.classList.remove('slide-down', 'slide-up');
  void resultadosDiv.offsetWidth;
  if (direction === 'down') resultadosDiv.classList.add('slide-down');
  else if (direction === 'up') resultadosDiv.classList.add('slide-up');
}

// Controle do ano
yearDown.addEventListener('click', () => {
  currentYear--;
  currentYearSpan.textContent = currentYear;
  fillMetasGrid(window.currentMetaData || []);
});
yearUp.addEventListener('click', () => {
  currentYear++;
  currentYearSpan.textContent = currentYear;
  fillMetasGrid(window.currentMetaData || []);
});

// Carrega a lista de vendedores conforme a categoria selecionada
menuItems.forEach(item => {
  item.addEventListener('click', () => {
    const obs = item.getAttribute('data-obs');
    const newIndex = parseInt(item.getAttribute('data-index'));
    if (selectedCategory === obs) return;
    selectedCategory = obs;
    let direction = null;
    if (currentCategoryIndex !== null) {
      direction = (newIndex > currentCategoryIndex) ? 'down' : 'up';
    }
    currentCategoryIndex = newIndex;
    menuItems.forEach(mi => mi.style.background = "rgba(255,255,255,0.05)");
    item.style.background = "#00b894";
    fetch(`/api/meta?obs=${obs}`)
      .then(response => response.json())
      .then(data => {
        if (direction) animateResults(direction);
        resultadosDiv.innerHTML = "";
        data.forEach(entry => {
          const div = document.createElement('div');
          div.className = "result-item";
          div.setAttribute('data-codigo', entry.codigo);
          div.setAttribute('data-vendedor', entry.vendedor);
          const vendedorFormatado = formatName(entry.vendedor);
          div.innerHTML = `<div>${entry.codigo}</div><div>${vendedorFormatado}</div>`;
          div.addEventListener('click', () => {
            currentVendor = {
              codigo: entry.codigo,
              vendedor: vendedorFormatado
            };
            editing = false;
            // Ao selecionar um vendedor, reinicia o estado: Alterar ativo, Salvar desabilitado
            alterarButton.disabled = false;
            alterarButton.classList.remove('disabled', 'inactive');
            alterarButton.classList.add('active');
            salvarButton.disabled = true;
            salvarButton.classList.remove('active');
            salvarButton.classList.add('inactive', 'disabled');
            fetch(`/api/meta_vendedor?ID_Vendedor=${entry.codigo}`)
              .then(response => response.json())
              .then(metaData => {
                window.currentMetaData = metaData;
                metaTitle.textContent = `Metas de ${vendedorFormatado} para`;
                currentYear = new Date().getFullYear();
                currentYearSpan.textContent = currentYear;
                fillMetasGrid(metaData);
                viewContainer.style.transform = "translateX(-50%)";
              })
              .catch(error => console.error("Erro ao buscar metas:", error));
          });
          resultadosDiv.appendChild(div);
        });
      })
      .catch(error => {
        console.error("Erro ao buscar vendedores:", error);
        resultadosDiv.innerHTML = "<p>Erro ao carregar dados.</p>";
      });
  });
});

// Botão de voltar para a lista
backButton.addEventListener('click', () => {
  viewContainer.style.transform = "translateX(0)";
});

// Botão Alterar: ativa modo de edição
alterarButton.addEventListener('click', () => {
  if (editing) return;
  editing = true;
  updateButtonStates();
  fillMetasGrid(window.currentMetaData || []);
});

// Botão Salvar: envia alterações para o back-end e retorna ao estado padrão
salvarButton.addEventListener('click', () => {
  if (!editing) return;
  const metas = [];
  document.querySelectorAll('.meta-value input').forEach(input => {
    const mesNum = input.getAttribute('data-mes');
    const valor = input.value.trim() || "0";
    metas.push({ mes: mesNum, meta: valor });
  });
  fetch('/api/save_meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ID_Vendedor: currentVendor.codigo,
      Ano: currentYear,
      metas: metas,
      Vendedor: currentVendor.vendedor
    })
  })
    .then(response => response.json())
    .then(result => {
      console.log("Resposta do servidor:", result);
      window.currentMetaData = result;
      editing = false;
      updateButtonStates();
      fillMetasGrid(result);
    })
    .catch(error => console.error("Erro ao salvar as metas:", error));
});

// Seleciona "Vendedores" por padrão ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
  const defaultItem = document.querySelector('.menu-item[data-obs="vendedor"]');
  if (defaultItem) defaultItem.click();
});

// Bloqueio para acesso à página Meta – somente para usuários admin
document.addEventListener("DOMContentLoaded", function () {
  const usuarioData = sessionStorage.getItem("usuario");
  if (!usuarioData) {
    alert("Usuário não autenticado! Redirecionando para a página de login...");
    window.location.href = "/";
    return;
  }
  const usuario = JSON.parse(usuarioData);
  if (usuario.Cargo.trim().toLowerCase() !== "admin") {
    alert("Você não tem permissão para acessar esta página!");
    window.location.href = "/portal";
    return;
  }
});

// PARTE COMPARTILHADA: Verifica se há dados do usuário no sessionStorage.
document.addEventListener("DOMContentLoaded", function () {
  const usuarioData = sessionStorage.getItem("usuario");
  if (usuarioData) {
    // Guarda o usuário em uma variável global, se necessário.
    window.usuario = JSON.parse(usuarioData);
  } else {
    console.warn("Nenhum dado de usuário encontrado.");
  }
});

// Menu responsivo (ex.: para mobile)
document.addEventListener("DOMContentLoaded", function () {
  const menuIcon = document.getElementById("menu-icon");
  const nav = document.querySelector("nav");

  if (menuIcon) {
    menuIcon.addEventListener("click", function () {
      nav.classList.toggle("active");
    });
  }

  document.addEventListener("click", function (event) {
    if (!nav.contains(event.target) && (!menuIcon || !menuIcon.contains(event.target))) {
      nav.classList.remove("active");
    }
  });
});

// Lógica dos menus (Estoque, Vendas e Admin)
document.addEventListener("DOMContentLoaded", function () {
  const opcoesEstoque = document.getElementById("opcoesEstoque");
  const opcoesVendas = document.getElementById("opcoesVendas");
  const opcoesAdmin = document.getElementById("opcoesAdmin");
  const usuario = window.usuario || JSON.parse(sessionStorage.getItem("usuario"));

  function verificarPermissaoEstoque() {
    if (!usuario) {
      alert("Usuário não autenticado!");
      return false;
    }
    const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
    const cargosPermitidos = ["admin", "estoque"];
    if (!cargosPermitidos.includes(cargoNormalizado)) {
      alert("Você não tem permissão para acessar esta página!");
      return false;
    }
    return true;
  }

  function verificarPermissaoVendas() {
    if (!usuario) {
      alert("Usuário não autenticado!");
      return false;
    }
    const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
    const cargosPermitidosVendas = ["admin", "vendedor", "gerente", "supervisor"];
    if (!cargosPermitidosVendas.includes(cargoNormalizado)) {
      alert("Você não tem permissão para acessar esta página!");
      return false;
    }
    return true;
  }

  function verificarPermissaoAdmin() {
    if (!usuario) {
      alert("Usuário não autenticado!");
      return false;
    }
    const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
    if (cargoNormalizado !== "admin") {
      alert("Você não tem permissão para acessar esta página!");
      return false;
    }
    return true;
  }

  function adicionarLinks(lista, links, verificarPermissao, outraLista) {
    // Limpa a outra lista (caso exista) e a própria lista
    if (outraLista) outraLista.innerHTML = "";
    lista.innerHTML = "";
    if (!verificarPermissao()) return;

    // Exibe um título baseado no id do elemento
    lista.innerHTML = `<li class="nav-title">${lista.getAttribute("id").replace("opcoes", "Opções de ")}</li>`;
    links.forEach(link => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${link.url}">${link.icone} ${link.texto}</a>`;
      li.querySelector("a").addEventListener("click", function (e) {
        if (!verificarPermissao()) {
          e.preventDefault();
          lista.innerHTML = "";
        }
      });
      lista.appendChild(li);
    });
  }

  // Link Estoque – apenas com as opções referentes ao estoque
  document.getElementById("estoqueLink").addEventListener("click", function (e) {
    e.preventDefault();
    opcoesVendas.innerHTML = "";
    opcoesAdmin.innerHTML = "";
    adicionarLinks(opcoesEstoque, [
      { url: "/estoque", texto: "Consulta de Estoque", icone: "📦" },
      { url: "/pedidos", texto: "Status de Pedido", icone: "🔄" },
      { url: "/venda", texto: "Relatório de Vendas", icone: "🗂️" },
      { url: "/entrega", texto: "Ger. Entregas", icone: "📩" }
    ], verificarPermissaoEstoque, opcoesVendas);
  });

  // Link Vendas – com as opções de vendas
  document.getElementById("vendasLink").addEventListener("click", function (e) {
    e.preventDefault();
    opcoesEstoque.innerHTML = "";
    opcoesAdmin.innerHTML = "";
    let dashboardUrl = "/";
    const cargo = usuario.Cargo.trim().toLowerCase();
    if (cargo === "admin") {
      dashboardUrl = "/admin";
    } else if (cargo === "gerente" || cargo === "supervisor") {
      dashboardUrl = "/gerente";
    } else if (cargo === "vendedor") {
      dashboardUrl = "/vendedor";
    }
    adicionarLinks(opcoesVendas, [
      { url: '/info', texto: 'Informação de Vendas', icone: '🛒' },
      { url: "/ranking", texto: "Ranking de Vendas", icone: "📊" },
      { url: dashboardUrl, texto: "Dashboard de Vendas", icone: "🛒" },
      { url: "/cnpj", texto: "Consulta de CNPJ", icone: "🔎" }
    ], verificarPermissaoVendas, opcoesEstoque);
  });

  // Link Admin – com as opções restritas ao usuário admin
  document.getElementById("adminLink").addEventListener("click", function (e) {
    e.preventDefault();
    opcoesEstoque.innerHTML = "";
    opcoesVendas.innerHTML = "";
    opcoesAdmin.innerHTML = "";
    if (!verificarPermissaoAdmin()) return;
    opcoesAdmin.innerHTML = `<li class="nav-title">Opções de Admin</li>`;
    const linksAdmin = [
      { url: "/fiscal", texto: "Perfil Fiscal V2", icone: "📋" },
      { url: "/produtos", texto: "Atualizar Preço", icone: "🛒" },
      { url: "/meta", texto: "Meta dos Vendedores", icone: "📶" },
      { url: "/escritorio", texto: "Ranking Escritório", icone: "🏢" },
      { url: "/pix", texto: "Pix", icone: "💸" }
    ];
    linksAdmin.forEach(link => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${link.url}">${link.icone} ${link.texto}</a>`;
      li.querySelector("a").addEventListener("click", function (e) {
        if (!verificarPermissaoAdmin()) {
          e.preventDefault();
          opcoesAdmin.innerHTML = "";
        }
      });
      opcoesAdmin.appendChild(li);
    });
  });
});

// Redireciona para login se não houver usuário
document.addEventListener("DOMContentLoaded", function () {
  const usuarioData = sessionStorage.getItem("usuario");
  if (!usuarioData) {
    alert("Usuário não autenticado! Redirecionando para a página de login...");
    window.location.href = "/";
  }
});

// Eventos dos ícones da página (ex.: Home e Sair)
document.addEventListener("DOMContentLoaded", function () {
  const homeIcon = document.getElementById("home-icon");
  const exitIcon = document.getElementById("exit-icon");

  if (homeIcon) {
    homeIcon.addEventListener("click", function () {
      window.location.href = "/portal";
    });
  }

  if (exitIcon) {
    exitIcon.addEventListener("click", function () {
      sessionStorage.clear();
      window.location.href = "/";
    });
  }
});
