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

  document.getElementById("btnSearch").addEventListener("click", function () {
    const searchInput = document.getElementById("searchInput").value;
    const empresa = document.getElementById("selectEmpresa").value;
    const tipoBusca = document.querySelector('input[name="tipoBusca"]:checked').value;
    if (!empresa) { alert("Selecione uma empresa."); return; }

    let marca = '';
    if (document.getElementById("toggleMarca").checked) {
      marca = document.getElementById("selectMarca").value;
    }

    let ativo = '';
    if (document.getElementById("toggleAtivo").checked) {
      ativo = document.getElementById("selectAtivo").value;
    }

    let url = `/api/produtos?searchValue=${encodeURIComponent(searchInput)}&tipoBusca=${encodeURIComponent(tipoBusca)}&empresa=${encodeURIComponent(empresa)}`;
    if (marca) { url += `&marca=${encodeURIComponent(marca)}`; }
    if (ativo) { url += `&ativo=${encodeURIComponent(ativo)}`; }

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.error) { alert("Erro: " + data.error); return; }
        if (data.length === 0) { alert("Nenhum produto encontrado."); return; }
        searchResults = data;
        document.getElementById("resultsArea").style.display = "block";
        renderTable();
      })
      .catch(error => { console.error("Erro ao buscar produtos:", error); });
  });

  document.querySelectorAll(".col-checkbox").forEach(chk => {
    chk.addEventListener("change", function () { if (searchResults.length > 0) { renderTable(); } });
  });

  document.addEventListener("DOMContentLoaded", function () {
    fetch("/api/marcas")
      .then(response => response.json())
      .then(data => {
        data.sort((a, b) => a.Descricao.localeCompare(b.Descricao));
        const selectMarca = document.getElementById("selectMarca");
        selectMarca.innerHTML = '<option value="">Selecione a marca</option>';
        data.forEach(marca => {
          const option = document.createElement("option");
          option.value = marca.Codigo;
          option.textContent = marca.Descricao;
          selectMarca.appendChild(option);
          marcasMap[marca.Codigo] = marca.Descricao;
        });
      })
      .catch(error => { console.error("Erro ao carregar as marcas:", error); });
    const selectEmpresa = document.getElementById("selectEmpresa");
    fetch("/api/empresas")
      .then(response => response.json())
      .then(data => {
        selectEmpresa.innerHTML = '<option value="">Selecione a empresa</option>';
        data.forEach(empresa => {
          const option = document.createElement("option");
          option.value = empresa.IDEmpresa;
          option.textContent = empresa.IDEmpresa;
          selectEmpresa.appendChild(option);
        });
      })
      .catch(error => { console.error("Erro ao carregar as empresas:", error); });
    fetch("/api/uniMedidas")
      .then(response => response.json())
      .then(data => { uniMedidas = data; })
      .catch(error => { console.error("Erro ao carregar as unidades de medida:", error); });
  });

  function updateSearchResultsFromTable() {
    const table = document.getElementById("produtosTable");
    const rows = table.querySelectorAll("tbody tr");
    const headerCells = document.querySelectorAll("#tableHeader th");
    let selectedColumn = document.querySelector('input[name="priceType"]:checked').value;
    let selectedIndex = -1;
    headerCells.forEach((th, index) => {
      if (th.getAttribute("data-key") === selectedColumn) {
        selectedIndex = index;
      }
    });
    if (selectedIndex === -1) return;
    rows.forEach(row => {
      const cells = row.querySelectorAll("td");
      const productId = cells[0].textContent;
      let cellValue = cells[selectedIndex].textContent;
      if (cellValue.startsWith("R$")) {
        cellValue = cellValue.substring(2).trim();
      }
      cellValue = cellValue.replace(/\./g, "").replace(",", ".");
      const newNumber = parseFloat(cellValue);
      searchResults.forEach(prod => {
        if (prod.ID == productId) {
          prod[selectedColumn] = newNumber;
        }
      });
    });
  }

  document.getElementById("btnGravar").addEventListener("click", function () {
    forceBlurInputs();
    const updates = searchResults.filter(p => p.changedFields && Object.keys(p.changedFields).length > 0)
      .map(p => Object.assign({ ID: p.ID }, p.changedFields));
    if (updates.length === 0) {
      alert("Nenhuma alteração para gravar.");
      return;
    }
    const empresa = document.getElementById("selectEmpresa").value;
    const payload = { empresa: empresa, updates: updates };
    fetch("/api/update_produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          alert("Erro: " + data.error);
        } else {
          alert("Atualização realizada com sucesso!");
          searchResults.forEach(p => { p.changedFields = {}; p._original = Object.assign({}, p); });
          document.getElementById("btnGravar").disabled = true;
        }
      })
      .catch(err => { alert("Erro na atualização: " + err); });
  });

  document.getElementById("btnAtualizar").addEventListener("click", function () {
    forceBlurInputs();
    updateSearchResultsFromTable();
    if (!searchResults || searchResults.length === 0) {
      alert("Realize uma pesquisa primeiro.");
      return;
    }
    const inputEl = document.querySelector('.update-price-container .price-input input[type="text"]');
    const inputValueStr = inputEl.value;
    const inputValue = parseFloat(inputValueStr.replace(",", "."));
    if (isNaN(inputValue)) {
      alert("Valor inválido!");
      return;
    }
    const selectedColumn = document.querySelector('input[name="priceType"]:checked').value;
    const operation = document.querySelector('input[name="operation"]:checked').value;
    const chkPorcentagem = document.getElementById("chkPorcentagem");
    const isPercentage = chkPorcentagem && chkPorcentagem.checked;
    const chkArredondar = document.getElementById("chkArredondar");
    const useRounding = chkArredondar && chkArredondar.checked;
    searchResults.forEach(produto => {
      let currentValue = parseFloat(produto[selectedColumn]);
      if (isNaN(currentValue)) { currentValue = 0; }
      let newVal;
      if (isPercentage) {
        if (operation === "soma") {
          newVal = currentValue + (currentValue * (inputValue / 100));
        } else if (operation === "subtracao") {
          newVal = currentValue - (currentValue * (inputValue / 100));
        }
      } else {
        if (operation === "soma") {
          newVal = currentValue + inputValue;
        } else if (operation === "subtracao") {
          newVal = currentValue - inputValue;
        }
      }
      if (useRounding && (selectedColumn === "CustoMedio" || selectedColumn === "PreçoMinimo")) {
        newVal = roundToEven(newVal);
      }
      produto[selectedColumn] = newVal;
    });
    renderTable();
  });
});

