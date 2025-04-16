const cnpjInput = document.getElementById('cnpj'),
  searchForm = document.getElementById('search-form'),
  dataContainer = document.getElementById('data-container');

cnpjInput.addEventListener('input', function () {
  let value = this.value.replace(/\D/g, '').slice(0, 14),
    formattedValue = '';
  if (value.length > 0) formattedValue += value.substring(0, 2);
  if (value.length >= 3) formattedValue += '.' + value.substring(2, 5);
  else if (value.length > 2) formattedValue += '.' + value.substring(2);
  if (value.length >= 6) formattedValue += '.' + value.substring(5, 8);
  else if (value.length > 5) formattedValue += '.' + value.substring(5);
  if (value.length >= 9) formattedValue += '/' + value.substring(8, 12);
  else if (value.length > 8) formattedValue += '/' + value.substring(8);
  if (value.length >= 13) formattedValue += '-' + value.substring(12, 14);
  else if (value.length > 12) formattedValue += '-' + value.substring(12);
  this.value = formattedValue;
});

searchForm.addEventListener('submit', function (e) {
  e.preventDefault();
  // Limpa os dados antigos, se houver
  document.querySelectorAll('.data-field').forEach(field => field.textContent = "");
  // Limpa também os containers de sócios
  document.getElementById('socios-row').innerHTML = "";

  dataContainer.classList.remove('visible');
  void dataContainer.offsetWidth;
  dataContainer.classList.add('visible');
  dataContainer.style.display = 'flex';
  document.getElementById('inserir-em').style.display = 'block';
  document.getElementById('action-buttons').style.display = 'flex';

  let cnpj = document.getElementById('cnpj').value.replace(/\D/g, '');
  if (cnpj.length !== 14) {
    alert("Por favor, insira um CNPJ válido com 14 dígitos.");
    return;
  }

  fetch("/api/consultar_cnpj", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cnpj: cnpj })
  })
    .then(response => response.json())
    .then(data => {
      if (data.erro) {
        alert(data.erro);
        return;
      }

      // — Preenche campos existentes —
      document.querySelector(".data-razao .data-field").textContent = data["Razao Social"] || "-";
      document.querySelector(".data-municipio .data-field").textContent = data["Municipio"] || "-";
      document.querySelector(".data-bairro .data-field").textContent = data["Bairro"] || "-";
      document.querySelector(".data-telefone .data-field").textContent = data["Telefone"] || "-";
      document.querySelector(".data-uf .data-field").textContent = data["UF"] || "-";
      document.querySelector(".data-cep .data-field").textContent = data["CEP"] || "-";
      document.querySelector(".data-inscricao .data-field").textContent = data["Inscricao Estadual"] || "-";
      document.querySelector(".data-simples .data-field").textContent = data["Simples Nacional"] === 1 ? "Sim" : "Não";

      // ——— NOVO: Endereço clicável que abre o modal ———
      const enderecoField = document.getElementById('endereco-field');
      const endereco = data["Endereco"] || "-";
      const mapUrl = data.MapUrl;
      const streetUrl = data.StreetUrl;

      enderecoField.innerHTML = `<a href="#" id="address-link">${endereco}</a>`;
      document.getElementById('address-link').addEventListener('click', evt => {
        evt.preventDefault();
        openModal(mapUrl, streetUrl);
      });
      // —————————————————————————————————————————————

      // Atualiza a seção de sócios
      const sociosRow = document.getElementById('socios-row');
      if (Array.isArray(data["Socios"])) {
        const count = data["Socios"].length;
        data["Socios"].forEach((item, index) => {
          let parts = item.split(":");
          let role = parts[0].trim();
          let name = parts.slice(1).join(":").trim();

          const container = document.createElement("div");
          container.classList.add("data-box");
          if (count === 1) {
            container.style.width = "100%";
          } else {
            container.style.width = (count % 2 === 1 && index === count - 1)
              ? "100%"
              : "calc(50% - 15px)";
          }

          const label = document.createElement("label");
          label.textContent = role + ":";
          const field = document.createElement("div");
          field.classList.add("data-field");
          field.textContent = name;

          container.appendChild(label);
          container.appendChild(field);
          sociosRow.appendChild(container);
        });
      } else {
        const container = document.createElement("div");
        container.classList.add("data-box");
        container.style.width = "100%";
        const label = document.createElement("label");
        label.textContent = "Sócios:";
        const field = document.createElement("div");
        field.classList.add("data-field");
        field.textContent = data["Socios"];
        container.appendChild(label);
        container.appendChild(field);
        sociosRow.appendChild(container);
      }
    })
    .catch(error => console.error("Erro na consulta: ", error));
});

