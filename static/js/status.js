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
