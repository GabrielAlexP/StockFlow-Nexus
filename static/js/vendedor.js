document.addEventListener("DOMContentLoaded", function () {
  const usuarioData = sessionStorage.getItem("usuario");
  if (!usuarioData) {
    window.location.href = "/";
    return;
  }
  let usuario;
  try {
    usuario = JSON.parse(usuarioData);
  } catch (e) {
    sessionStorage.clear();
    window.location.href = "/";
    return;
  }
  if (!usuario.Cargo || usuario.Cargo.trim() === "") {
    window.location.href = "/";
    return;
  }
  const cargo = usuario.Cargo.trim().toLowerCase();
  if (cargo === "admin") {
    window.location.href = "/admin";
    return;
  } else if (cargo === "gerente" || cargo === "supervisor") {
    window.location.href = "/gerente";
    return;
  } else if (cargo !== "vendedor") {
    window.location.href = "/portal";
    return;
  }
  const menuIcon = document.getElementById("menu-icon");
  const nav = document.querySelector("nav");
  if (menuIcon && nav) {
    menuIcon.addEventListener("click", function () {
      nav.classList.toggle("active");
    });
    document.addEventListener("click", function (event) {
      if (!nav.contains(event.target) && !menuIcon.contains(event.target)) {
        nav.classList.remove("active");
      }
    });
  }
  const opcoesEstoque = document.getElementById("opcoesEstoque");
  const opcoesVendas = document.getElementById("opcoesVendas");
  function verificarPermissaoEstoque() {
    if (!usuario) return false;
    const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
    return ["admin", "estoque"].includes(cargoNormalizado) || false;
  }
  function verificarPermissaoVendas() {
    if (!usuario) return false;
    const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
    return ["admin", "vendedor", "gerente", "supervisor"].includes(cargoNormalizado) || false;
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
        { url: "/fiscal", texto: "Perfil Fiscal V2", icone: "📋" }
      ], verificarPermissaoEstoque, opcoesVendas);
    });
  }
  const vendasLink = document.getElementById("vendasLink");
  if (vendasLink) {
    vendasLink.addEventListener("click", function (e) {
      e.preventDefault();
      adicionarLinks(opcoesVendas, [
        { url: "/ranking", texto: "Ranking de Vendas", icone: "📊" },
        { url: "/cnpj", texto: "Consulta de CNPJ", icone: "🔎" }
      ], verificarPermissaoVendas, opcoesEstoque);
    });
  }
  const homeIcon = document.getElementById("home-icon");
  if (homeIcon) {
    homeIcon.addEventListener("click", function () {
      window.location.href = "/portal";
    });
  }
  const exitIcon = document.getElementById("exit-icon");
  if (exitIcon) {
    exitIcon.addEventListener("click", function () {
      sessionStorage.clear();
      window.location.href = "/";
    });
  }
  const empresaId = usuario.Empresa;
  const vendedorId = usuario.Vendedor;
  const mesSelect = document.getElementById("mes");
  if (mesSelect) {
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    mesSelect.value = meses[new Date().getMonth()];
  }
  async function carregarVendasTotal() {
    const statusToggle = document.getElementById("status-toggle");
    const status = statusToggle && statusToggle.checked ? "S" : "V";
    const ano = document.getElementById("ano")?.value || "";
    const mes = document.getElementById("mes")?.value || "";
    try {
      const response = await fetch(`/api/vendas_total?empresa_id=${empresaId}&vendedor_id=${vendedorId}&status=${status}&ano=${ano}&mes=${mes}`);
      if (!response.ok) throw new Error("Erro ao carregar total de vendas");
      const data = await response.json();
      const vendasTotalEl = document.getElementById("vendas-total");
      if (vendasTotalEl) {
        vendasTotalEl.textContent = Number(data.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    } catch (error) {
      alert("Erro ao carregar o total de vendas.");
    }
  }
  async function carregarVendasDetalhes() {
    const statusToggle = document.getElementById("status-toggle");
    const status = statusToggle && statusToggle.checked ? "S" : "V";
    const ano = document.getElementById("ano")?.value || "";
    const mes = document.getElementById("mes")?.value || "";
    try {
      const response = await fetch(`/api/vendas_detalhes?empresa_id=${empresaId}&vendedor_id=${vendedorId}&status=${status}&ano=${ano}&mes=${mes}`);
      if (!response.ok) throw new Error("Erro ao carregar os detalhes de vendas");
      const data = await response.json();
      const orcamentosEl = document.getElementById("orcamentos");
      if (orcamentosEl) orcamentosEl.textContent = data.qtd_orcamentos;
      const lucroTotalEl = document.getElementById("lucro-total");
      if (lucroTotalEl) {
        lucroTotalEl.textContent = Number(data.lucro_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    } catch (error) {
      alert("Erro ao carregar os detalhes de vendas.");
    }
  }
  async function carregarGraficoVendas() {
    const statusToggle = document.getElementById("status-toggle");
    const status = statusToggle && statusToggle.checked ? "S" : "V";
    const ano = document.getElementById("ano")?.value || "";
    const mes = document.getElementById("mes")?.value || "";
    try {
      const response = await fetch(`/api/grafico_vendas?empresa_id=${empresaId}&vendedor_id=${vendedorId}&status=${status}&ano=${ano}&mes=${mes}`);
      if (!response.ok) throw new Error("Erro ao carregar gráfico de vendas");
      const data = await response.json();
      const labels = Object.keys(data);
      const valores = Object.values(data);
      const graficoCanvas = document.getElementById("grafico-barras");
      if (!graficoCanvas) return;
      const ctx = graficoCanvas.getContext("2d");
      if (window.graficoBarras) window.graficoBarras.destroy();
      window.graficoBarras = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Vendas por Dia",
            data: valores,
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { autoSkip: false, maxRotation: 0, minRotation: 0 } },
            y: { beginAtZero: true }
          }
        }
      });
    } catch (error) {
      alert(error.message);
    }
  }
  async function carregarComissao() {
    const statusToggle = document.getElementById("status-toggle");
    const status = statusToggle && statusToggle.checked ? "S" : "V";
    const ano = document.getElementById("ano")?.value || "";
    const mes = document.getElementById("mes")?.value || "";
    const mesMap = {
      "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4,
      "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
      "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
    };
    let mesInt = mesMap[mes.toLowerCase()];
    if (!mesInt) mesInt = new Date().getMonth() + 1;
    const data_inicio = `${ano}-${("0" + mesInt).slice(-2)}-01`;
    const lastDay = new Date(ano, mesInt, 0).getDate();
    const data_fim = `${ano}-${("0" + mesInt).slice(-2)}-${lastDay}`;
    try {
      const response = await fetch(`/api/vendas_detalhes?empresa_id=${empresaId}&vendedor_id=${vendedorId}&status=${status}&ano=${ano}&mes=${mes}`);
      if (!response.ok) throw new Error("Erro ao carregar os detalhes de vendas");
      const data = await response.json();
      const comissaoEl = document.getElementById("comissao");
      if (comissaoEl) {
        comissaoEl.textContent = Number(data.total_commissao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    } catch (error) {
      alert(error.message);
    }
  }
  async function carregarMeta() {
    const ano = document.getElementById("ano")?.value || "";
    const mes = document.getElementById("mes")?.value || "";
    const status = document.getElementById("status-toggle")?.checked ? "S" : "V";
    try {
      const metaResponse = await fetch(`/api/meta?empresa_id=${empresaId}&vendedor_id=${vendedorId}`);
      if (!metaResponse.ok) throw new Error("Erro ao carregar meta");
      const metaData = await metaResponse.json();
      const meta = parseFloat(metaData.Meta) || 0;
      const vendaResponse = await fetch(`/api/vendas_total?empresa_id=${empresaId}&vendedor_id=${vendedorId}&status=${status}&ano=${ano}&mes=${mes}`);
      if (!vendaResponse.ok) throw new Error("Erro ao carregar total de vendas");
      const vendaData = await vendaResponse.json();
      const vendaTotal = parseFloat(vendaData.total) || 0;
      const falta = meta - vendaTotal;
      const valorMetaEl = document.getElementById("valor-meta");
      if (valorMetaEl) {
        valorMetaEl.textContent = `Sua meta este mês é ${meta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
      }
      const mensagemMetaEl = document.getElementById("mensagem-meta");
      const mensagemVendaEl = document.getElementById("mensagem-venda");
      if (vendaTotal >= meta) {
        if (mensagemMetaEl) mensagemMetaEl.textContent = "Parabéns, você bateu sua meta!";
      } else {
        if (mensagemMetaEl) mensagemMetaEl.textContent = `Falta ${falta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para alcançar a meta`;
      }
      if (mensagemVendaEl) {
        mensagemVendaEl.textContent = `Você já vendeu ${vendaTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
      }
      const ctxRosca = document.getElementById("grafico-rosca").getContext("2d");
      if (window.graficoRosca) window.graficoRosca.destroy();
      const achieved = Math.min(vendaTotal, meta);
      const missing = meta - achieved;
      window.graficoRosca = new Chart(ctxRosca, {
        type: "doughnut",
        data: {
          labels: ["Batido", "Falta"],
          datasets: [{
            data: [achieved, missing],
            backgroundColor: ["rgba(54, 162, 235, 1)", "rgba(255, 99, 132, 1)"],
            hoverBackgroundColor: ["rgba(54, 162, 235, 0.8)", "rgba(255, 99, 132, 0.8)"]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, position: "bottom" } }
        }
      });
    } catch (error) {
      alert(error.message);
    }
  }
  async function buscarPedido() {
    const pedidoInputEl = document.getElementById("busca-pedido");
    if (!pedidoInputEl) return;
    const pedidoInput = pedidoInputEl.value.trim();
    if (!pedidoInput) {
      alert("Preencha o número do pedido.");
      return;
    }
    try {
      const response = await fetch(`/api/buscar_pedido?pedido=${pedidoInput}&empresa_id=${empresaId}`);
      if (!response.ok) throw new Error("Erro ao buscar pedido");
      const data = await response.json();
      if (data.order && parseInt(data.order.VENDEDOR) !== parseInt(usuario.Vendedor)) {
        alert("Este pedido é de outro vendedor!");
        const tbodyPedido = document.getElementById("tabela-corpo");
        const tbodyProdutos = document.getElementById("produtos-corpo");
        if (tbodyPedido) tbodyPedido.innerHTML = "<tr><td colspan='4'>Nenhum pedido encontrado.</td></tr>";
        if (tbodyProdutos) tbodyProdutos.innerHTML = "<tr><td colspan='5'>Nenhum produto encontrado.</td></tr>";
        return;
      }
      const tbodyPedido = document.getElementById("tabela-corpo");
      if (tbodyPedido) {
        tbodyPedido.innerHTML = "";
        if (data.order && Object.keys(data.order).length > 0) {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${data.order.PEDIDO}</td><td>${data.order.NomeCliente}</td><td>${Number(data.order.Valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td>${data.order.DataVenda}</td>`;
          tbodyPedido.appendChild(tr);
        } else {
          tbodyPedido.innerHTML = "<tr><td colspan='4'>Nenhum pedido encontrado.</td></tr>";
        }
      }
      const tbodyProdutos = document.getElementById("produtos-corpo");
      if (tbodyProdutos) {
        tbodyProdutos.innerHTML = "";
        if (data.products && data.products.length > 0) {
          data.products.forEach(product => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${product.IDProduto}</td><td>${product.Descrição}</td><td>${product.Quantidade}</td><td>${Number(product.Valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td>${Number(product.Total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>`;
            tbodyProdutos.appendChild(tr);
          });
        } else {
          tbodyProdutos.innerHTML = "<tr><td colspan='5'>Nenhum produto encontrado.</td></tr>";
        }
      }
    } catch (error) {
      alert(error.message);
    }
  }
  if (document.getElementById("status-toggle")) {
    document.getElementById("status-toggle").addEventListener("change", function () {
      carregarVendasTotal();
      carregarVendasDetalhes();
      carregarGraficoVendas();
      carregarComissao();
      carregarMeta();
    });
  }
  if (document.getElementById("ano")) {
    document.getElementById("ano").addEventListener("change", function () {
      carregarVendasTotal();
      carregarVendasDetalhes();
      carregarGraficoVendas();
      carregarComissao();
      carregarMeta();
    });
  }
  if (mesSelect) {
    mesSelect.addEventListener("change", function () {
      carregarVendasTotal();
      carregarVendasDetalhes();
      carregarGraficoVendas();
      carregarComissao();
      carregarMeta();
    });
  }
  if (document.getElementById("buscar-pedido")) {
    document.getElementById("buscar-pedido").addEventListener("click", buscarPedido);
  }
  if (document.getElementById("busca-pedido")) {
    document.getElementById("busca-pedido").addEventListener("keydown", function (e) {
      if (e.key === "Enter") buscarPedido();
    });
  }
  carregarVendasTotal();
  carregarVendasDetalhes();
  carregarGraficoVendas();
  carregarComissao();
  carregarMeta();
});