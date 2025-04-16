document.addEventListener("DOMContentLoaded", function () {
    // Carrega dados do usuário e armazena em window.usuario
    const usuarioData = sessionStorage.getItem("usuario");
    if (usuarioData) {
        window.usuario = JSON.parse(usuarioData);
    } else {
        console.warn("Nenhum dado de usuário encontrado.");
    }

    // --- INÍCIO: Verificação de horário de trabalho ---
    (function verificarHorarioTrabalho() {
        if (!window.usuario || !window.usuario.Cargo) return;

        const cargo = window.usuario.Cargo.trim().toLowerCase();
        const now = new Date();
        const hour = now.getHours(); // 0–23

        // se for entre 18h (inclusive) e 6h (exclusive) e não for admin
        if ((hour >= 18 || hour < 6) && cargo !== 'admin') {
            alert('Tempo de trabalho excedido. Volte no horário de expediente!');
            window.location.href = '/';
        }
    })();
    // --- FIM: Verificação de horário de trabalho ---

    // Menu responsivo (para mobile)
    const menuIcon = document.getElementById("menu-icon");
    const nav = document.querySelector("nav");

    if (menuIcon) {
        menuIcon.addEventListener("click", function () {
            nav.classList.toggle("active");
        });
    }

    document.addEventListener("click", function (event) {
        if (!nav.contains(event.target) && (!menuIcon || !menuIcon.contains(event.target))) {
            nav.classList.remove("active");
        }
    });

    // Lógica dos menus (Estoque, Vendas, Admin e Cadastro)
    const opcoesCadastro = document.getElementById("opcoesCadastro");
    const opcoesEstoque = document.getElementById("opcoesEstoque");
    const opcoesVendas = document.getElementById("opcoesVendas");
    const opcoesAdmin = document.getElementById("opcoesAdmin");
    const usuario = window.usuario || JSON.parse(usuarioData);

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
        if (!["admin", "vendedor", "gerente", "supervisor", "caixa"].includes(cargoNormalizado)) {
            alert("Você não tem permissão para acessar esta página!");
            return false;
        }
        return true;
    }

    function verificarPermissaoAdmin() {
        if (!usuario) {
            alert("Usuário não autenticado!");
            return false;
        }
        const cargoNormalizado = usuario.Cargo.trim().toLowerCase();
        if (cargoNormalizado !== "admin") {
            alert("Você não tem permissão para acessar esta página!");
            return false;
        }
        return true;
    }

    function verificarPermissaoCadastro() {
        // apenas admin
        return verificarPermissaoAdmin();
    }

    function adicionarLinks(lista, links, verificarPermissao, outraLista) {
        if (outraLista) outraLista.innerHTML = "";
        lista.innerHTML = "";
        if (!verificarPermissao()) return;

        lista.innerHTML = `<li class="nav-title">${lista.id.replace("opcoes", "Opções de ")}</li>`;
        links.forEach(link => {
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

    // Evento para o menu Cadastro
    document.getElementById("cadastroLink").addEventListener("click", function (e) {
        e.preventDefault();
        opcoesEstoque.innerHTML = "";
        opcoesVendas.innerHTML = "";
        opcoesAdmin.innerHTML = "";
        adicionarLinks(opcoesCadastro, [
            { url: "/cad_usuario", texto: "Usuários", icone: "👤" },
            { url: "/cad_cargos", texto: "Cargos", icone: "🏷️" },
            { url: "/cad_clientes", texto: "Clientes", icone: "🧑‍🤝‍🧑" },
            { url: "/cad_fornecedor", texto: "Fornecedor", icone: "🏭" },
            { url: "/cad_produto", texto: "Produto", icone: "📦" },
            { url: "/cad_transportadora", texto: "Transportadora", icone: "🚚" },
            { url: "/cad_marca", texto: "Marca", icone: "🔖" },
            { url: "/cad_classe", texto: "Classe", icone: "🗂️" },
            { url: "/cad_subclasse", texto: "Subclasse", icone: "📑" },
            { url: "/cad_subgrupo", texto: "Subgrupo", icone: "🔗" },
            { url: "/cad_forma_de_pagamento", texto: "Forma de Pagamento", icone: "💳" },
            { url: "/cad_tipo_de_pagamento", texto: "Tipo de Pagamento", icone: "💰" },
            { url: "/cad_contas", texto: "Contas (do banco)", icone: "🏦" },
            { url: "/cad_bandeiras", texto: "Bandeiras", icone: "🏳️" },
            { url: "/cad_propaganda", texto: "Propaganda", icone: "📢" },
            { url: "/cad_indicador_de_presenca", texto: "Indicador de Presença", icone: "📍" },
            { url: "/cad_combo", texto: "Combo", icone: "🎁" },
            { url: "/cad_empresa", texto: "Empresa", icone: "🏢" }
        ], verificarPermissaoCadastro, opcoesCadastro);
    });

    // Evento para o menu Estoque
    document.getElementById("estoqueLink").addEventListener("click", function (e) {
        e.preventDefault();
        opcoesCadastro.innerHTML = "";
        opcoesVendas.innerHTML = "";
        opcoesAdmin.innerHTML = "";
        adicionarLinks(opcoesEstoque, [
            { url: "/estoque", texto: "Consulta de Estoque", icone: "📦" },
            { url: "/pedidos", texto: "Status de Pedido", icone: "🔄" },
            { url: "/venda", texto: "Relatório de Vendas", icone: "🗂️" },
            { url: "/entrega", texto: "Ger. Entregas", icone: "📩" }
        ], verificarPermissaoEstoque, opcoesEstoque);
    });

    // Evento para o menu Vendas
    document.getElementById("vendasLink").addEventListener("click", function (e) {
        e.preventDefault();
        opcoesCadastro.innerHTML = "";
        opcoesEstoque.innerHTML = "";
        opcoesAdmin.innerHTML = "";
        adicionarLinks(opcoesVendas, [
            { url: "/info", texto: "Informação de Progresso", icone: "🛒" },
            { url: "/ranking", texto: "Ranking da Empresa", icone: "📊" },
            { url: "/cnpj", texto: "Consulta de CNPJ", icone: "🔎" },
            { url: "/pix", texto: "Pix", icone: "💸" }
        ], verificarPermissaoVendas, opcoesVendas);
    });

    // Evento para o menu Admin
    document.getElementById("adminLink").addEventListener("click", function (e) {
        e.preventDefault();
        opcoesCadastro.innerHTML = "";
        opcoesEstoque.innerHTML = "";
        opcoesVendas.innerHTML = "";
        adicionarLinks(opcoesAdmin, [
            { url: "/fiscal", texto: "Perfil Fiscal V2", icone: "📋" },
            { url: "/produtos", texto: "Atualizar Preço", icone: "🛒" },
            { url: "/meta", texto: "Meta dos Vendedores", icone: "📶" },
            { url: "/admin", texto: "Dashboard de Vendas", icone: "🛒" },
            { url: "/escritorio", texto: "Ranking Escritório", icone: "🏢" }
        ], verificarPermissaoAdmin, opcoesAdmin);
    });

    // Redireciona para a página de login se não houver usuário
    if (!usuarioData) {
        alert("Usuário não autenticado! Redirecionando para a página de login...");
        window.location.href = "/";
    }

    // Eventos dos ícones do header: Home e Sair (log out)
    const homeIcon = document.getElementById("home-icon");
    const exitIcon = document.getElementById("exit-icon");

    if (homeIcon) {
        homeIcon.addEventListener("click", function () {
            window.location.href = "/portal";
        });
    }

    if (exitIcon) {
        exitIcon.addEventListener("click", function () {
            sessionStorage.clear();
            window.location.href = "/";
        });
    }
});
