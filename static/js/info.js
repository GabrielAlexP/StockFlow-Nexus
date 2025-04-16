let usuario; // Variável global para armazenar os dados do usuário

function obterIntervaloDatas() {
    const now = new Date();
    const ano = now.getFullYear();
    const mes = now.getMonth(); // 0-indexado para facilitar o cálculo
    const primeiroDia = new Date(ano, mes, 1);
    const primeiroDiaProxMes = new Date(ano, mes + 1, 1);
    const ultimoDia = new Date(primeiroDiaProxMes - 1);
    const data_inicio = `${primeiroDia.getFullYear()}-${(primeiroDia.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${primeiroDia.getDate().toString().padStart(2, "0")} 00:00:00`;
    const data_fim = `${ultimoDia.getFullYear()}-${(ultimoDia.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${ultimoDia.getDate().toString().padStart(2, "0")} 23:59:59`;
    return { data_inicio, data_fim };
}

let loadingAnimationInterval;
function animarLoading() {
    const loadingAlert = document.getElementById("loading-alert");
    const baseText = "Aguarde, carregando informações";
    let dots = 0;
    loadingAnimationInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        loadingAlert.textContent = baseText + ".".repeat(dots);
    }, 500);
}

async function obterInfos() {
    const intervalo = obterIntervaloDatas();
    if (!intervalo) return;
    const { data_inicio, data_fim } = intervalo;
    const empresa = "5"; // Empresa fixa
    if (!usuario || !usuario.Vendedor) {
        alert("Usuário não autenticado.");
        return;
    }
    const loadingAlert = document.getElementById("loading-alert");
    loadingAlert.style.display = "block";
    animarLoading();
    try {
        const response = await fetch("/api/infos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data_inicio,
                data_fim,
                IDEMPRESA: empresa,
                usuario: usuario.Vendedor,
                cargo: usuario.Cargo
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.erro || "Erro desconhecido ao buscar dados da API");
        }
        const infosData = await response.json();
        atualizarHorarioAtualizacao();

        const totalRealizadas = infosData.realizadas && infosData.realizadas.total ? infosData.realizadas.total : { TotalVenda: 0, TotalComissao: 0, Orçamentos: 0, Lucro: 0 };
        const totalPendentes = infosData.pendentes && infosData.pendentes.total ? infosData.pendentes.total : { TotalVenda: 0, TotalComissao: 0, Orçamentos: 0, Lucro: 0 };

        atualizarFormularioUnificado(totalRealizadas, totalPendentes);

        const diarias = infosData.realizadas && infosData.realizadas.diarias ? infosData.realizadas.diarias : [];
        const labels = diarias.map(item => {
            let dateStr = item.Dia;
            if (dateStr) {
                dateStr = dateStr.split(" ")[0];
                const parts = dateStr.split("-");
                if (parts.length === 3) {
                    const [year, month, day] = parts;
                    return `${day}/${month}/${year}`;
                }
                return dateStr;
            }
            return "";
        });
        const data = diarias.map(item => parseFloat(item.TotalVenda));
        gerarGrafico(labels, data);

        let sold = parseFloat(totalRealizadas.TotalVenda || 0);
        obterMeta(sold);

        document.getElementById("salesChart").style.display = "block";
        document.getElementById("sales-form").style.display = "block";
    } catch (error) {
        console.error("Erro ao obter infos:", error);
        alert("Erro ao obter dados da API: " + error.message);
    } finally {
        clearInterval(loadingAnimationInterval);
        loadingAlert.style.display = "none";
    }
}

function atualizarHorarioAtualizacao() {
    const lastAttDiv = document.querySelector("#last-att");
    if (lastAttDiv) {
        const agora = new Date();
        const horarioFormatado = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        lastAttDiv.textContent = `Última atualização: ${horarioFormatado}`;
    }
}

