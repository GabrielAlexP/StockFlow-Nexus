let graficoBarras = null;
let graficoRosca = null;

document.getElementById('metas').addEventListener('change', function () {
    const metasSelecionada = this.value;

    if (metasSelecionada === "diaria" || metasSelecionada === "mensal") {
        carregarDados(); // Atualiza os dados para as metas diária e mensal
    }

    // Lógica para exibir as opções personalizadas (trimestral/semestral)
    const personalizado = document.getElementById('personalizado');
    if (!personalizado) {
        console.error("Elemento 'personalizado' não encontrado!");
        return;
    }

    personalizado.innerHTML = ""; // Limpa as opções anteriores
    if (metasSelecionada === "trimestral") {
        personalizado.innerHTML = `
            <option value="1trimestre">1° Trimestre</option>
            <option value="2trimestre">2° Trimestre</option>
            <option value="3trimestre">3° Trimestre</option>
            <option value="4trimestre">4° Trimestre</option>
        `;
        personalizado.style.display = "block";
    } else if (metasSelecionada === "semestral") {
        personalizado.innerHTML = `
            <option value="1semestre">1° Semestre</option>
            <option value="2semestre">2° Semestre</option>
        `;
        personalizado.style.display = "block";
    } else {
        personalizado.style.display = "none";
    }

    personalizado.addEventListener('change', function () {
        atualizarMeta(metasSelecionada); // Atualiza com o período selecionado
    });

    // Força uma atualização inicial da meta com o primeiro período disponível
    atualizarMeta(metasSelecionada);
});



let vendaTotalAtual = 0;

function atualizarMeta(metasSelecionada) {
    const empresa = document.getElementById('empresa').value;
    const anoSelecionado = document.getElementById('ano').value;
    const vendedor = document.getElementById('vendedor-selecao').value;

    if (metasSelecionada === "trimestral" || metasSelecionada === "semestral") {
        const personalizado = document.getElementById('personalizado');
        const periodoSelecionado = personalizado.value;

        fetch(`/api/meta?empresa=${empresa}&vendedor=${vendedor}&tipo_meta=${metasSelecionada}&periodo=${periodoSelecionado}&ano=${anoSelecionado}`)
            .then(response => response.json())
            .then(data => {
                console.log("Dados recebidos do backend:", JSON.stringify(data, null, 2));

                const meta = parseFloat(data.meta || 0);
                const totalVendasPeriodo = parseFloat(data.total_vendas || 0);
                vendaTotalAtual = totalVendasPeriodo; // Atualiza a variável global

                const mensagemMeta = data.mensagem_meta || `Falta ${formatarMoeda(meta - vendaTotalAtual)} para alcançar a meta`;

                // Atualiza os elementos da página
                document.getElementById('meta').innerText = formatarMoeda(meta);
                atualizarVendaTotal(vendaTotalAtual);
                document.getElementById('mensagem-meta').innerText = mensagemMeta;

                gerarGraficos(data.datas || [], data.valores || [], vendaTotalAtual, meta);
            })
            .catch(error => console.error("Erro ao carregar metas:", error));
    }
}