function renderTable() {
  const headerRow = document.getElementById("tableHeader");
  const resultTable = document.getElementById("resultTable");
  headerRow.innerHTML = "";
  resultTable.innerHTML = "";

  const fixedHeaders = [
    { key: "ID", title: "Código", fixedWidth: "80px" },
    { key: "DescProduto", title: "Descrição", fixedWidth: "520px" }
  ];
  fixedHeaders.forEach(col => {
    const th = document.createElement("th");
    th.innerHTML = (col.key === lastSortedKey)
      ? col.title + ' <span style="color:#fff;">' + (lastSortAscending ? "▲" : "▼") + "</span>"
      : col.title;
    th.setAttribute("data-key", col.key);
    th.setAttribute("data-title", col.title);
    th.style.width = col.fixedWidth;
    th.draggable = false;
    th.addEventListener("click", function (e) {
      if (preventSort) { preventSort = false; return; }
      if (isResizing || e.target.classList.contains("resizer")) return;
      sortTableByKey(col.key, th);
    });
    headerRow.appendChild(th);
  });

  let activeColumns = [];
  document.querySelectorAll(".col-checkbox").forEach(chk => {
    if (chk.checked) {
      const key = chk.getAttribute("data-key");
      const colData = availableColumns.find(col => col.key === key);
      if (colData) activeColumns.push(colData);
    }
  });
  activeColumns.sort((a, b) => columnOrder.indexOf(a.key) - columnOrder.indexOf(b.key));
  activeColumns.forEach(colData => {
    const th = document.createElement("th");
    th.innerHTML = (colData.key === lastSortedKey)
      ? colData.title + ' <span style="color:#fff;">' + (lastSortAscending ? "▲" : "▼") + "</span>"
      : colData.title;
    th.setAttribute("data-key", colData.key);
    th.setAttribute("data-title", colData.title);
    if (colWidths[colData.key]) th.style.width = colWidths[colData.key] + "px";
    th.draggable = true;
    th.addEventListener("click", function (e) {
      if (preventSort) { preventSort = false; return; }
      if (isResizing || e.target.classList.contains("resizer")) return;
      if (e.offsetX > th.clientWidth - 10) return;
      sortTableByKey(colData.key, th);
    });
    headerRow.appendChild(th);
  });

  addDragAndDropToHeaders();
  document.getElementById("recordCount").textContent = "Número de registros: " + searchResults.length;

  searchResults.forEach(produto => {
    if (!produto._original) {
      produto._original = Object.assign({}, produto);
    }
    const row = document.createElement("tr");
    const tdID = document.createElement("td");
    tdID.textContent = produto.ID;
    row.appendChild(tdID);
    const tdDesc = document.createElement("td");
    tdDesc.textContent = produto.DescProduto;
    row.appendChild(tdDesc);

    activeColumns.forEach(col => {
      const td = document.createElement("td");
      if (col.key === "A entregar" || col.key === "EstoqueFisico") {
        td.textContent = (produto[col.key] !== undefined ? produto[col.key] : "0");
      } else if (col.key === "ativo") {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = produto[col.key] == 1;
        checkbox.style.width = "20px";
        checkbox.style.height = "20px";
        checkbox.style.accentColor = "#00FF00";
        checkbox.addEventListener("change", () => {
          let newVal = checkbox.checked ? 1 : 0;
          produto[col.key] = newVal;
          markChange(produto, col.key, newVal);
          enableGravarButton();
        });
        td.appendChild(checkbox);
      } else if (col.key === "EstoqueAtual") {
        let valor = parseFloat(produto[col.key]);
        let numeroStr = (isNaN(valor) || valor === 0)
          ? "0"
          : (valor % 1 === 0 ? valor.toString() : valor.toString().replace(".", ","));
        td.textContent = numeroStr;
      } else if (col.key === "UniMedida") {
        let valor = produto[col.key];
        td.textContent = (valor ? valor : "Não registrado");
      } else if (col.key === "Altura" || col.key === "Largura" || col.key === "Peso") {
        let valor = produto[col.key];
        const unidade = (col.key === "Peso") ? " g" : " cm";
        td.textContent = (!valor || parseInt(valor) === 0) ? "Não registrado" : parseInt(valor) + unidade;
      } else if (col.key === "CustoMedio" || col.key === "PreçoMinimo" || col.key === "PreçoTabela") {
        let valor = produto[col.key];
        if (valor === 0 || valor === "" || valor === null) {
          td.textContent = "Não registrado";
        } else {
          const chkArredondar = document.getElementById("chkArredondar");
          const useRounding = chkArredondar && chkArredondar.checked;
          if (useRounding && (col.key === "CustoMedio" || col.key === "PreçoMinimo")) {
            valor = roundToEven(valor);
          }
          if (useRounding) {
            td.textContent = "R$ " + formatBRL(valor);
          } else {
            td.textContent = "R$ " + valor.toString().replace(".", ",");
          }
        }
      } else if (col.key === "NCM") {
        let valor = produto[col.key];
        td.textContent = (valor === 0 || valor === "" || valor === null) ? "Não registrado" : valor;
      } else if (col.key === "CodBarra") {
        td.textContent = produto[col.key];
      } else if (col.key === "Marca") {
        let valor = produto[col.key];
        td.textContent = (valor && marcasMap[valor]) ? marcasMap[valor] : "Não registrado";
      } else {
        td.textContent = produto[col.key] || "";
      }
      row.appendChild(td);
    });

    row.addEventListener("click", function () {
      if (!row.classList.contains("selected-row")) {
        document.querySelectorAll(".results-container tbody tr").forEach(r => r.classList.remove("selected-row"));
        row.classList.add("selected-row");
        return;
      }
    });

    Array.from(row.cells).forEach((cell, index) => {
      if (index === 0) return;
      cell.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!row.classList.contains("selected-row")) {
          document.querySelectorAll(".results-container tbody tr").forEach(r => r.classList.remove("selected-row"));
          row.classList.add("selected-row");
          return;
        }
        const table = document.getElementById("produtosTable");
        const th = table.querySelectorAll("thead th")[index];
        const colKey = th.getAttribute("data-key");
        if (colKey === "EstoqueAtual" || colKey === "A entregar" || colKey === "EstoqueFisico") return;
        if (colKey === "DataUltimaCompra" || colKey === "QtdUltimaCompra" || colKey === "CustoUltimaCompra") return;

        if (cell.querySelector("input") || cell.querySelector("select")) return;
        const originalText = cell.textContent;
        const units = {
          "CustoMedio": "R$ ",
          "PreçoMinimo": "R$ ",
          "PreçoTabela": "R$ ",
          "Altura": " cm",
          "Largura": " cm",
          "Peso": " g"
        };
        let unit = units[colKey] || "";
        if (colKey === "Marca") {
          const select = document.createElement("select");
          const selectMarcaEl = document.getElementById("selectMarca");
          select.innerHTML = selectMarcaEl.innerHTML;
          select.disabled = false;
          select.value = produto.Marca || "";
          cell.innerHTML = "";
          cell.appendChild(select);
          select.focus();
          select.addEventListener("blur", function () {
            const newValue = select.value;
            if (!newValue) {
              cell.innerHTML = "Não registrado";
            } else {
              cell.innerHTML = marcasMap[newValue] || newValue;
            }
            produto.Marca = newValue;
            markChange(produto, colKey, newValue);
            enableGravarButton();
          });
          select.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { select.blur(); }
          });
          return;
        } else if (colKey === "UniMedida") {
          const select = document.createElement("select");
          if (uniMedidas && uniMedidas.length > 0) {
            uniMedidas.forEach(um => {
              const option = document.createElement("option");
              option.value = um;
              option.textContent = um;
              if (um === produto.UniMedida) {
                option.selected = true;
              }
              select.appendChild(option);
            });
          }
          cell.innerHTML = "";
          cell.appendChild(select);
          select.focus();
          select.addEventListener("blur", function () {
            let newValue = select.value;
            produto.UniMedida = newValue;
            cell.innerHTML = newValue;
            markChange(produto, colKey, newValue);
            enableGravarButton();
          });
          select.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { select.blur(); }
          });
          return;
        } else {
          let textToEdit = originalText;
          if ((colKey === "CustoMedio" || colKey === "PreçoMinimo" || colKey === "PreçoTabela") && textToEdit.startsWith("R$ ")) {
            textToEdit = textToEdit.substring(3).trim();
          }
          if (unit && textToEdit.endsWith(unit)) {
            textToEdit = textToEdit.slice(0, -unit.length).trim();
          }
          if (textToEdit === "Não registrado") {
            textToEdit = "";
          }
          const input = document.createElement("input");
          input.type = "text";
          input.value = textToEdit;
          input.style.width = "100%";
          cell.innerHTML = "";
          cell.appendChild(input);
          input.focus();
          input.addEventListener("blur", function () {
            let newValue = input.value.trim();
            if ((!newValue || newValue == 0) && colKey !== "EstoqueAtual") {
              cell.innerHTML = "Não registrado";
              markChange(produto, colKey, "Não registrado");
              enableGravarButton();
              return;
            }
            if (unit) {
              let num = parseFloat(newValue.replace(",", "."));
              if (isNaN(num)) {
                alert("Valor inválido!");
                cell.innerHTML = originalText;
                return;
              }
              if (colKey === "CustoMedio" || colKey === "PreçoMinimo" || colKey === "PreçoTabela") {
                const chkArredondar = document.getElementById("chkArredondar");
                if (chkArredondar && chkArredondar.checked && (colKey === "CustoMedio" || colKey === "PreçoMinimo")) {
                  num = roundToEven(num);
                }
                newValue = num.toString();
                cell.innerHTML = "R$ " + formatBRL(newValue);
              } else if (colKey === "Altura" || colKey === "Largura" || colKey === "Peso") {
                let intVal = parseInt(num);
                newValue = intVal.toString();
                cell.innerHTML = intVal + units[colKey];
              } else if (colKey === "EstoqueAtual") {
                cell.innerHTML = newValue + unit;
              } else {
                cell.innerHTML = newValue;
              }
            } else {
              cell.innerHTML = newValue;
            }
            markChange(produto, colKey, newValue);
            enableGravarButton();
          });
          input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { input.blur(); }
          });
        }
      });
    });
    resultTable.appendChild(row);
  });
  addResizers(document.getElementById("produtosTable"));
}

