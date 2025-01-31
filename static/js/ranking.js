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

function obterIntervaloDiaAnterior() {
    const hoje = new Date();
    const diaAnterior = new Date(hoje);
    diaAnterior.setDate(hoje.getDate() - 1);

    const data_inicio = `${diaAnterior.getFullYear()}-${(diaAnterior.getMonth() + 1).toString().padStart(2, "0")}-${diaAnterior.getDate().toString().padStart(2, "0")} 00:00:00`;
    const data_fim = `${diaAnterior.getFullYear()}-${(diaAnterior.getMonth() + 1).toString().padStart(2, "0")}-${diaAnterior.getDate().toString().padStart(2, "0")} 23:59:59`;

    return { data_inicio, data_fim };
}

function obterIntervaloMesAtual() {
    const hoje = new Date();

    const data_inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const data_fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    console.log("Data de início do mês:", data_inicio);
    console.log("Data de fim do mês:", data_fim);

    return {
        data_inicio: `${data_inicio.getFullYear()}-${(data_inicio.getMonth() + 1).toString().padStart(2, "0")}-01 00:00:00`,
        data_fim: `${data_fim.getFullYear()}-${(data_fim.getMonth() + 1).toString().padStart(2, "0")}-${data_fim.getDate()} 23:59:59`
    };
}

async function gerarRelatorioMensal() {
    const intervalo = obterIntervaloMesAtual();

    if (!intervalo) return;

    const { data_inicio, data_fim } = intervalo;

    const empresaInput = document.getElementById("empresa-select");
    if (!empresaInput) {
        console.error("Elemento com ID 'empresa-select' não encontrado.");
        return;
    }
    const empresa = empresaInput.value;

    try {
        const vendasResponse = await fetch("/api/vendas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data_inicio, data_fim, IDEMPRESA: empresa }),
        });

        const vendas = await vendasResponse.json();

        const comissaoResponse = await fetch("/api/comissao_gerentes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data_inicio, data_fim, IDEMPRESA: empresa }),
        });

        const comissaoGerentes = await comissaoResponse.json();

        if (!comissaoGerentes.Gerentes) {
            comissaoGerentes.Gerentes = "Desconhecido";
            comissaoGerentes.Comissao_Gerente = 0;
            comissaoGerentes.Total_Bruto = 0;
            comissaoGerentes.Total_Frete = 0;
        }

        gerarPDF(vendas, comissaoGerentes, "mensal");
    } catch (error) {
        console.error("Erro ao gerar o relatório mensal:", error);
    }
}

async function gerarRelatorioDiario() {
    const intervalo = obterIntervaloDiaAnterior();

    if (!intervalo) return;

    const { data_inicio, data_fim } = intervalo;

    const empresaInput = document.getElementById("empresa-select");
    if (!empresaInput) {
        console.error("Elemento com ID 'empresa-select' não encontrado.");
        return;
    }
    const empresa = empresaInput.value;

    try {
        const vendasResponse = await fetch("/api/vendas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data_inicio, data_fim, IDEMPRESA: empresa }),
        });

        const vendas = await vendasResponse.json();

        const comissaoResponse = await fetch("/api/comissao_gerentes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data_inicio, data_fim, IDEMPRESA: empresa }),
        });

        const comissaoGerentes = await comissaoResponse.json();

        if (!comissaoGerentes.Gerentes) {
            comissaoGerentes.Gerentes = "Desconhecido";
            comissaoGerentes.Comissao_Gerente = 0;
            comissaoGerentes.Total_Bruto = 0;
            comissaoGerentes.Total_Frete = 0;
        }

        gerarPDF(vendas, comissaoGerentes, "diario");
    } catch (error) {
        console.error("Erro ao gerar o relatório diário:", error);
    }
}