function formatarMoeda(valor) {
    return parseFloat(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function atualizarFormularioUnificado(realizadas, pendentes) {
    const formulario = document.getElementById("sales-form");
    const sexo = usuario.Sexo.toLowerCase();
    const nomeFormatado = usuario.Nome.charAt(0).toUpperCase() + usuario.Nome.slice(1).toLowerCase();
    const headerText = sexo === "feminino"
        ? `Desempenho da Vendedora ${nomeFormatado}`
        : `Desempenho do Vendedor ${nomeFormatado}`;
    formulario.innerHTML = `<h2>${headerText}:</h2>`;

    if (realizadas) {
        const boxRealizadas = document.createElement("div");
        boxRealizadas.classList.add("vendedor");
        const tituloRealizadas = document.createElement("h3");
        tituloRealizadas.textContent = "Venda realizada";
        boxRealizadas.appendChild(tituloRealizadas);

        const vendaRow = document.createElement("div");
        vendaRow.classList.add("row");
        vendaRow.innerHTML = `<span>Venda:</span><span>${formatarMoeda(realizadas.TotalVenda)}</span>`;
        boxRealizadas.appendChild(vendaRow);

        const pedidosRow = document.createElement("div");
        pedidosRow.classList.add("row");
        pedidosRow.innerHTML = `<span>Pedidos:</span><span>${realizadas.Orçamentos}</span>`;
        boxRealizadas.appendChild(pedidosRow);

        let comissaoValor;
        if (["supervisor", "gerente"].includes(usuario.Cargo.toLowerCase()) && realizadas.Comissao_Venda !== undefined) {
            comissaoValor = realizadas.Comissao_Venda;
        } else {
            comissaoValor = realizadas.TotalComissao;
        }
        const comissaoRow = document.createElement("div");
        comissaoRow.classList.add("row");
        comissaoRow.innerHTML = `<span>Comissão:</span><span>${formatarMoeda(comissaoValor)}</span>`;
        boxRealizadas.appendChild(comissaoRow);

        formulario.appendChild(boxRealizadas);
    } else {
        formulario.innerHTML += `<p>Nenhum dado de vendas realizadas encontrado.</p>`;
    }

    if (pendentes) {
        const boxPendentes = document.createElement("div");
        boxPendentes.classList.add("vendedor");
        const tituloPendentes = document.createElement("h3");
        tituloPendentes.textContent = "Orçamento em negociação";
        boxPendentes.appendChild(tituloPendentes);

        const vendaRowP = document.createElement("div");
        vendaRowP.classList.add("row");
        vendaRowP.innerHTML = `<span>Venda:</span><span>${formatarMoeda(pendentes.TotalVenda)}</span>`;
        boxPendentes.appendChild(vendaRowP);

        const pedidosRowP = document.createElement("div");
        pedidosRowP.classList.add("row");
        pedidosRowP.innerHTML = `<span>Pedidos:</span><span>${pendentes.Orçamentos}</span>`;
        boxPendentes.appendChild(pedidosRowP);

        const cargoLower = usuario.Cargo.toLowerCase();
        if (!["supervisor", "gerente"].includes(cargoLower)) {
            const comissaoRowP = document.createElement("div");
            comissaoRowP.classList.add("row");
            comissaoRowP.innerHTML = `<span>Comissão:</span><span>${formatarMoeda(pendentes.TotalComissao)}</span>`;
            boxPendentes.appendChild(comissaoRowP);
        }
        formulario.appendChild(boxPendentes);
    } else {
        formulario.innerHTML += `<p>Nenhum dado de orçamentos pendentes encontrado.</p>`;
    }

    if (!["admin", "gerente", "supervisor"].includes(usuario.Cargo.toLowerCase())) {
        const boxMeta = document.createElement("div");
        boxMeta.classList.add("vendedor");
        const tituloMeta = document.createElement("h3");
        tituloMeta.textContent = "Objetivo";
        boxMeta.appendChild(tituloMeta);

        const metaChartContainer = document.createElement("div");
        metaChartContainer.style.display = "flex";
        metaChartContainer.style.flexDirection = "column";
        metaChartContainer.style.alignItems = "center";
        metaChartContainer.style.marginTop = "10px";
        metaChartContainer.innerHTML = `<canvas id="metaChart" style="width: 280px; height: 280px;"></canvas>
                                        <div id="metaMessage" style="text-align: center; font-size: 1rem; color: #3cb371; margin-top: 5px;"></div>`;
        boxMeta.appendChild(metaChartContainer);
        formulario.appendChild(boxMeta);
    }
}

let chartInstance = null;
function gerarGrafico(labels, data) {
    const ctx = document.getElementById("salesChart").getContext("2d");
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Valor das Vendas (R$)",
                data: data,
                backgroundColor: "#5B9BD5",
                borderColor: "#5B9BD5",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (tooltipItem) {
                            return formatarMoeda(tooltipItem.parsed.y);
                        }
                    }
                },
                legend: {
                    display: true,
                    position: "bottom"
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Valor das Vendas (R$)" }
                },
                x: {
                    title: { display: true, text: "Dias" },
                    ticks: { font: { size: 12 } }
                }
            }
        }
    });
}