function roundToEven(n) {
  if (Number.isInteger(n) && n % 2 === 0) return n;
  let lowerEven = Math.floor(n);
  while (lowerEven % 2 !== 0) { lowerEven--; }
  let higherEven = Math.ceil(n);
  while (higherEven % 2 !== 0) { higherEven++; }
  let diffLower = n - lowerEven;
  let diffHigher = higherEven - n;
  return (diffLower === diffHigher) ? higherEven : (diffLower < diffHigher ? lowerEven : higherEven);
}

function sortTableByKey(key, thElement) {
  sortOrders[key] = !sortOrders[key];
  lastSortedKey = key;
  lastSortAscending = sortOrders[key];
  function getValue(item) {
    if (key === "ativo") { return item[key] == 1 ? 1 : 0; }
    let val = item[key];
    if (typeof val === "string" && val.startsWith("R$")) {
      val = val.substring(2).trim().replace(",", ".");
    }
    const num = parseFloat(val);
    return isNaN(num) ? val.toLowerCase() : num;
  }
  searchResults.sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    if (typeof aVal === "number" && typeof bVal === "number") {
      return lastSortAscending ? aVal - bVal : bVal - aVal;
    } else {
      return lastSortAscending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
  });
  renderTable();
}

function addDragAndDropToHeaders() {
  const thElements = document.querySelectorAll("#tableHeader th[data-key]");
  thElements.forEach(th => {
    const key = th.getAttribute("data-key");
    if (key === "ID" || key === "DescProduto") return;
    th.setAttribute("draggable", true);
    th.addEventListener("dragstart", function (e) {
      if (isResizing || e.target.classList.contains("resizer")) { e.preventDefault(); return; }
      e.dataTransfer.setData("text/plain", key);
      draggedColKey = key;
    });
    th.addEventListener("dragover", function (e) {
      e.preventDefault();
      th.style.borderRight = "2px solid #fff";
    });
    th.addEventListener("dragleave", function (e) {
      th.style.borderRight = "";
    });
    th.addEventListener("drop", function (e) {
      e.preventDefault();
      th.style.borderRight = "";
      let targetKey = th.getAttribute("data-key");
      if (draggedColKey && draggedColKey !== targetKey) {
        let draggedIndex = columnOrder.indexOf(draggedColKey);
        let targetIndex = columnOrder.indexOf(targetKey);
        columnOrder.splice(draggedIndex, 1);
        columnOrder.splice(targetIndex, 0, draggedColKey);
        renderTable();
      }
      draggedColKey = null;
    });
  });
}