async function gerarPDF(vendas, comissaoGerentes, tipoRelatorio) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const hoje = new Date();
    const diaAnterior = new Date(hoje);
    diaAnterior.setDate(hoje.getDate() - 1);

    const dataRelatorio = tipoRelatorio === "diario"
        ? `Data: ${diaAnterior.toLocaleDateString("pt-BR")}`
        : `Mês: ${hoje.toLocaleString("pt-BR", { month: "long", year: "numeric" })}`;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório de Vendas e Comissões", 105, 15, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(dataRelatorio, 10, 25);

    let y = 35;
    const lineHeight = 8;
    const col1X = 10, col2X = 90, col3X = 130, col4X = 160;

    doc.setFont("helvetica", "bold");
    doc.text("Vendedor", col1X, y);
    doc.text("Venda (R$)", col2X, y, { align: "right" });
    doc.text("Comissão (R$)", col3X, y, { align: "right" });
    doc.text("Orçamentos", col4X, y, { align: "right" });
    doc.line(10, y + 2, 200, y + 2);
    y += lineHeight;

    doc.setFont("helvetica", "normal");
    let totalVenda = 0, totalComissao = 0, totalOrcamentos = 0;

    vendas.forEach((vendedor) => {
        const venda = parseFloat(vendedor.Venda) || 0;
        const comissao = parseFloat(vendedor.Comissao) || 0;
        const orcamentos = vendedor.Orçamentos || 0;

        doc.text(vendedor.Vendedor, col1X, y);
        doc.text(venda.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), col2X, y, { align: "right" });
        doc.text(comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), col3X, y, { align: "right" });
        doc.text(orcamentos.toString(), col4X, y, { align: "right" });

        totalVenda += venda;
        totalComissao += comissao;
        totalOrcamentos += orcamentos;

        y += lineHeight;
        if (y > 270) { doc.addPage(); y = 20; }
    });

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Gerentes", col1X, y);
    doc.text("Comissão (R$)", col3X, y, { align: "right" });
    doc.line(10, y + 2, 200, y + 2);
    y += lineHeight;

    doc.setFont("helvetica", "normal");
    const gerentes = comissaoGerentes.Gerentes ? comissaoGerentes.Gerentes.split(", ") : ["Desconhecido"];
    const comissaoGerente = comissaoGerentes.Comissao_Gerente || 0;

    gerentes.forEach((gerente) => {
        doc.text(gerente, col1X, y);
        y += lineHeight;
    });

    doc.text(comissaoGerente.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), col3X, y - lineHeight, { align: "right" });

    y += 5;
    doc.line(10, y, 200, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.text("Totais", col1X, y);
    y += lineHeight;

    doc.setFont("helvetica", "normal");
    const totalBruto = comissaoGerentes.Total_Bruto || 0;
    const totalFrete = comissaoGerentes.Total_Frete || 0;

    doc.text(`Total Venda: R$ ${totalVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, col1X, y);
    y += lineHeight;
    doc.text(`Total Bruto: R$ ${totalBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, col1X, y);
    y += lineHeight;
    doc.text(`Total Frete: R$ ${totalFrete.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, col1X, y);
    y += lineHeight;
    doc.text(`Total Orçamentos: ${totalOrcamentos}`, col1X, y);
    y += lineHeight;
    doc.text(`Total Comissão: R$ ${totalComissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, col1X, y);

    const nomeArquivo = tipoRelatorio === "diario"
        ? `relatorio_diario_${diaAnterior.toLocaleDateString("pt-BR").split('/')[0]}_${diaAnterior.toLocaleDateString("pt-BR").split('/')[1]}.pdf`
        : `relatorio_mensal_${hoje.getMonth() + 1}_${hoje.getFullYear()}.pdf`;

    doc.save(nomeArquivo);
}


document.addEventListener("DOMContentLoaded", function () {
    const desejaAgendar = confirm("Deseja agendar o download dos relatórios?");
    if (desejaAgendar) {
        console.log("Agendamento ativado.");
        iniciarAgendamento();
    } else {
        console.log("Agendamento desativado.");
    }
});

function iniciarAgendamento() {
    console.log("Agendamento iniciado!");

    setInterval(() => {
        const agora = new Date();
        if (agora.getHours() === 0 && agora.getMinutes() === 0) {
            gerarRelatorioDiario();
        }
    }, 60000); 

    setInterval(() => {
        const agora = new Date();
        if (agora.getHours() === 0 && agora.getMinutes() === 0) {
            gerarRelatorioMensal();
        }
    }, 60000); 
}