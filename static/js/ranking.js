// Função auxiliar para formatar o nome: somente a 1° letra maiúscula
function formatName(name) {
    if (!name || typeof name !== "string") return "";
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// Calcula o intervalo do mês corrente: do primeiro ao último dia do mês
function obterIntervaloDatas() {
    const now = new Date();
    const primeiroDia = new Date(now.getFullYear(), now.getMonth(), 1);
    const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0);
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
    const { data_inicio, data_fim } = obterIntervaloDatas();

    // Recupera dados do usuário (empresa, cargo, ID, Sexo)
    const usuarioData = sessionStorage.getItem("usuario");
    let usuario = {};
    if (usuarioData) {
        try {
            usuario = JSON.parse(usuarioData);
        } catch (e) {
            console.error("Erro ao parsear dados do usuário:", e);
        }
    }
    const empresa = usuario.Empresa || "5";

    const loadingAlert = document.getElementById("loading-alert");
    loadingAlert.style.display = "block";
    animarLoading();
    try {
        const response = await fetch("/api/vendas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data_inicio, data_fim, IDEMPRESA: empresa })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.erro || "Erro desconhecido ao buscar dados da API");
        }
        const vendas = await response.json();
        atualizarHorarioAtualizacao();
        atualizarFormularioUnificado(vendas);

        // Configura os dados do gráfico
        let chartLabels = [];
        let chartData = [];
        // Exibe todos os vendedores (exceto o registro TOTAL)
        vendas.forEach(v => {
            if (v.Vendedor !== "TOTAL") {
                if (usuario.Cargo === "vendedor" && v.ID_Vendedor != usuario.Vendedor) {
                    chartLabels.push("*****");
                } else {
                    chartLabels.push(formatName(v.Vendedor));
                }
                chartData.push(parseFloat(v.Valor));
            }
        });
        gerarGrafico(chartLabels, chartData);
        document.getElementById("salesChart").style.display = "block";
    } catch (error) {
        console.error("Erro ao obter vendas:", error);
        alert("Erro ao obter dados da API: " + error.message);
    } finally {
        clearInterval(loadingAnimationInterval);
        loadingAlert.style.display = "none";
    }
}

function atualizarFormularioUnificado(vendas) {
    const formulario = document.getElementById("sales-form");
    const totalForm = document.getElementById("total");
    formulario.innerHTML = `<h2>Desempenho dos Vendedores:</h2>`;
    totalForm.innerHTML = `<h2>Total:</h2>`;

    // Recupera os dados do usuário
    const usuarioData = sessionStorage.getItem("usuario");
    let usuario = {};
    if (usuarioData) {
        try {
            usuario = JSON.parse(usuarioData);
        } catch (e) {
            console.error("Erro ao parsear dados do usuário:", e);
        }
    }
    // Separa o registro TOTAL dos demais vendedores
    const totalRecord = vendas.find(v => v.Vendedor === "TOTAL");
    const vendedores = vendas.filter(v => v.Vendedor !== "TOTAL");

    // Ordena os vendedores em ordem decrescente pelo valor
    vendedores.sort((a, b) => b.Valor - a.Valor);

    vendedores.forEach((vendedor, index) => {
        const containerVendedor = document.createElement("div");
        containerVendedor.classList.add("vendedor");

        let nomeExibido = "";
        if (usuario.Cargo === "vendedor" && vendedor.ID_Vendedor != usuario.Vendedor) {
            nomeExibido = "*****";
        } else {
            nomeExibido = formatName(vendedor.Vendedor);
        }
        const titulo = document.createElement("h3");
        // Removido o rótulo " (Vendedor)" do título
        titulo.textContent = `${index + 1}° Lugar - ${nomeExibido}`;
        if (usuario.Cargo === "vendedor" && vendedor.ID_Vendedor != usuario.Vendedor) {
            titulo.style.filter = "blur(5px)";
            titulo.style.userSelect = "none";
        }
        containerVendedor.appendChild(titulo);

        const orcamentosRow = document.createElement("div");
        orcamentosRow.classList.add("row");
        orcamentosRow.innerHTML = `<span>Orçamentos:</span><span>${vendedor.Orçamentos}</span>`;
        containerVendedor.appendChild(orcamentosRow);

        const vendaRow = document.createElement("div");
        vendaRow.classList.add("row");
        vendaRow.innerHTML = `<span>Venda:</span><span>${formatarMoeda(vendedor.Valor)}</span>`;
        containerVendedor.appendChild(vendaRow);

        formulario.appendChild(containerVendedor);
    });

    // Exibe o registro TOTAL, sem repetir "TOTAL - TOTAL"
    if (totalRecord) {
        const containerTotal = document.createElement("div");
        containerTotal.classList.add("total");

        const tituloTotal = document.createElement("h3");
        tituloTotal.textContent = `TOTAL`;
        containerTotal.appendChild(tituloTotal);

        const orcamentosTotalRow = document.createElement("div");
        orcamentosTotalRow.classList.add("row");
        orcamentosTotalRow.innerHTML = `<span>Orçamentos:</span><span>${totalRecord.Orçamentos}</span>`;
        containerTotal.appendChild(orcamentosTotalRow);

        const vendaTotalRow = document.createElement("div");
        vendaTotalRow.classList.add("row");
        vendaTotalRow.innerHTML = `<span>Venda:</span><span>${formatarMoeda(totalRecord.Valor)}</span>`;
        containerTotal.appendChild(vendaTotalRow);

        totalForm.appendChild(containerTotal);
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

let chartInstance = null;
function gerarGrafico(labels, data) {
    const ctx = document.getElementById("salesChart").getContext("2d");
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Total de Vendas",
                data: data,
                backgroundColor: "#5B9BD5",
                borderColor: "#5B9BD5",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: "Total Vendas (R$)" } },
                x: { title: { display: true, text: "Vendedores" }, ticks: { font: { size: 16 } } }
            }
        }
    });
}

// Inicializa a página sem inputs manuais – tudo é definido automaticamente
document.addEventListener("DOMContentLoaded", function () {
    // Bloqueia acesso se o usuário não for supervisor, gerente ou admin
    const usuarioData = sessionStorage.getItem("usuario");
    let usuario = {};
    if (usuarioData) {
        try {
            usuario = JSON.parse(usuarioData);
        } catch (e) {
            console.error("Erro ao parsear dados do usuário:", e);
        }
    }
    if (usuario.Cargo !== "supervisor" && usuario.Cargo !== "gerente" && usuario.Cargo !== "admin") {
        alert("Acesso bloqueado: você não possui permissão para acessar esta página.");
        window.location.href = "/portal"; // Redireciona para a página inicial ou outra página de acesso negado
        return;
    }

    atualizarHorarioAtualizacao();
    obterVendas();
    setInterval(obterVendas, 900000);
});