function addResizers(table) {
  table.querySelectorAll(".resizer").forEach(r => r.remove());
  const cols = table.querySelectorAll("thead th");
  cols.forEach((th) => {
    const key = th.getAttribute("data-key");
    if (key === "ID" || key === "DescProduto") return;
    if (colWidths[key]) { th.style.width = colWidths[key] + "px"; }
    if (th !== cols[cols.length - 1]) {
      const resizer = document.createElement("div");
      resizer.className = "resizer";
      resizer.addEventListener("mousedown", function (e) { e.stopPropagation(); });
      resizer.addEventListener("click", function (e) { e.stopPropagation(); });
      th.appendChild(resizer);
      createResizableColumn(th, resizer);
    }
  });
}

function createResizableColumn(th, resizer) {
  let startX, startWidth;
  resizer.addEventListener("mousedown", initResize);
  function initResize(e) {
    e.stopPropagation();
    isResizing = true;
    startX = e.clientX;
    startWidth = th.offsetWidth;
    window.addEventListener("mousemove", resizeColumn);
    window.addEventListener("mouseup", stopResize);
  }
  function resizeColumn(e) {
    const newWidth = startWidth + (e.clientX - startX);
    th.style.width = newWidth + "px";
    const key = th.getAttribute("data-key");
    colWidths[key] = newWidth;
  }
  function stopResize() {
    window.removeEventListener("mousemove", resizeColumn);
    window.removeEventListener("mouseup", stopResize);
    isResizing = false;
    preventSort = true;
    setTimeout(() => { preventSort = false; }, 50);
  }
}