// — Funções do modal — 
const modal = document.getElementById('map-modal');
const imgMap = document.getElementById('modal-map-img');
const imgStreet = document.getElementById('modal-street-img');
const closeBtn = modal.querySelector('.modal-close');

function openModal(mapSrc, streetSrc) {
  imgMap.src = mapSrc;
  imgStreet.src = streetSrc;
  modal.style.display = 'flex';
}

closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

// Fecha modal ao clicar fora do conteúdo
modal.addEventListener('click', e => {
  if (e.target === modal) modal.style.display = 'none';
});


window.addEventListener('load', function () {
  dataContainer.classList.remove('visible');
});

document.getElementById("atualizar").addEventListener("click", function () {
  if (confirm("Você tem certeza que quer atualizar estes dados no sistema?")) {
    let cnpj = document.getElementById("cnpj").value;
    if (cnpj.length !== 18) {
      alert("CNPJ inválido. Verifique os dados.");
      return;
    }
    const usuarioData = sessionStorage.getItem("usuario");
    if (!usuarioData) {
      alert("Usuário não autenticado! Atualização cancelada.");
      return;
    }
    const usuario = JSON.parse(usuarioData),
      inserirEm = document.getElementById("inserir-em").value;
    if (!inserirEm) {
      alert("Selecione em qual tabela deseja atualizar os dados (Cliente, Fornecedor ou Ambos).");
      return;
    }
    fetch("/api/atualizar_dados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cnpj: cnpj,
        vendedor: usuario.Vendedor,
        nome: usuario.Nome || usuario.nome,
        empresa: usuario.Empresa || usuario.empresa,
        inserir_em: inserirEm
      })
    })
      .then(response => response.json())
      .then(data => {
        alert(data.mensagem || "Dados atualizados com sucesso!");
      })
      .catch(error => {
        alert("Erro ao atualizar os dados!");
        console.error("Erro:", error);
      });
  }
});

document.getElementById("limpar").addEventListener("click", function (e) {
  e.preventDefault();
  document.querySelectorAll(".data-field").forEach(field => field.textContent = "");
  document.getElementById("cnpj").value = "";
  dataContainer.classList.remove('visible');
  dataContainer.style.display = 'none';
  document.getElementById('inserir-em').style.display = 'none';
  document.getElementById('action-buttons').style.display = 'none';
  document.getElementById("socios-row").innerHTML = "";
  document.getElementById("cnpj").focus();
});

// Histórico de versões — basta adicionar novos objetos ao array:
const VERSION_HISTORY = [
  { version: '1.0.1', description: 'Ao clicar no endereço, exibirá a foto da rua e o mapa da região do cliente.' },
];

// Elementos
const versionInfo    = document.getElementById('version-info');
const modalversion   = document.getElementById('version-modal');
const modalBody      = document.getElementById('version-modal-body');
const modalClose     = document.getElementById('version-modal-close');

// Preenche o modal com o histórico
function populateVersionModal() {
  modalBody.innerHTML = ''; // limpa
  VERSION_HISTORY.forEach((item, idx) => {
      const h3 = document.createElement('h3');
      h3.textContent = item.version;
      const p = document.createElement('p');
      p.textContent = item.description;
      modalBody.appendChild(h3);
      modalBody.appendChild(p);
      if (idx < VERSION_HISTORY.length - 1) {
          const hr = document.createElement('hr');
          modalBody.appendChild(hr);
      }
  });
}

// Abre o modal
versionInfo.addEventListener('click', () => {
  populateVersionModal();
  modalversion.style.display = 'block';
});

// Fecha ao clicar no “×”
modalClose.addEventListener('click', () => {
  modalversion.style.display = 'none';
});

// Fecha ao clicar fora do conteúdo
window.addEventListener('click', (e) => {
  if (e.target === modalversion) {
      modalversion.style.display = 'none';
  }
});