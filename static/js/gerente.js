document.addEventListener("DOMContentLoaded", function () {

  const usuarioData = sessionStorage.getItem("usuario");
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

  if (cargo === "admin") {
    window.location.href = "/admin";
    return;
  } else if (cargo === "vendedor") {
    window.location.href = "/vendedor";
    return;
  } else if (cargo !== "supervisor" && cargo !== "gerente") {
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

  function adicionarLinks(lista, links, verificarPermissao, outraLista) {
    if (outraLista) outraLista.innerHTML = "";
    if (lista) lista.innerHTML = "";
    if (!verificarPermissao()) return;
    lista.innerHTML = `<li class="nav-title">${lista.getAttribute("id").replace("opcoes", "Opções de ")}</li>`;
    links.forEach(link => {
      if (link.url === "/fiscal" && usuario.Cargo.trim().toLowerCase() !== "admin") {
        return;
      }
      const li = document.createElement("li");
      li.innerHTML = `<a href="${link.url}">${link.icone} ${link.texto}</a>`;
      const a = li.querySelector("a");
      if (a) {
        a.addEventListener("click", function (e) {
          if (!verificarPermissao()) {
            e.preventDefault();
            lista.innerHTML = "";
          }
        });
      }
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
    homeIcon.addEventListener("click", () => window.location.href = "/portal");
  }
  const exitIcon = document.getElementById("exit-icon");
  if (exitIcon) {
    exitIcon.addEventListener("click", () => {
      sessionStorage.clear();
      window.location.href = "/";
    });
  }

  const empresaId = usuario.Empresa;
  const mesSelect = document.getElementById("mes");
  if (mesSelect) {
    const meses = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    mesSelect.value = meses[new Date().getMonth()];
  }

  async function carregarVendedores() {
    try {
      const response = await fetch(`/api/vendedores?empresa_id=${empresaId}`);
      if (!response.ok) throw new Error("Erro ao carregar vendedores");
      const vendedores = await response.json();
      const selectVendedor = document.getElementById("vendedor-selecao");
      if (selectVendedor) {
        selectVendedor.innerHTML = '<option value="Total">Total</option>';
        vendedores.forEach(vendedor => {
          const option = document.createElement("option");
          option.value = vendedor.ID_VENDEDOR;
          option.textContent = vendedor.LogON;
          option.dataset.obs = vendedor.OBS;
          selectVendedor.appendChild(option);
        });
        selectVendedor.dispatchEvent(new Event("change"));
      }
    } catch (error) {
      alert("Erro ao carregar a lista de vendedores.");
    }
  }

  async function carregarVendasTotal() {
    const vendedorSelect = document.getElementById("vendedor-selecao");
    if (!vendedorSelect) return;
    const vendedorId = vendedorSelect.value;
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
        vendasTotalEl.textContent = Number(data.total)
          .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    } catch (error) {
      alert("Erro ao carregar o total de vendas.");
    }
  }

  async function carregarVendasDetalhes() {
    const vendedorSelect = document.getElementById("vendedor-selecao");
    if (!vendedorSelect) return;
    const vendedorId = vendedorSelect.value;
    const statusToggle = document.getElementById("status-toggle");
    const status = statusToggle && statusToggle.checked ? "S" : "V";
    const ano = document.getElementById("ano")?.value || "";
    const mes = document.getElementById("mes")?.value || "";
    try {
      const response = await fetch(`/api/vendas_detalhes?empresa_id=${empresaId}&vendedor_id=${vendedorId}&status=${status}&ano=${ano}&mes=${mes}`);
      if (!response.ok) throw new Error("Erro ao carregar os detalhes de vendas");
      const data = await response.json();
      const orcamentosEl = document.getElementById("orcamentos");
      if (orcamentosEl) {
        orcamentosEl.textContent = data.qtd_orcamentos;
      }
      const lucroTotalEl = document.getElementById("lucro-total");
      if (lucroTotalEl) {
        lucroTotalEl.textContent = Number(data.lucro_total)
          .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    } catch (error) {
      alert("Erro ao carregar os detalhes de vendas.");
    }
  }

  async function carregarGraficoVendas() {
    const vendedorSelect = document.getElementById("vendedor-selecao");
    if (!vendedorSelect) return;
    const vendedorId = vendedorSelect.value;
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
      if (window.graficoBarras) {
        window.graficoBarras.destroy();
      }
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
    const vendedorSelect = document.getElementById("vendedor-selecao");
    if (!vendedorSelect) return;
    const vendedorId = vendedorSelect.value;
    const ano = document.getElementById("ano")?.value || "";
    const mes = document.getElementById("mes")?.value || "";
    const statusToggle = document.getElementById("status-toggle");
    const status = statusToggle && statusToggle.checked ? "S" : "V";
    const mesMap = {
      "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4,
      "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
      "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12
    };
    let mesInt = mesMap[mes.toLowerCase()] || (new Date().getMonth() + 1);
    const data_inicio = `${ano}-${("0" + mesInt).slice(-2)}-01`;
    const lastDay = new Date(ano, mesInt, 0).getDate();
    const data_fim = `${ano}-${("0" + mesInt).slice(-2)}-${lastDay}`;
    const vendedorOption = document.getElementById("vendedor-selecao").options[
      document.getElementById("vendedor-selecao").selectedIndex
    ];
    try {
      if (vendedorOption && vendedorOption.dataset.obs) {
        const cargoVendedor = vendedorOption.dataset.obs.toLowerCase();
        if (cargoVendedor === "supervisor") {
          const responseSupervisor = await fetch(`/api/comissao_supervisor?empresa_id=${empresaId}&data_inicio=${data_inicio}&data_fim=${data_fim}`);
          if (!responseSupervisor.ok) throw new Error("Erro ao carregar a comissão do supervisor");
          const supervisorData = await responseSupervisor.json();
          document.getElementById("comissao").textContent = Number(supervisorData.comissao_supervisor)
            .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        } else if (cargoVendedor === "gerente") {
          const responseGerente = await fetch(`/api/comissao_gerente?empresa_id=${empresaId}&data_inicio=${data_inicio}&data_fim=${data_fim}`);
          if (!responseGerente.ok) throw new Error("Erro ao carregar a comissão do gerente");
          const gerenteData = await responseGerente.json();
          document.getElementById("comissao").textContent = Number(gerenteData.comissao_gerente)
            .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        } else {
          const responseDetalhes = await fetch(`/api/vendas_detalhes?empresa_id=${empresaId}&vendedor_id=${vendedorId}&status=${status}&ano=${ano}&mes=${mes}`);
          if (!responseDetalhes.ok) throw new Error("Erro ao carregar os detalhes de vendas");
          const dataDetalhes = await responseDetalhes.json();
          document.getElementById("comissao").textContent = Number(dataDetalhes.total_commissao)
            .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        }
      } else {
        const responseDetalhes = await fetch(`/api/vendas_detalhes?empresa_id=${empresaId}&vendedor_id=${vendedorId}&status=${status}&ano=${ano}&mes=${mes}`);
        if (!responseDetalhes.ok) throw new Error("Erro ao carregar os detalhes de vendas");
        const dataDetalhes = await responseDetalhes.json();
        document.getElementById("comissao").textContent = Number(dataDetalhes.total_commissao)
          .toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    } catch (error) {
      alert(error.message);
    }
  }

  async function carregarMeta() {
    const vendedorSelect = document.getElementById("vendedor-selecao");
    if (!vendedorSelect) return;
    const vendedorId = vendedorSelect.value;
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
      const tbodyPedido = document.getElementById("tabela-corpo");
      if (tbodyPedido) {
        tbodyPedido.innerHTML = "";
        if (data.order && Object.keys(data.order).length > 0) {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${data.order.PEDIDO}</td>
            <td>${data.order.NomeCliente}</td>
            <td>${Number(data.order.Valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
            <td>${data.order.DataVenda}</td>
          `;
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
            tr.innerHTML = `
              <td>${product.IDProduto}</td>
              <td>${product.Descrição}</td>
              <td>${product.Quantidade}</td>
              <td>${Number(product.Valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
              <td>${Number(product.Total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
            `;
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

  function atualizarDashboard() {
    carregarVendasTotal();
    carregarVendasDetalhes();
    carregarGraficoVendas();
    carregarComissao();
    carregarMeta();
  }

  const vendedorSelecao = document.getElementById("vendedor-selecao");
  if (vendedorSelecao) {
    vendedorSelecao.addEventListener("change", atualizarDashboard);
  }
  const statusToggleEl = document.getElementById("status-toggle");
  if (statusToggleEl) {
    statusToggleEl.addEventListener("change", atualizarDashboard);
  }
  const anoEl = document.getElementById("ano");
  if (anoEl) {
    anoEl.addEventListener("change", atualizarDashboard);
  }
  if (mesSelect) {
    mesSelect.addEventListener("change", atualizarDashboard);
  }
  const btnBuscarPedido = document.getElementById("buscar-pedido");
  if (btnBuscarPedido) {
    btnBuscarPedido.addEventListener("click", buscarPedido);
  }
  const buscaPedidoInput = document.getElementById("busca-pedido");
  if (buscaPedidoInput) {
    buscaPedidoInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") buscarPedido();
    });
  }
  carregarVendedores();
});