// Habilita ou desabilita os selects de Marca e Ativo/Inativo conforme os checkboxes
document.getElementById("toggleMarca").addEventListener("change", function () {
  document.getElementById("selectMarca").disabled = !this.checked;
});
document.getElementById("toggleAtivo").addEventListener("change", function () {
  document.getElementById("selectAtivo").disabled = !this.checked;
});

document.getElementById("btnSearch").addEventListener("click", function () {
  const searchInput = document.getElementById("searchInput").value;
  const empresa = document.getElementById("selectEmpresa").value;
  const tipoBusca = document.querySelector('input[name="tipoBusca"]:checked').value;
  if (!empresa) { alert("Selecione uma empresa."); return; }

  let marca = "";
  if (document.getElementById("toggleMarca").checked) {
    marca = document.getElementById("selectMarca").value;
  }

  let ativo = "";
  if (document.getElementById("toggleAtivo").checked) {
    ativo = document.getElementById("selectAtivo").value;
  }

  let url = `/api/produtos?searchValue=${encodeURIComponent(searchInput)}&tipoBusca=${encodeURIComponent(tipoBusca)}&empresa=${encodeURIComponent(empresa)}`;
  if (marca) { url += `&marca=${encodeURIComponent(marca)}`; }
  if (ativo) { url += `&ativo=${encodeURIComponent(ativo)}`; }

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.error) { alert("Erro: " + data.error); return; }
      if (data.length === 0) { alert("Nenhum produto encontrado."); return; }
      searchResults = data;
      document.getElementById("resultsArea").style.display = "block";
      renderTable();
    })
    .catch(error => { console.error("Erro ao buscar produtos:", error); });
});

