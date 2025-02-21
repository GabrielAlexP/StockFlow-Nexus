document.addEventListener("DOMContentLoaded", () => {
    async function carregarPedidos() {
        try {
            const response = await fetch("/api/entregas");
            if (!response.ok) {
                throw new Error("Erro ao buscar os dados da API");
            }
            const pedidos = await response.json();
            const tabelaBody = document.querySelector("#tabela-pedidos tbody");
            tabelaBody.innerHTML = "";

            pedidos.forEach(pedido => {
                const tr = document.createElement("tr");
                const classeSituacao = pedido.Situação === "Liberado" ? "liberado" : "entregue-part";
                tr.classList.add(classeSituacao);
                const dataFormatada = pedido.DataVenda.split("-").reverse().join("/");
                tr.innerHTML = `
                    <td>${pedido.Pedido}</td>
                    <td>${pedido.NomeCliente}</td>
                    <td>${pedido.Vendedor}</td>
                    <td>${dataFormatada}</td>
                    <td>${pedido.Situação}</td>
                    <td><span class="detalhes-link" data-pedido="${pedido.Pedido}">Mostrar Detalhes</span></td>
                `;
                tabelaBody.appendChild(tr);
            });

            aplicarEventosDetalhes();

        } catch (error) {
            console.error("Erro ao carregar pedidos:", error);
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
                    if (!response.ok) {
                        throw new Error("Erro ao buscar os dados dos produtos faltantes");
                    }
                    const produtosFaltantes = await response.json();
                    const formatarQuantidade = (quantidade) => {
                        return Number(quantidade) % 1 === 0
                            ? Number(quantidade).toString()
                            : Number(quantidade).toFixed(1).replace('.', ',');
                    };

                    const novaLinha = document.createElement("tr");
                    novaLinha.classList.add("form-detalhes-row");
                    const novoTd = document.createElement("td");
                    novoTd.colSpan = 6; 
                    novoTd.innerHTML = `
                        <div class="form-detalhes">
                            <h3>Detalhes do Pedido ${pedidoId}</h3>
                            <table class="detalhes-tabela">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Descrição</th>
                                        <th>Falta Entregar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${produtosFaltantes.map(produto => `
                                        <tr>
                                            <td>${produto.IDProduto}</td>
                                            <td>${produto.Descrição}</td>
                                            <td>${formatarQuantidade(produto.QuantidadeFaltante)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
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
        let tempoRestante = 300; 

        const atualizarTimer = () => {
            const minutos = Math.floor(tempoRestante / 60);
            const segundos = tempoRestante % 60;
            timerElement.textContent = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')} para atualizar a página`;

            if (tempoRestante > 0) {
                tempoRestante -= 1;
            } else {
               
                carregarPedidos();
                tempoRestante = 300; 
            }
        };

        setInterval(atualizarTimer, 1000);
        atualizarTimer();
    }

    carregarPedidos();
    iniciarTimer();
});



document.addEventListener("DOMContentLoaded", function () {
    // ===== Verificação de Acesso para a Página de Estoque =====
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
    if (cargo !== "admin" && cargo !== "estoque") {
      window.location.href = "/portal";
      return;
    }
    // Se chegou aqui, o acesso está liberado para usuários com cargo "admin" ou "estoque".
  
    // ===== Menu Responsivo =====
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
  
    // ===== Funções de Navegação (Opções) =====
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
  
    // (Mantive esta função para consistência, mesmo que na página de Estoque ela não seja o foco)
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
      if (lista) {
        // Adiciona o título da navegação
        lista.innerHTML = `<li class="nav-title">${lista.getAttribute("id").replace("opcoes", "Opções de ")}</li>`;
        links.forEach(link => {
          // Se for o link /fiscal, só adiciona se o usuário for admin
          if (link.url === "/fiscal") {
            if (usuario.Cargo.trim().toLowerCase() !== "admin") {
              return;
            }
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
    }
  
    // Exemplo: Links da opção Estoque
    const estoqueLink = document.getElementById("estoqueLink");
    if (estoqueLink) {
      estoqueLink.addEventListener("click", function (e) {
        e.preventDefault();
        adicionarLinks(opcoesEstoque, [
          { url: "/estoque", texto: "Consulta de Estoque", icone: "📦" },
          { url: "/pedidos", texto: "Status de Pedido", icone: "🔄" },
          { url: '/venda', texto: 'Relatório de Vendas', icone: '🗂️' },
          { url: "/fiscal", texto: "Perfil Fiscal V2", icone: "📋" }
        ], verificarPermissaoEstoque, opcoesVendas);
      });
    }
  
    // Exemplo: Links da opção Vendas (rota do Dashboard varia conforme o cargo)
    const vendasLink = document.getElementById("vendasLink");
    if (vendasLink) {
      vendasLink.addEventListener("click", function (e) {
        e.preventDefault();
        let dashboardUrl = "/";
        // Exemplo de redirecionamento conforme cargo (pode ser ajustado conforme a lógica da sua aplicação)
        if (cargo === "admin") {
          dashboardUrl = "/admin";
        } else if (cargo === "gerente" || cargo === "supervisor") {
          dashboardUrl = "/gerente";
        } else if (cargo === "vendedor") {
          dashboardUrl = "/vendedor";
        }
        adicionarLinks(opcoesVendas, [
          { url: "/ranking", texto: "Ranking de Vendas", icone: "📊" },
          { url: dashboardUrl, texto: "Dashboard de Vendas", icone: "🛒" },
          { url: "/cnpj", texto: "Consulta de CNPJ", icone: "🔎" }
        ], verificarPermissaoVendas, opcoesEstoque);
      });
    }
  
    // ===== Verificação Final (Redundante, mas para garantir) =====
    if (!usuarioData) {
      alert("Usuário não autenticado! Redirecionando para a página de login...");
      window.location.href = "/";
      return;
    }
  
    // ===== Eventos dos Ícones Home e Sair =====
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
  });
  