document.addEventListener("DOMContentLoaded", function () {
  // Verificação de autenticação e dados do usuário
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
  // Permite acesso apenas para "admin" ou "estoque"
  if (cargo !== "admin" && cargo !== "estoque") {
    window.location.href = "/portal";
    return;
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
        tr.setAttribute("data-pedido", pedido.Pedido);
        tabelaBody.appendChild(tr);
      });
      pedidos.forEach(pedido => {
        carregarEstoqueParaPedido(pedido.Pedido);
      });
      aplicarEventosDetalhes();
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
    }
  }

  async function carregarEstoqueParaPedido(pedidoId) {
    try {
      const response = await fetch(`/api/produtos-faltantes/${pedidoId}`);
      if (!response.ok) throw new Error("Erro ao buscar os dados dos produtos faltantes");
      const produtos = await response.json();
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
