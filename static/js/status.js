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

document.addEventListener('DOMContentLoaded', function() {
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

        lista.innerHTML = `<li class="nav-title">${lista.getAttribute("id").replace('opcoes', 'Opções de ')}</li>`;
        links.forEach(link => {
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

    document.getElementById('estoqueLink').addEventListener('click', function(e) {
        e.preventDefault();
        adicionarLinks(opcoesEstoque, [
            { url: '/estoque', texto: 'Consulta de Estoque', icone: '📦' },
            { url: '/pedidos', texto: 'Status de Pedido', icone: '📜' }
        ], verificarPermissaoEstoque, opcoesVendas);
    });

    document.getElementById('vendasLink').addEventListener('click', function(e) {
        e.preventDefault();
        adicionarLinks(opcoesVendas, [
            { url: '/ranking', texto: 'Ranking de Vendas', icone: '📊' },
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