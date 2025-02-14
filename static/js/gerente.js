let vendaTotalAtual = 0;

function atualizarMeta(metasSelecionada) {
    const empresa = sessionStorage.getItem('IDEmpresa'); // Pegando a empresa do sessionStorage
    const anoSelecionado = document.getElementById('ano').value;
    const vendedor = document.getElementById('vendedor-selecao').value;

    if (metasSelecionada === "trimestral" || metasSelecionada === "semestral") {
        const personalizado = document.getElementById('personalizado');
        const periodoSelecionado = personalizado.value;

        if (!periodoSelecionado) {
            console.error('Nenhum período foi selecionado!');
            return;
        }

        fetch(`/api/meta?empresa=${empresa}&ano=${anoSelecionado}&vendedor=${vendedor}&tipo_meta=${metasSelecionada}&periodo=${periodoSelecionado}`)
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

function atualizarVendaTotal(valor) {
    document.getElementById('mensagem-venda').innerText = `Você já vendeu ${formatarMoeda(valor)} no período selecionado`;
    const vendaTotalElemento = document.getElementById('vendas-total');
    if (vendaTotalElemento) {
        vendaTotalElemento.innerText = formatarMoeda(valor);
    } else {
        console.error('Elemento de venda total não encontrado');
    }
}

let graficoBarras = null;
let graficoRosca = null;

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function atualizarVendedores() {
    const empresa = sessionStorage.getItem('IDEmpresa');

    fetch(`/api/vendedores?empresa=${empresa}&obs=Vendedor, gerente`)
        .then(response => response.json())
        .then(data => {
            const vendedorSelect = document.getElementById('vendedor-selecao');
            vendedorSelect.innerHTML = '';

            const optionTotal = document.createElement('option');
            optionTotal.value = 'Total';
            optionTotal.textContent = 'Total';
            vendedorSelect.appendChild(optionTotal);

            data.forEach(vendedor => {
                const option = document.createElement('option');
                option.value = vendedor.codigo;
                option.textContent = vendedor.nome;
                vendedorSelect.appendChild(option);
            });

            carregarDados();
        })
        .catch(error => console.error('Erro ao carregar vendedores:', error));
}

document.getElementById('metas').addEventListener('change', function () {
    const metasSelecionada = this.value;
    const personalizado = document.getElementById('personalizado');

    // Limpa as opções e redefine a exibição do dropdown personalizado
    personalizado.style.display = "none";
    personalizado.innerHTML = "";

    if (metasSelecionada === "trimestral") {
        personalizado.style.display = "block";
        personalizado.innerHTML = `
            <option value="1trimestre">1° Trimestre</option>
            <option value="2trimestre">2° Trimestre</option>
            <option value="3trimestre">3° Trimestre</option>
            <option value="4trimestre">4° Trimestre</option>
        `;
    } else if (metasSelecionada === "semestral") {
        personalizado.style.display = "block";
        personalizado.innerHTML = `
            <option value="1semestre">1° Semestre</option>
            <option value="2semestre">2° Semestre</option>
        `;
    }

    // Adiciona evento para o dropdown de períodos personalizados
    personalizado.addEventListener('change', function () {
        atualizarMeta(metasSelecionada);
    });

    // Atualiza a meta para o primeiro valor disponível do dropdown
    if (personalizado.options.length > 0) {
        personalizado.value = personalizado.options[0].value;
        atualizarMeta(metasSelecionada);
    }
});

document.getElementById('metas').addEventListener('change', function() {
    const metaSelecionada = document.getElementById('metas').value;
    
    // Só chama carregarDados se a meta for "mensal" ou "diaria"
    if (metaSelecionada === 'mensal' || metaSelecionada === 'diaria') {
        carregarDados();  // Chama a função carregarDados ao alterar para meta mensal ou diaria
    }
});

window.onload = () => {
    atualizarVendedores();

    document.getElementById('vendedor-selecao').addEventListener('change', carregarDados);
    document.getElementById('mes').addEventListener('change', carregarDados);
    document.getElementById('ano').addEventListener('change', carregarDados);
    document.getElementById('status-toggle').addEventListener('change', carregarDados);
};

function carregarDados() {
    const empresa = sessionStorage.getItem('IDEmpresa');
    const vendedor = document.getElementById('vendedor-selecao').value;
    const mesSelecionado = document.getElementById('mes').value;
    const anoSelecionado = document.getElementById('ano').value;
    const metaSelecionada = document.getElementById('metas').value || "mensal";
    const periodoSelecionado = document.getElementById('personalizado').value || "";

    const status = document.getElementById('status-toggle').checked ? 'S' : 'V';

    const metaDiaria = document.getElementById('meta-diaria');

    if (mesSelecionado === "hoje") {
        metaDiaria.style.display = 'block';
    } else {
        metaDiaria.style.display = 'none';
        if (metaSelecionada === "diaria") {
            document.getElementById('metas').value = "mensal";
        }
    }

    fetch(`/api/vendas?empresa=${empresa}&vendedor=${vendedor}&mes=${mesSelecionado}&ano=${anoSelecionado}&meta_tipo=${metaSelecionada}&periodo=${periodoSelecionado}&status=${status}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('orcamentos').innerText = data.numero_orcamentos || 0;
            document.getElementById('vendas-total').innerText = formatarMoeda(data.venda_total || 0);
            document.getElementById('lucro-total').innerText = formatarMoeda(data.lucro_total || 0);
            document.getElementById('meta').innerText = formatarMoeda(data.meta || 0);

            document.getElementById('mensagem-meta').innerText = data.mensagem_meta || `Falta ${formatarMoeda(data.meta - data.venda_total)} para alcançar a meta`;
            document.getElementById('mensagem-venda').innerText = `Você já vendeu ${formatarMoeda(data.venda_total || 0)}`;

            gerarGraficos(data.datas || [], data.valores || [], data.venda_total || 0, data.meta || 0);
        })
        .catch(error => console.error('Erro ao carregar dados:', error));
}

// Atualizando gerarGraficos para lógica aprimorada
function gerarGraficos(labels, valores, vendaTotal, meta) {
    const ctxBarras = document.getElementById('grafico-barras').getContext('2d');
    const ctxRosca = document.getElementById('grafico-rosca').getContext('2d');

    // Agrupando vendas por dia e ignorando horas
    const agrupadosPorDia = labels.reduce((acc, label, index) => {
        const dataSemHora = label.split('T')[0]; // Remove a hora do timestamp
        acc[dataSemHora] = (acc[dataSemHora] || 0) + parseFloat(valores[index]);
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
                    title: { display: true, text: 'Valor (R$)' },
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
                data: [vendaTotal, Math.max(0, meta - vendaTotal)],
                backgroundColor: ['#36A2EB', '#FF6384']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${formatarMoeda(value)}`;
                        }
                    }
                }
            }
        }
    });
}


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

function formatarQuantidade(quantidade) {
    quantidade = Number(quantidade); // Converte para número
    return quantidade % 1 === 0 ? quantidade.toFixed(0) : quantidade.toFixed(2).replace(/\.0+$/, '');
}