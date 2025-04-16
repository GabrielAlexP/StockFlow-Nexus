document.addEventListener("DOMContentLoaded", function () {
  const empresaSelect = document.getElementById("empresa");
  const usuarioSelect = document.getElementById("usuario");
  const senhaInput = document.getElementById("senha");
  const loginBtn = document.getElementById("loginBtn");

  // Carrega lista de empresas
  fetch("/api/empresas")
    .then(response => response.json())
    .then(data => {
      data.forEach(empresa => {
        const option = document.createElement("option");
        option.value = empresa.IDEmpresa;
        option.textContent = empresa.IDEmpresa;
        empresaSelect.appendChild(option);
      });
    })
    .catch(error => console.error("Erro ao carregar empresas:", error));

  // Quando muda a empresa, carrega vendedores
  empresaSelect.addEventListener("change", function () {
    const empresaId = this.value;
    if (!empresaId) return;
    usuarioSelect.innerHTML = '<option value="" disabled selected>Selecione um usuário</option>';
    fetch(`/api/vendedores/${empresaId}`)
      .then(response => response.json())
      .then(data => {
        data.forEach(vendedor => {
          const option = document.createElement("option");
          option.value = vendedor.LogON;
          option.textContent = vendedor.LogON;
          usuarioSelect.appendChild(option);
        });
      })
      .catch(error => console.error("Erro ao carregar usuários:", error));
  });

  function realizarLogin() {
    const empresaId = empresaSelect.value;
    const usuario = usuarioSelect.value;
    const senha = senhaInput.value;

    if (!empresaId || !usuario || !senha) {
      alert("Preencha todos os campos!");
      return;
    }

    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ IDEmpresa: empresaId, LogON: usuario, Senha: senha })
    })
      .then(response => response.json())
      .then(data => {
        if (data.sucesso) {
          // Login bem-sucedido
          sessionStorage.setItem("usuario", JSON.stringify(data.usuario));
          window.location.href = "/portal";
        } else {
          // Login falhou: exibe mensagem de senha incorreta ou geral
          const msg = data.mensagem === "Login mal-sucedido!"
            ? "Senha incorreta, por favor, tente novamente"
            : data.mensagem;
          alert(msg);
          // opcional: limpa campo de senha
          senhaInput.value = "";
          senhaInput.focus();
        }
      })
      .catch(error => {
        console.error("Erro no login:", error);
        alert("Ocorreu um erro ao tentar logar. Tente novamente mais tarde.");
      });
  }

  // Dispara login ao clicar no botão ou pressionar Enter
  loginBtn.addEventListener("click", realizarLogin);
  senhaInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      realizarLogin();
    }
  });
});
