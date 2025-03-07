function formatInteger(value) {
  const number = parseFloat(value);
  return Number.isInteger(number) ? number.toString() : number;
}
function formatCurrency(value) {
  const number = parseFloat(value);
  return number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
document.addEventListener("DOMContentLoaded", function () {
  const container = document.querySelector(".container");
  if (container) {
    container.style.width = "90%";
    container.style.maxWidth = "1200px";
  }
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
      const usuarioData = sessionStorage.getItem("usuario");
      console.log(usuarioData)
      if (usuarioData) {
        const usuario = JSON.parse(usuarioData);
        select.value = usuario.Empresa.toString();
      }
    })
    .catch(error => console.error("Erro:", error));
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
        let table = `<table style="width: 100%; table-layout: fixed;">
            <colgroup>
              <col style="width: 100px;">
              <col style="width: auto;">
              <col style="width: 100px;">
              <col style="width: 100px;">
              <col style="width: 100px;">
              <col style="width: 100px;">
              <col style="width: 120px;">
              <col style="width: 120px;">
            </colgroup>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Quantidade</th>
                <th>Média de Preço</th>
                <th>Estoque</th>
                <th>Estoque Físico</th>
                <th>Última Conferência</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>`;
        data.forEach(row => {
          const quantidade = formatInteger(row.Quantidade);
          const estoque = formatInteger(row.Estoque);
          const estoqueFisico = formatInteger(row.EstoqueFisico);
          const mediaPreco = formatCurrency(row.MediaPreco);
          let ultimaConferencia = "Não conferido";
          if (row.DataUltimoInventario) {
            let date = new Date(row.DataUltimoInventario);
            let day = ("0" + date.getDate()).slice(-2);
            let month = ("0" + (date.getMonth() + 1)).slice(-2);
            let year = date.getFullYear();
            ultimaConferencia = `${day}/${month}/${year}`;
          }
          table += `<tr>
              <td>${row.Codigo}</td>
              <td>${row.Descrição}</td>
              <td>${quantidade}</td>
              <td>${mediaPreco}</td>
              <td>${estoque}</td>
              <td>${estoqueFisico}</td>
              <td>${ultimaConferencia}</td>
              <td><button class="btn-conferido" data-idproduto="${row.Codigo}">Conferido</button></td>
            </tr>`;
        });
        table += "</tbody></table>";
        tableContainer.innerHTML = table;
        document.querySelectorAll(".btn-conferido").forEach(button => {
          button.addEventListener("click", function () {
            const idProduto = this.getAttribute("data-idproduto");
            if (confirm("Deseja alterar a data de conferência ?")) {
              const idEmpresa = document.getElementById("empresa-select").value;
              const usuarioData = sessionStorage.getItem("usuario");
              if (!usuarioData) {
                alert("Usuário não autenticado.");
                return;
              }
              const usuario = JSON.parse(usuarioData);
              fetch("/atualizar_data_conferencia", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id_produto: idProduto,
                  id_empresa: idEmpresa,
                  nome: usuario.Nome 
                })
              })
                .then(response => response.json())
                .then(result => {
                  if (result.message) {
                    this.classList.add("checked");
                    this.textContent = "✔ Conferido";
                    this.disabled = true;
                    const now = new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) * -1);
                    const day = ("0" + now.getDate()).slice(-2);
                    const month = ("0" + (now.getMonth() + 1)).slice(-2);
                    const year = now.getFullYear();
                    const formattedDate = `${day}/${month}/${year}`;
                    const row = this.closest("tr");
                    if (row) row.cells[6].textContent = formattedDate;
                    alert("Data de conferência atualizada com sucesso!");
                  } else {
                    alert("Erro: " + result.error);
                  }
                })
                .catch(error => alert("Erro na atualização: " + error));
            }
          });
        });
      })
      .catch(error => {
        console.error("Erro:", error);
        tableContainer.innerHTML = "<p>Erro ao carregar dados.</p>";
      });
  });
});
document.addEventListener("DOMContentLoaded", function () {
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
    return ["admin", "estoque"].includes(cargoNormalizado) || (alert("Você não tem permissão para acessar esta página!"), false);
  }
  function verificarPermissaoVendas() {
    if (!usuario) {
      alert("Usuário não autenticado!");
      return false;
    }
    const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
    return ["admin", "vendedor", "gerente", "supervisor"].includes(cargoNormalizado) || (alert("Você não tem permissão para acessar esta página!"), false);
  }
  function adicionarLinks(lista, links, verificarPermissao, outraLista) {
    outraLista.innerHTML = "";
    lista.innerHTML = "";
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
  document.getElementById("estoqueLink").addEventListener("click", function (e) {
    e.preventDefault();
    adicionarLinks(opcoesEstoque, [
      { url: "/estoque", texto: "Consulta de Estoque", icone: "📦" },
      { url: "/pedidos", texto: "Status de Pedido", icone: "🔄" },
      { url: "/venda", texto: "Relatório de Vendas", icone: "🗂️" },
      { url: '/entrega', texto: 'Ger. Entregas', icone: '📩' },
      { url: "/fiscal", texto: "Perfil Fiscal V2", icone: "📋" }
    ], verificarPermissaoEstoque, opcoesVendas);
  });
  document.getElementById("vendasLink").addEventListener("click", function (e) {
    e.preventDefault();
    let dashboardUrl = "/";
    const cargo = usuario.Cargo.trim().toLowerCase();
    if (cargo === "admin") dashboardUrl = "/admin";
    else if (cargo === "gerente" || cargo === "supervisor") dashboardUrl = "/gerente";
    else if (cargo === "vendedor") dashboardUrl = "/vendedor";
    adicionarLinks(opcoesVendas, [
      { url: "/ranking", texto: "Ranking de Vendas", icone: "📊" },
      { url: dashboardUrl, texto: "Dashboard de Vendas", icone: "🛒" },
      { url: "/cnpj", texto: "Consulta de CNPJ", icone: "🔎" }
    ], verificarPermissaoVendas, opcoesEstoque);
  });
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