document.querySelectorAll(".col-checkbox").forEach(chk => {
  chk.addEventListener("change", function () { if (searchResults.length > 0) { renderTable(); } });
});

document.addEventListener("DOMContentLoaded", function () {
  fetch("/api/marcas")
    .then(response => response.json())
    .then(data => {
      data.sort((a, b) => a.Descricao.localeCompare(b.Descricao));
      const selectMarca = document.getElementById("selectMarca");
      selectMarca.innerHTML = '<option value="">Selecione a marca</option>';
      data.forEach(marca => {
        const option = document.createElement("option");
        option.value = marca.Codigo;
        option.textContent = marca.Descricao;
        selectMarca.appendChild(option);
        marcasMap[marca.Codigo] = marca.Descricao;
      });
    })
    .catch(error => { console.error("Erro ao carregar as marcas:", error); });
  const selectEmpresa = document.getElementById("selectEmpresa");
  fetch("/api/empresas")
    .then(response => response.json())
    .then(data => {
      selectEmpresa.innerHTML = '<option value="">Selecione a empresa</option>';
      data.forEach(empresa => {
        const option = document.createElement("option");
        option.value = empresa.IDEmpresa;
        option.textContent = empresa.IDEmpresa;
        selectEmpresa.appendChild(option);
      });
    })
    .catch(error => { console.error("Erro ao carregar as empresas:", error); });
  fetch("/api/uniMedidas")
    .then(response => response.json())
    .then(data => { uniMedidas = data; })
    .catch(error => { console.error("Erro ao carregar as unidades de medida:", error); });
});

