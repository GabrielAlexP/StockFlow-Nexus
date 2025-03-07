document.addEventListener("DOMContentLoaded", function () {
  const usuarioData = sessionStorage.getItem("usuario");
  console.log(usuarioData);
  if (!usuarioData) {
    alert("Usuário não autenticado! Redirecionando para a página de login...");
    window.location.href = "/";
    return;
  }
  let usuario;
  try {
    usuario = JSON.parse(usuarioData);
  } catch (e) {
    alert("Erro ao processar os dados do usuário. Redirecionando para a página de login.");
    sessionStorage.clear();
    window.location.href = "/";
    return;
  }
  if (!usuario.Cargo || usuario.Cargo.trim() === "") {
    alert("Cargo não definido! Redirecionando para a página de login...");
    window.location.href = "/";
    return;
  }
  const cargo = usuario.Cargo.trim().toLowerCase();
  if (cargo !== "admin" && cargo !== "estoque") {
    window.location.href = "/portal";
    return;
  }
  const menuIcon = document.getElementById("menu-icon");
  const nav = document.querySelector("nav");
  if (menuIcon && nav) {
    menuIcon.addEventListener("click", () => nav.classList.toggle("active"));
    document.addEventListener("click", event => {
      if (!nav.contains(event.target) && !menuIcon.contains(event.target)) {
        nav.classList.remove("active");
      }
    });
  }
  const opcoesEstoque = document.getElementById("opcoesEstoque");
  const opcoesVendas = document.getElementById("opcoesVendas");
  function verificarPermissaoEstoque() {
    if (!usuario) {
      alert("Usuário não autenticado!");
      return false;
    }
    const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
    if (!["admin", "estoque"].includes(cargoNormalizado)) {
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
    if (!["admin", "vendedor", "gerente", "supervisor"].includes(cargoNormalizado)) {
      alert("Você não tem permissão para acessar esta página!");
      return false;
    }
    return true;
  }
  function adicionarLinks(lista, links, verificarPermissao, outraLista) {
    if (outraLista) outraLista.innerHTML = "";
    if (lista) lista.innerHTML = "";
    if (!verificarPermissao()) return;
    lista.innerHTML = `<li class="nav-title">${lista.getAttribute("id").replace("opcoes", "Opções de ")}</li>`;
    links.forEach(link => {
      if (link.url === "/fiscal" && usuario.Cargo.trim().toLowerCase() !== "admin") return;
      const li = document.createElement("li");
      li.innerHTML = `<a href="${link.url}">${link.icone} ${link.texto}</a>`;
      li.querySelector("a").addEventListener("click", function (e) {
        if (link.url === "/fiscal" && usuario.Cargo.trim().toLowerCase() !== "admin") {
          e.preventDefault();
          alert("Você não tem permissão para acessar a página Fiscal.");
          return;
        }
        if (!verificarPermissao()) {
          e.preventDefault();
          lista.innerHTML = "";
        }
      });
      lista.appendChild(li);
    });
  }
  const estoqueLink = document.getElementById("estoqueLink");
  if (estoqueLink) {
    estoqueLink.addEventListener("click", function (e) {
      e.preventDefault();
      adicionarLinks(opcoesEstoque, [
        { url: "/estoque", texto: "Consulta de Estoque", icone: "📦" },
        { url: "/pedidos", texto: "Status de Pedido", icone: "🔄" },
        { url: "/venda", texto: "Relatório de Vendas", icone: "🗂️" },
        { url: '/entrega', texto: 'Ger. Entregas', icone: '📩' },
        { url: "/fiscal", texto: "Perfil Fiscal V2", icone: "📋" }
      ], verificarPermissaoEstoque, opcoesVendas);
    });
  }
  const vendasLink = document.getElementById("vendasLink");
  if (vendasLink) {
    vendasLink.addEventListener("click", function (e) {
      e.preventDefault();
      let dashboardUrl = "/";
      if (cargo === "admin") dashboardUrl = "/admin";
      else if (cargo === "gerente" || cargo === "supervisor") dashboardUrl = "/gerente";
      else if (cargo === "vendedor") dashboardUrl = "/vendedor";
      adicionarLinks(opcoesVendas, [
        { url: "/ranking", texto: "Ranking de Vendas", icone: "📊" },
        { url: dashboardUrl, texto: "Dashboard de Vendas", icone: "🛒" },
        { url: "/cnpj", texto: "Consulta de CNPJ", icone: "🔎" }
      ], verificarPermissaoVendas, opcoesEstoque);
    });
  }
  const homeIcon = document.getElementById("home-icon");
  if (homeIcon) {
    homeIcon.addEventListener("click", () => window.location.href = "/portal");
  }
  const exitIcon = document.getElementById("exit-icon");
  if (exitIcon) {
    exitIcon.addEventListener("click", () => {
      sessionStorage.clear();
      window.location.href = "/";
    });
  }

  async function carregarPedidos() {
    try {
      const response = await fetch("/api/entregas");
      if (!response.ok) throw new Error("Erro ao buscar os dados da API");
      let pedidos = await response.json();
      pedidos.sort((a, b) => new Date(a.DataVenda) - new Date(b.DataVenda));
      const tabelaBody = document.querySelector("#tabela-pedidos tbody");
      tabelaBody.innerHTML = "";
      pedidos.forEach(pedido => {
        const tr = document.createElement("tr");
        const classeSituacao = pedido.Situação === "Liberado" ? "liberado" : "entregue-part";
        tr.classList.add(classeSituacao);
        const dataFormatada = pedido.DataVenda.split("-").reverse().join("/");
        const dateVenda = new Date(pedido.DataVenda);
        const currentDate = new Date();
        const diffDays = Math.floor((currentDate - dateVenda) / (1000 * 60 * 60 * 24));
        const dataCell = diffDays >= 7 ? `<td style="color:red">${dataFormatada}</td>` : `<td>${dataFormatada}</td>`;
        tr.innerHTML = `<td>${pedido.Pedido}</td><td>${pedido.NomeCliente}</td><td>${pedido.Vendedor}</td>${dataCell}<td>${pedido.Situação}</td><td><span class="detalhes-link" data-pedido="${pedido.Pedido}">Mostrar Detalhes</span></td>`;
        // Atribui o ID do pedido à linha para identificação posterior
        tr.setAttribute("data-pedido", pedido.Pedido);
        tabelaBody.appendChild(tr);
      });
      // Para cada pedido, busca os detalhes do estoque e compara com a quantidade faltante
      pedidos.forEach(pedido => {
        carregarEstoqueParaPedido(pedido.Pedido);
      });
      aplicarEventosDetalhes();
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
    }
  }

  // Função que busca os produtos faltantes e verifica se a QuantidadeFaltante > EstAtual
  async function carregarEstoqueParaPedido(pedidoId) {
    try {
      const response = await fetch(`/api/produtos-faltantes/${pedidoId}`);
      if (!response.ok) throw new Error("Erro ao buscar os dados dos produtos faltantes");
      const produtos = await response.json();
      // Converte para número, se necessário
      const hasInsufficientStock = produtos.some(prod =>
        parseFloat(prod.QuantidadeFaltante) > parseFloat(prod.EstAtual)
      );
      if (hasInsufficientStock) {
        const row = document.querySelector(`tr[data-pedido="${pedidoId}"]`);
        if (row && row.children[0]) {
          row.children[0].style.color = "blue";
        }
      }
    } catch (error) {
      console.error("Erro ao carregar estoque para pedido", pedidoId, error);
    }
  }

  async function aplicarEventosDetalhes() {
    const detalhesLinks = document.querySelectorAll(".detalhes-link");
    detalhesLinks.forEach(link => {
      link.addEventListener("click", async event => {
        const pedidoId = event.target.getAttribute("data-pedido");
        const trAtual = event.target.closest("tr");
        const proximoTr = trAtual.nextElementSibling;
        if (proximoTr && proximoTr.classList.contains("form-detalhes-row")) {
          proximoTr.remove();
          return;
        }
        document.querySelectorAll(".form-detalhes-row").forEach(row => row.remove());
        try {
          const response = await fetch(`/api/produtos-faltantes/${pedidoId}`);
          if (!response.ok) throw new Error("Erro ao buscar os dados dos produtos faltantes");
          const produtosFaltantes = await response.json();
          const formatarQuantidade = quantidade =>
            Number(quantidade) % 1 === 0 ? Number(quantidade).toString() : Number(quantidade).toFixed(1).replace(".", ",");
          const novaLinha = document.createElement("tr");
          novaLinha.classList.add("form-detalhes-row");
          const novoTd = document.createElement("td");
          novoTd.colSpan = 6;
          novoTd.innerHTML = `<div class="form-detalhes"><h3>Detalhes do Pedido ${pedidoId}</h3><table class="detalhes-tabela"><thead><tr><th>Código</th><th>Descrição</th><th>Falta Entregar</th></tr></thead><tbody>${produtosFaltantes.map(produto => `<tr><td>${produto.IDProduto}</td><td>${produto.Descrição}</td><td>${formatarQuantidade(produto.QuantidadeFaltante)}</td></tr>`).join('')}</tbody></table></div>`;
          novaLinha.appendChild(novoTd);
          trAtual.parentNode.insertBefore(novaLinha, trAtual.nextSibling);
        } catch (error) {
          console.error("Erro ao carregar os produtos faltantes:", error);
        }
      });
    });
  }

  function iniciarTimer() {
    const timerElement = document.getElementById("timer");
    let tempoRestante = 120;
    const atualizarTimer = () => {
      const minutos = Math.floor(tempoRestante / 60);
      const segundos = tempoRestante % 60;
      timerElement.textContent = `${minutos.toString().padStart(2, "0")}:${segundos.toString().padStart(2, "0")} para atualizar a página`;
      if (tempoRestante > 0) tempoRestante -= 1;
      else { carregarPedidos(); tempoRestante = 120; }
    };
    setInterval(atualizarTimer, 1000);
    atualizarTimer();
  }

  carregarPedidos();
  iniciarTimer();
});
