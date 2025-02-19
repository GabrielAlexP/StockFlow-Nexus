// Funções para formatação dos números
function formatInteger(value) {
    const number = parseFloat(value);
    return Number.isInteger(number) ? number.toString() : number;
  }

  function formatCurrency(value) {
    const number = parseFloat(value);
    return number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Carrega as empresas no select
    fetch("/api/empresas")
      .then(response => {
        if (!response.ok) throw new Error("Erro ao buscar empresas.");
        return response.json();
      })
      .then(data => {
        const select = document.getElementById("empresa-select");
        data.forEach(empresa => {
          const option = document.createElement("option");
          option.value = empresa.IDEmpresa;
          option.text = empresa.IDEmpresa;
          select.appendChild(option);
        });
        // Define a empresa selecionada com base nos dados do usuário
        const usuarioData = sessionStorage.getItem("usuario");
        if (usuarioData) {
          const usuario = JSON.parse(usuarioData);
          select.value = usuario.Empresa.toString();
        }
      })
      .catch(error => {
        console.error("Erro:", error);
      });

    // Evento do botão "Gerar Formulário"
    document.getElementById("btn-gerar").addEventListener("click", function () {
      const empresa = document.getElementById("empresa-select").value;
      const dataInicio = document.getElementById("data-inicio").value;
      const dataFim = document.getElementById("data-fim").value;
      const tableContainer = document.getElementById("table-container");

      if (!empresa || !dataInicio || !dataFim) {
        tableContainer.innerHTML = "";
        return;
      }

      fetch(`/api/vendas?empresa=${empresa}&data_inicio=${dataInicio}&data_fim=${dataFim}`)
        .then(response => {
          if (!response.ok) throw new Error("Erro ao buscar dados.");
          return response.json();
        })
        .then(data => {
          if (data.length === 0) {
            tableContainer.innerHTML = "<p>Nenhum dado encontrado.</p>";
            return;
          }

          let table =
            '<table><thead><tr><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Média de Preço</th><th>Estoque</th></tr></thead><tbody>';
          data.forEach(row => {
            const quantidade = formatInteger(row.Quantidade);
            const estoque = formatInteger(row.Estoque);
            const mediaPreco = formatCurrency(row.MediaPreco);
            table += `<tr>
                          <td>${row.Codigo}</td>
                          <td>${row.Descrição}</td>
                          <td>${quantidade}</td>
                          <td>${mediaPreco}</td>
                          <td>${estoque}</td>
                        </tr>`;
          });
          table += "</tbody></table>";
          tableContainer.innerHTML = table;
        })
        .catch(error => {
          console.error("Erro:", error);
          tableContainer.innerHTML = "<p>Erro ao carregar dados.</p>";
        });
    });
  });

  document.addEventListener("DOMContentLoaded", function () {
    // Configura os eventos da navbar
    const menuIcon = document.getElementById("menu-icon");
    const nav = document.querySelector("nav");

    menuIcon.addEventListener("click", function () {
      nav.classList.toggle("active");
    });

    document.addEventListener("click", function (event) {
      if (!nav.contains(event.target) && !menuIcon.contains(event.target)) {
        nav.classList.remove("active");
      }
    });
  });

  document.addEventListener("DOMContentLoaded", function () {
    const opcoesEstoque = document.getElementById("opcoesEstoque");
    const opcoesVendas = document.getElementById("opcoesVendas");
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));

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
      outraLista.innerHTML = "";
      lista.innerHTML = "";
      if (!verificarPermissao()) return;

      lista.innerHTML = `<li class="nav-title">${lista.getAttribute(
        "id"
      ).replace("opcoes", "Opções de ")}</li>`;

      links.forEach(link => {
        if (link.url === "/fiscal") {
          if (usuario.Cargo.trim().toLowerCase() !== "admin") {
            return;
          }
        }
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

    document.getElementById("estoqueLink").addEventListener("click", function (e) {
      e.preventDefault();
      adicionarLinks(
        opcoesEstoque,
        [
          { url: "/estoque", texto: "Consulta de Estoque", icone: "📦" },
          { url: "/pedidos", texto: "Status de Pedido", icone: "🔄" },
          { url: "/venda", texto: "Relatório de Vendas", icone: "🗂️" },
          { url: "/fiscal", texto: "Perfil Fiscal V2", icone: "📋" }
        ],
        verificarPermissaoEstoque,
        opcoesVendas
      );
    });

    document.getElementById("vendasLink").addEventListener("click", function (e) {
      e.preventDefault();
      let dashboardUrl = "/";
      const cargo = usuario.Cargo.trim().toLowerCase();
      if (cargo === "admin") {
        dashboardUrl = "/admin";
      } else if (cargo === "gerente" || cargo === "supervisor") {
        dashboardUrl = "/gerente";
      } else if (cargo === "vendedor") {
        dashboardUrl = "/vendedor";
      }
      adicionarLinks(
        opcoesVendas,
        [
          { url: "/ranking", texto: "Ranking de Vendas", icone: "📊" },
          { url: dashboardUrl, texto: "Dashboard de Vendas", icone: "🛒" },
          { url: "/cnpj", texto: "Consulta de CNPJ", icone: "🔎" }
        ],
        verificarPermissaoVendas,
        opcoesEstoque
      );
    });
  });

  document.addEventListener("DOMContentLoaded", function () {
    const usuarioData = sessionStorage.getItem("usuario");
    if (!usuarioData) {
      alert("Usuário não autenticado! Redirecionando para a página de login...");
      window.location.href = "/";
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    const homeIcon = document.getElementById("home-icon");
    const exitIcon = document.getElementById("exit-icon");

    homeIcon.addEventListener("click", function () {
      window.location.href = "/portal";
    });

    exitIcon.addEventListener("click", function () {
      sessionStorage.clear();
      window.location.href = "/";
    });
  });