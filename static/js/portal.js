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
            { url: '/ranking', texto: 'Ranking de Vendas', icone: '📊' }
        ], verificarPermissaoVendas, opcoesEstoque);
    });
});

document.addEventListener("DOMContentLoaded", function () {
    const usuarioData = sessionStorage.getItem("usuario");

    if (!usuarioData) {
        window.location.href = "/";
        return;
    }

    const usuario = JSON.parse(usuarioData);

    const nomeFormatado = usuario.Nome.charAt(0).toUpperCase() + usuario.Nome.slice(1).toLowerCase();
    const pronome = usuario.Sexo.toLowerCase() === "feminino" ? "a" : "o";

    document.getElementById("conteudo").innerHTML = `<h2>Seja bem-vind${pronome} ao portal de acesso, ${nomeFormatado}!</h2>
                                                      <p>Selecione uma opção na barra de navegação.</p>`;

    document.getElementById("cargoUsuario").textContent = usuario.Cargo.charAt(0).toUpperCase() + usuario.Cargo.slice(1).toLowerCase();
});