function atualizarVendedores() {
    const empresaSelecionada = document.getElementById('empresa').value;

    // Fazendo a solicitação para buscar vendedores ativos
    fetch(`/api/vendedores?empresa=${empresaSelecionada}&obs=Vendedor, gerente`)
        .then(response => response.json())
        .then(data => {
            const vendedorSelect = document.getElementById('vendedor-selecao');
            vendedorSelect.innerHTML = ''; // Limpa as opções atuais

            // Adiciona a opção padrão "Total"
            const optionTotal = document.createElement('option');
            optionTotal.value = 'Total';
            optionTotal.textContent = 'Total';
            vendedorSelect.appendChild(optionTotal);

            // Adiciona vendedores retornados pela API
            data.forEach(vendedor => {
                const option = document.createElement('option');
                option.value = vendedor.codigo;
                option.textContent = vendedor.nome;
                vendedorSelect.appendChild(option);
            });

            carregarDados(); // Recarrega os dados ao atualizar os vendedores
        })
        .catch(error => console.error('Erro ao carregar vendedores:', error));
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function carregarDados() {
    // Zera os valores exibidos antes de buscar novos dados
    document.getElementById('orcamentos').innerText = 0;
    atualizarVendaTotal(0); // Exibe 0 no campo de vendas
    document.getElementById('lucro-total').innerText = formatarMoeda(0);
    document.getElementById('meta').innerText = formatarMoeda(0);
    document.getElementById('mensagem-meta').innerText = "Nenhuma meta disponível.";
    document.getElementById('mensagem-venda').innerText = "Nenhuma venda registrada.";
    gerarGraficos([], [], 0, 0); // Zera os gráficos

    // Lógica de carregamento dos dados da API
    const empresa = document.getElementById('empresa').value;
    const vendedor = document.getElementById('vendedor-selecao').value; // Vendedor dinâmico
    const mesSelecionado = document.getElementById('mes').value;
    const anoSelecionado = document.getElementById('ano').value;
    const metaSelecionada = document.getElementById('metas').value || "mensal";

    const metaDiaria = document.getElementById('meta-diaria');

    if (mesSelecionado === "hoje") {
        metaDiaria.style.display = 'block';
    } else {
        metaDiaria.style.display = 'none';
        if (metaSelecionada === "diaria") {
            document.getElementById('metas').value = "mensal";
        }
    }

    // Captura o estado do botão toggle (Status)
    const status = document.getElementById('status-toggle').checked ? 'S' : 'V';  // 'S' para Orçamentos, 'V' para Vendas

    fetch(`/api/vendas?empresa=${empresa}&vendedor=${vendedor}&mes=${mesSelecionado}&ano=${anoSelecionado}&meta_tipo=${metaSelecionada}&status=${status}`)
        .then(response => response.json())
        .then(data => {
            if (data) {
                const numeroOrcamentos = data.numero_orcamentos || 0;
                const vendaTotalAtualLocal = data.venda_total ? parseFloat(data.venda_total) : 0; // Redefine venda total para 0 se não houver valor
                const lucroTotal = data.lucro_total ? parseFloat(data.lucro_total) : 0;
                const meta = data.meta ? parseFloat(data.meta) : 0;

                // Atualiza os elementos da página
                document.getElementById('orcamentos').innerText = numeroOrcamentos;
                atualizarVendaTotal(vendaTotalAtualLocal);
                document.getElementById('lucro-total').innerText = formatarMoeda(lucroTotal);
                document.getElementById('meta').innerText = formatarMoeda(meta);

                document.getElementById('mensagem-meta').innerText = data.mensagem_meta || `Falta ${formatarMoeda(meta - vendaTotalAtualLocal)} para alcançar a meta`;
                document.getElementById('mensagem-venda').innerText = `Você já vendeu ${formatarMoeda(vendaTotalAtualLocal)}`;

                gerarGraficos(data.datas || [], data.valores || [], vendaTotalAtualLocal, meta);
            } else {
                console.error("Erro: Dados não encontrados.");
            }
        })
        .catch(error => {
            console.error("Erro ao carregar dados:", error);
        });
}


function atualizarVendaTotal(valor) {
    document.getElementById('mensagem-venda').innerText = `Você já vendeu ${formatarMoeda(valor)} no período selecionado`;
    const vendaTotalElemento = document.getElementById('vendas-total');
    if (vendaTotalElemento) {
        vendaTotalElemento.innerText = formatarMoeda(valor);
    } else {
        console.error('Elemento de venda total não encontrado');
    }
}


// Função para formatar os valores de moeda
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Função para gerar gráficos (caso seja necessário)
function gerarGraficos(datas, valores, vendaTotal, meta) {
    // Adicione o código para gerar os gráficos conforme sua implementação
}


function ajustarCanvas() {
    const canvasBarras = document.getElementById('grafico-barras');
    canvasBarras.width = canvasBarras.offsetWidth;
    canvasBarras.height = canvasBarras.offsetHeight;

    const canvasRosca = document.getElementById('grafico-rosca');
    canvasRosca.width = canvasRosca.offsetWidth;
    canvasRosca.height = canvasRosca.offsetHeight;
}

window.addEventListener('resize', ajustarCanvas);

// Referência ao toggle
const statusToggle = document.getElementById('status-toggle');

// Função que será chamada sempre que o toggle mudar
statusToggle.addEventListener('change', function() {
    let status = statusToggle.checked ? 'S' : 'V'; // 'S' para Orçamentos, 'V' para Vendas

    // Atualiza os dados de acordo com o status
    console.log("Status atualizado para:", status);
    carregarDados();  // Aqui você recarrega os dados após o toggle
});

// Função para carregar dados com base no status
function carregarDadosComStatus(status) {
    // Aqui você pode implementar a lógica para passar o status para a API ou para a lógica do seu dashboard
    console.log(`Carregando dados para o status: ${status}`);

    // Exemplo: se for 'V', carrega vendas, se for 'S', carrega orçamentos
    if (status === 'V') {
        console.log('Carregando dados de vendas...');
        // Chame a função que carrega os dados de vendas
    } else if (status === 'S') {
        console.log('Carregando dados de orçamentos...');
        // Chame a função que carrega os dados de orçamentos
    }
}


function gerarGraficos(labels, valores, vendaTotal, meta) {
    ajustarCanvas();

    const ctxBarras = document.getElementById('grafico-barras').getContext('2d');
    const ctxRosca = document.getElementById('grafico-rosca').getContext('2d');

    const agrupadosPorDia = labels.reduce((acc, label, index) => {
        acc[label] = (acc[label] || 0) + parseFloat(valores[index]);
        return acc;
    }, {});

    const diasUnicos = Object.keys(agrupadosPorDia).sort();
    const valoresPorDia = diasUnicos.map(dia => agrupadosPorDia[dia]);

    if (graficoBarras) graficoBarras.destroy();

    graficoBarras = new Chart(ctxBarras, {
        type: 'bar',
        data: {
            labels: diasUnicos,
            datasets: [{
                label: 'Vendas por Dia',
                data: valoresPorDia,
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: { display: true, text: 'Dias do Mês' },
                    ticks: {
                        callback: function (value) {
                            const rawLabel = this.getLabelForValue(value);
                            const [ano, mes, dia] = rawLabel.split('-');
                            return `${dia}/${mes}`;
                        }
                    }
                },
                y: {
                    title: { display: true, text: 'Valor (' },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: tooltipItems => {
                            const rawLabel = tooltipItems[0].label;
                            const [ano, mes, dia] = rawLabel.split('-');
                            return `${dia}/${mes}/${ano}`;
                        },
                        label: context => formatarMoeda(context.raw)
                    }
                },
                legend: { display: false }
            },
            layout: { padding: { top: 20, bottom: 20, left: 20, right: 20 } },
            hover: { mode: 'nearest', intersect: true }
        }
    });

    if (graficoRosca) graficoRosca.destroy();

    graficoRosca = new Chart(ctxRosca, {
        type: 'doughnut',
        data: {
            labels: ['Venda Total', 'Meta Restante'],
            datasets: [{
                data: [vendaTotal, meta - vendaTotal],
                backgroundColor: ['#36A2EB', '#FF6384']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'top' }
            }
        }
    });
}
document.getElementById('empresa').addEventListener('change', atualizarVendedores);
document.getElementById('vendedor-selecao').addEventListener('change', carregarDados);
document.getElementById('mes').addEventListener('change', carregarDados);
document.getElementById('ano').addEventListener('change', carregarDados);