function updateSearchResultsFromTable() {
  const table = document.getElementById("produtosTable");
  const rows = table.querySelectorAll("tbody tr");
  const headerCells = document.querySelectorAll("#tableHeader th");
  let selectedColumn = document.querySelector('input[name="priceType"]:checked').value;
  let selectedIndex = -1;
  headerCells.forEach((th, index) => {
    if (th.getAttribute("data-key") === selectedColumn) {
      selectedIndex = index;
    }
  });
  if (selectedIndex === -1) return;
  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    const productId = cells[0].textContent;
    let cellValue = cells[selectedIndex].textContent;
    if (cellValue.startsWith("R$")) {
      cellValue = cellValue.substring(2).trim();
    }
    cellValue = cellValue.replace(/\./g, "").replace(",", ".");
    const newNumber = parseFloat(cellValue);
    searchResults.forEach(prod => {
      if (prod.ID == productId) {
        prod[selectedColumn] = newNumber;
      }
    });
  });
}

document.getElementById("btnGravar").addEventListener("click", function () {
  forceBlurInputs();
  const updates = searchResults.filter(p => p.changedFields && Object.keys(p.changedFields).length > 0)
    .map(p => Object.assign({ ID: p.ID }, p.changedFields));
  if (updates.length === 0) {
    alert("Nenhuma alteração para gravar.");
    return;
  }
  const empresa = document.getElementById("selectEmpresa").value;
  const payload = { empresa: empresa, updates: updates };
  fetch("/api/update_produtos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        alert("Erro: " + data.error);
      } else {
        alert("Atualização realizada com sucesso!");
        searchResults.forEach(p => { p.changedFields = {}; p._original = Object.assign({}, p); });
        document.getElementById("btnGravar").disabled = true;
      }
    })
    .catch(err => { alert("Erro na atualização: " + err); });
});

document.getElementById("btnAtualizar").addEventListener("click", function () {
  forceBlurInputs();
  updateSearchResultsFromTable();
  if (!searchResults || searchResults.length === 0) {
    alert("Realize uma pesquisa primeiro.");
    return;
  }
  const inputEl = document.querySelector('.update-price-container .price-input input[type="text"]');
  const inputValueStr = inputEl.value;
  const inputValue = parseFloat(inputValueStr.replace(",", "."));
  if (isNaN(inputValue)) {
    alert("Valor inválido!");
    return;
  }
  const selectedColumn = document.querySelector('input[name="priceType"]:checked').value;
  const operation = document.querySelector('input[name="operation"]:checked').value;
  const chkPorcentagem = document.getElementById("chkPorcentagem");
  const isPercentage = chkPorcentagem && chkPorcentagem.checked;
  const chkArredondar = document.getElementById("chkArredondar");
  const useRounding = chkArredondar && chkArredondar.checked;
  searchResults.forEach(produto => {
    let currentValue = parseFloat(produto[selectedColumn]);
    if (isNaN(currentValue)) { currentValue = 0; }
    let newVal;
    if (isPercentage) {
      if (operation === "soma") {
        newVal = currentValue + (currentValue * (inputValue / 100));
      } else if (operation === "subtracao") {
        newVal = currentValue - (currentValue * (inputValue / 100));
      }
    } else {
      if (operation === "soma") {
        newVal = currentValue + inputValue;
      } else if (operation === "subtracao") {
        newVal = currentValue - inputValue;
      }
    }
    if (useRounding && (selectedColumn === "CustoMedio" || selectedColumn === "PreçoMinimo")) {
      newVal = roundToEven(newVal);
    }
    produto[selectedColumn] = newVal;
  });
  renderTable();
});