let chartMetaInstance = null;
function gerarMetaChart(sold, metaVal) {
    const ctx = document.getElementById("metaChart").getContext("2d");
    if (chartMetaInstance) chartMetaInstance.destroy();

    let gap = metaVal - sold;
    let message = "";
    let dataSet = [];
    let backgroundColors = [];

    if (gap > 0) {
        dataSet = [sold, gap];
        backgroundColors = ["#5B9BD5", "#FF0000"];
        message = `Falta <span style="font-weight: bold; font-size: 18px; color: #ffffff;">${formatarMoeda(gap)}</span> para bater a meta`;
    } else {
        dataSet = [metaVal, 0];
        backgroundColors = ["#5B9BD5", "#FF0000"];
        message = "Parabéns, você bateu a meta";
    }

    const labels = ["Vendido", "Meta"];
    const centerLabelsPlugin = {
        id: 'centerLabelsPlugin',
        afterDatasetsDraw: function (chart) {
            const ctx = chart.ctx;
            const meta = chart.getDatasetMeta(0);
            meta.data.forEach(function (arc, index) {
                const pos = arc.tooltipPosition();
                let text;
                if (index === 0) {
                    const percentVendido = metaVal > 0 ? (sold / metaVal * 100).toFixed(1) : 0;
                    text = percentVendido + '%';
                    ctx.font = 'normal 14px sans-serif';
                    ctx.fillStyle = '#FF0000';
                } else {
                    const percentMeta = metaVal > 0 ? ((metaVal - sold) / metaVal * 100).toFixed(1) : 0;
                    text = percentMeta + '%';
                    ctx.font = 'bold 16px sans-serif';
                    ctx.fillStyle = '#0000FF';
                }
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, pos.x, pos.y);
            });
        }
    };

    chartMetaInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: dataSet,
                backgroundColor: backgroundColors
            }]
        },
        options: {
            responsive: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || "";
                            if (label) {
                                label += ": ";
                            }
                            label += formatarMoeda(context.parsed);
                            return label;
                        }
                    }
                },
                legend: {
                    display: true,
                    position: "bottom"
                }
            }
        },
        plugins: [centerLabelsPlugin]
    });

    const metaMessageDiv = document.getElementById("metaMessage");
    if (metaMessageDiv) {
        metaMessageDiv.innerHTML = message;
    }
}

async function obterMeta(sold) {
    const empresa = "5";
    try {
        const response = await fetch("/api/meta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                IDEMPRESA: empresa,
                usuario: usuario.Vendedor
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.erro || "Erro desconhecido ao buscar meta");
        }
        const metaData = await response.json();
        if (metaData.meta) {
            const metaVal = parseFloat(metaData.meta.Meta);
            gerarMetaChart(sold, metaVal);
        } else {
            const metaMessageDiv = document.getElementById("metaMessage");
            if (metaMessageDiv) {
                metaMessageDiv.textContent = "Meta não definida para este período";
            }
        }
    } catch (error) {
        console.error("Erro ao obter meta:", error);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const usuarioData = sessionStorage.getItem("usuario");
    if (!usuarioData) {
        window.location.href = "/";
        return;
    }
    usuario = JSON.parse(usuarioData);
    atualizarHorarioAtualizacao();
    obterInfos();
    setInterval(obterInfos, 900000);
});
