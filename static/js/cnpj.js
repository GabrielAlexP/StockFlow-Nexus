const cnpjInput = document.getElementById('cnpj');
const searchForm = document.getElementById('search-form');
const dataContainer = document.getElementById('data-container');

// Máscara para o CNPJ
cnpjInput.addEventListener('input', function (e) {
    let value = this.value.replace(/\D/g, '');
    if (value.length > 14) {
        value = value.slice(0, 14);
    }
    let formattedValue = '';
    if (value.length > 0) {
        formattedValue += value.substring(0, 2);
    }
    if (value.length >= 3) {
        formattedValue += '.' + value.substring(2, 5);
    } else if (value.length > 2) {
        formattedValue += '.' + value.substring(2);
    }
    if (value.length >= 6) {
        formattedValue += '.' + value.substring(5, 8);
    } else if (value.length > 5) {
        formattedValue += '.' + value.substring(5);
    }
    if (value.length >= 9) {
        formattedValue += '/' + value.substring(8, 12);
    } else if (value.length > 8) {
        formattedValue += '/' + value.substring(8);
    }
    if (value.length >= 13) {
        formattedValue += '-' + value.substring(12, 14);
    } else if (value.length > 12) {
        formattedValue += '-' + value.substring(12);
    }
    this.value = formattedValue;
});

searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    dataContainer.classList.remove('visible');
    void dataContainer.offsetWidth; // Força recálculo do layout

    // Ativa a animação
    dataContainer.classList.add('visible');
});

window.addEventListener('load', function () {
    dataContainer.classList.remove('visible');
});

searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    dataContainer.style.display = 'flex';
});

document.getElementById("search-form").addEventListener("submit", function (event) {
    event.preventDefault();

    const cnpjInput = document.getElementById("cnpj").value.replace(/\D/g, "");
    if (cnpjInput.length !== 14) {
        alert("Por favor, insira um CNPJ válido com 14 dígitos.");
        return;
    }

    fetch("/api/consultar_cnpj", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ cnpj: cnpjInput })
    })
    .then(response => response.json())
    .then(data => {
        if (data.erro) {
            alert(data.erro);
            return;
        }

        document.querySelector(".data-razao .data-field").textContent = data["Razao Social"] || "-";
        document.querySelector(".data-endereco .data-field").textContent = data["Endereco"] || "-";
        document.querySelector(".data-municipio .data-field").textContent = data["Municipio"] || "-";
        document.querySelector(".data-bairro .data-field").textContent = data["Bairro"] || "-";
        document.querySelector(".data-telefone .data-field").textContent = data["Telefone"] || "-";
        document.querySelector(".data-uf .data-field").textContent = data["UF"] || "-";
        document.querySelector(".data-cep .data-field").textContent = data["CEP"] || "-";
        document.querySelector(".data-inscricao .data-field").textContent = data["Inscricao Estadual"] || "-";
    })
    .catch(error => console.error("Erro na consulta: ", error));
});

