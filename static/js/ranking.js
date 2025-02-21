function obterIntervaloDatas() {
    const monthSelect = document.getElementById("month-select");
    const yearInput = document.getElementById("year-input");

    const mes = parseInt(monthSelect.value || "1", 10); 
    const ano = parseInt(yearInput.value || new Date().getFullYear(), 10);

    if (isNaN(mes) || isNaN(ano) || ano < 2000 || ano > 2100) {
        console.error("Mês ou ano inválido.");
        return null;
    }

    const primeiroDia = new Date(ano, mes - 1, 1);
    const ultimoDia = new Date(ano, mes, 0); 

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

async function obterVendas() {
    const intervalo = obterIntervaloDatas();

    if (!intervalo) {
        return; 
    }

    const { data_inicio, data_fim } = intervalo;

    const empresaSelect = document.getElementById("empresa-select");
    const empresa = empresaSelect.value || "5";

    if (!empresa) {
        alert("Por favor, selecione uma empresa.");
        return;
    }

    const loadingAlert = document.getElementById("loading-alert");
    loadingAlert.style.display = "block";
    animarLoading();

    try {
        const response = await fetch("/api/vendas", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ data_inicio, data_fim, IDEMPRESA: empresa }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.erro || "Erro desconhecido ao buscar dados da API");
        }

        const vendas = await response.json();

        atualizarHorarioAtualizacao();

        atualizarFormularioUnificado(vendas);

        const labels = vendas.map(vendedor => vendedor.Vendedor);
        const data = vendas.map(vendedor => parseFloat(vendedor.Venda));

        gerarGrafico(labels, data);

        document.getElementById("salesChart").style.display = "block";
        document.getElementById("sales-form").style.display = "block";
        document.getElementById("total").style.display = "block";
    } catch (error) {
        console.error("Erro ao obter vendas:", error);
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

function inicializarHorarioAtualizacao() {
    const lastAttDiv = document.querySelector("#last-att");
    if (lastAttDiv) {
        const agora = new Date();
        const horarioFormatado = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        lastAttDiv.textContent = `Última atualização: ${horarioFormatado}`;
    }
}

document.getElementById("month-select").addEventListener("change", obterVendas);
document.getElementById("year-input").addEventListener("input", obterVendas);
document.getElementById("empresa-select").addEventListener("change", obterVendas);

inicializarHorarioAtualizacao();
obterVendas();

setInterval(obterVendas, 900000);

function ajustarMesEAno() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const monthSelect = document.getElementById("month-select");
    monthSelect.value = currentMonth;

    const yearInput = document.getElementById("year-input");
    yearInput.value = currentYear;
}

document.addEventListener("DOMContentLoaded", function() {
    ajustarMesEAno();
    obterVendas();
});


function formatarMoeda(valor) {
    return parseFloat(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function atualizarFormularioUnificado(vendas) {
    const formulario = document.getElementById("sales-form");
    const totalForm = document.getElementById("total");

    formulario.innerHTML = `<h2>Desempenho dos Vendedores:</h2>`;
    totalForm.innerHTML = `<h2>Total:</h2>`; 

    let totalVenda = 0;
    let totalComissao = 0;

    vendas.sort((a, b) => b.Venda - a.Venda);

    vendas.forEach((vendedor, index) => {
        const containerVendedor = document.createElement("div");
        containerVendedor.classList.add("vendedor");

        const titulo = document.createElement("h3");
        titulo.textContent = `Vendedor ${vendedor.Vendedor} - ${index + 1}º Lugar`;
        containerVendedor.appendChild(titulo);

        const vendaRow = document.createElement("div");
        vendaRow.classList.add("row");
        vendaRow.innerHTML = `
            <span>Venda:</span>
            <span>${formatarMoeda(vendedor.Venda)}</span>
        `;
        containerVendedor.appendChild(vendaRow);

        const comissaoRow = document.createElement("div");
        comissaoRow.classList.add("row");
        comissaoRow.innerHTML = `
            <span>Comissão:</span>
            <span>${formatarMoeda(vendedor.Comissao)}</span>
        `;
        containerVendedor.appendChild(comissaoRow);

        formulario.appendChild(containerVendedor);

        totalVenda += parseFloat(vendedor.Venda);
        totalComissao += parseFloat(vendedor.Comissao);
    });

    const totalVendaRow = document.createElement("div");
    totalVendaRow.classList.add("row");
    totalVendaRow.innerHTML = `
        <span>Total de Vendas:</span>
        <span>${formatarMoeda(totalVenda)}</span>
    `;
    totalForm.appendChild(totalVendaRow);

    const totalComissaoRow = document.createElement("div");
    totalComissaoRow.classList.add("row");
    totalComissaoRow.innerHTML = `
        <span>Total de Comissões:</span>
        <span>${formatarMoeda(totalComissao)}</span>
    `;
    totalForm.appendChild(totalComissaoRow);
}

let chartInstance = null;

function gerarGrafico(labels, data) {
    const ctx = document.getElementById("salesChart").getContext("2d");

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Total de Vendas",
                data: data,
                backgroundColor: "#5B9BD5",
                borderColor: "#5B9BD5",
                borderWidth: 1,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Total Vendas (R$)",
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: "Vendedores",
                    },
                    ticks: {
                        font: {
                            size: 16,
                        },
                    },
                },
            },
        },
    });
}