document.getElementById('buscar-pedido').addEventListener('click', buscarPedido);
document.getElementById('busca-pedido').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        buscarPedido();
    }
});

function buscarPedido() {
    const pedido = document.getElementById('busca-pedido').value;

    if (!pedido) {
        alert('Por favor, insira um número de pedido.');
        return;
    }

    fetch(`/api/pedido/${pedido}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Pedido não encontrado ou erro no servidor.');
            }
            return response.json();
        })
        .then(data => {
            console.log("Dados recebidos:", data);

            // Formatar data no formato DD/MM/YYYY
            const formatarData = dataISO => {
                if (!dataISO) return 'Não disponível';
                const [ano, mes, dia] = dataISO.split('-');
                return `${dia}/${mes}/${ano}`;
            };

            // Exibição dos dados
            const tabelaPedidos = document.getElementById('tabela-corpo');
            tabelaPedidos.innerHTML = `
                <tr>
                    <td>${data.pedido}</td>
                    <td>${data.nome_cliente || data.cliente}</td>
                    <td><span>${formatarMoeda(data.valor_total || 0)}</span></td>
                    <td>${formatarData(data.data_venda)}</td>
                </tr>`;

            const tabelaProdutos = document.getElementById('produtos-corpo');
            tabelaProdutos.innerHTML = data.produtos.map(produto => {
                const valorUnitario = produto.valor_unitario || 0;
                const quantidade = produto.quantidade || 0;
                return `
                    <tr>
                        <td>${produto.id_produto || produto.codigo}</td>
                        <td>${produto.descricao || 'Sem descrição'}</td>
                        <td>${formatarQuantidade(quantidade)}</td>
                        <td><span>${formatarMoeda(valorUnitario)}</span></td>
                        <td><span>${formatarMoeda(quantidade * valorUnitario)}</span></td>
                    </tr>`;
            }).join('');
        })
        .catch(error => {
            console.error('Erro ao buscar pedido:', error);
            alert('Erro ao buscar o pedido. Tente novamente.');
        });
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarQuantidade(quantidade) {
    quantidade = Number(quantidade); // Converte para número
    return quantidade % 1 === 0 ? quantidade.toFixed(0) : quantidade.toFixed(2).replace(/\.0+$/, '');
}


window.onload = () => {
    atualizarVendedores();
    ajustarCanvas();
};