document.getElementById("atualizar").addEventListener("click", function () {
    if (confirm("Você tem certeza que quer atualizar estes dados no sistema?")) {
        const cnpjInput = document.getElementById("cnpj").value; // Mantém a formatação XX.XXX.XXX/XXXX-XX

        if (cnpjInput.length !== 18) { // Verificando se tem o formato correto
            alert("CNPJ inválido. Verifique os dados.");
            return;
        }

        // Obtendo os dados do usuário logado no sessionStorage
        const usuarioData = sessionStorage.getItem("usuario");
        if (!usuarioData) {
            alert("Usuário não autenticado! Atualização cancelada.");
            return;
        }

        const usuario = JSON.parse(usuarioData);
        const vendedor = usuario.Vendedor;

        fetch("/api/atualizar_dados", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                cnpj: cnpjInput,
                vendedor: vendedor // Enviando o Vendedor
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

document.getElementById("limpar").addEventListener("click", function(e) {
    e.preventDefault();
    
    // Limpa todos os campos de dados
    document.querySelectorAll(".data-field").forEach(field => {
      field.textContent = "";
    });
    
    // Limpa o input do CNPJ
    document.getElementById("cnpj").value = "";
    
    // Esconde o container com animação
    dataContainer.classList.remove('visible');
    dataContainer.style.display = 'none';
    
    // Foca novamente no campo de pesquisa
    document.getElementById("cnpj").focus();
  });


// PARTE COMPARTILHADA
document.addEventListener("DOMContentLoaded", function () {
    // Recupera os dados do usuário armazenados
    const usuarioData = sessionStorage.getItem("usuario");
    if (usuarioData) {
        const usuario = JSON.parse(usuarioData);
    } else {
        console.warn("Nenhum dado de usuário encontrado.");
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const menuIcon = document.getElementById("menu-icon");
    const nav = document.querySelector("nav");

    menuIcon.addEventListener("click", function () {
        nav.classList.toggle("active"); // Abre/fecha o menu ao clicar
    });

    // Fecha o menu se clicar fora dele
    document.addEventListener("click", function (event) {
        if (!nav.contains(event.target) && !menuIcon.contains(event.target)) {
            nav.classList.remove("active");
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const opcoesEstoque = document.getElementById('opcoesEstoque');
    const opcoesVendas = document.getElementById('opcoesVendas');
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));

    function verificarPermissaoEstoque() {
        if (!usuario) {
            alert('Usuário não autenticado!');
            return false;
        }
        const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
        const cargosPermitidos = ['admin', 'estoque'];
        if (!cargosPermitidos.includes(cargoNormalizado)) {
            alert('Você não tem permissão para acessar esta página!');
            return false;
        }
        return true;
    }

    function verificarPermissaoVendas() {
        if (!usuario) {
            alert('Usuário não autenticado!');
            return false;
        }
        const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
        const cargosPermitidosVendas = ['admin', 'vendedor', 'gerente', 'supervisor'];
        if (!cargosPermitidosVendas.includes(cargoNormalizado)) {
            alert('Você não tem permissão para acessar esta página!');
            return false;
        }
        return true;
    }

    function adicionarLinks(lista, links, verificarPermissao, outraLista) {
        outraLista.innerHTML = '';
        lista.innerHTML = '';
        if (!verificarPermissao()) return;

        // Adiciona o título da navegação
        lista.innerHTML = `<li class="nav-title">${lista.getAttribute("id").replace('opcoes', 'Opções de ')}</li>`;

        links.forEach(link => {
            // Se for o link /fiscal, só adiciona se o usuário for admin
            if (link.url === '/fiscal') {
                if (usuario.Cargo.trim().toLowerCase() !== 'admin') {
                    return; // Não adiciona o link para usuários que não são admin
                }
            }
            const li = document.createElement('li');
            li.innerHTML = `<a href="${link.url}">${link.icone} ${link.texto}</a>`;
            li.querySelector('a').addEventListener('click', function(e) {
                if (!verificarPermissao()) {
                    e.preventDefault();
                    lista.innerHTML = '';
                }
            });
            lista.appendChild(li);
        });
    }

    document.getElementById('estoqueLink').addEventListener('click', function (e) {
        e.preventDefault();
        adicionarLinks(opcoesEstoque, [
            { url: '/estoque', texto: 'Consulta de Estoque', icone: '📦' },
            { url: '/pedidos', texto: 'Status de Pedido', icone: '🔄' },
            { url: '/fiscal', texto: 'Perfil Fiscal V2', icone: '📋' },
        ], verificarPermissaoEstoque, opcoesVendas);
    });

    document.getElementById('vendasLink').addEventListener('click', function (e) {
        e.preventDefault();
        // Define a rota do Dashboard de Vendas conforme o cargo do usuário
        let dashboardUrl = '/';
        const cargo = usuario.Cargo.trim().toLowerCase();
        if (cargo === 'admin') {
            dashboardUrl = '/admin';
        } else if (cargo === 'gerente' || cargo === 'supervisor') {
            dashboardUrl = '/gerente';
        } else if (cargo === 'vendedor') {
            dashboardUrl = '/vendedor';
        }
        adicionarLinks(opcoesVendas, [
            { url: '/ranking', texto: 'Ranking de Vendas', icone: '📊' },
            { url: dashboardUrl, texto: 'Dashboard de Vendas', icone: '🛒' },
            { url: '/cnpj', texto: 'Consulta de CNPJ', icone: '🔎' }
        ], verificarPermissaoVendas, opcoesEstoque);
    });
});

document.addEventListener("DOMContentLoaded", function () {
    // Recupera os dados do usuário armazenados
    const usuarioData = sessionStorage.getItem("usuario");
    if (!usuarioData) {
        alert("Usuário não autenticado! Redirecionando para a página de login...");
        window.location.href = "/"; // Ajuste a URL conforme necessário
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const homeIcon = document.getElementById("home-icon");
    const exitIcon = document.getElementById("exit-icon");

    // Redirecionamento para /portal ao clicar no ícone de home
    homeIcon.addEventListener("click", function () {
        window.location.href = "/portal";
    });

    // Redirecionamento para / e limpeza do sessionStorage ao clicar no ícone de saída
    exitIcon.addEventListener("click", function () {
        sessionStorage.clear(); // Remove todas as informações do sessionStorage
        window.location.href = "/"; // Redireciona para a página inicial
    });
});