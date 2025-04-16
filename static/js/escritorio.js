document.addEventListener("DOMContentLoaded", () => {
    // Validação de usuário
    const usuarioData = sessionStorage.getItem("usuario");
    if (!usuarioData) {
        window.location.href = "/";
        return;
    }
    const usuario = JSON.parse(usuarioData);
    if (usuario.Cargo !== "admin") {
        window.location.href = "/portal";
        return;
    }

    // Elementos do DOM
    const tipoSelect = document.getElementById("tipo-select");
    const monthSelect = document.getElementById("month-select");
    const yearInput = document.getElementById("year-input");
    const empresaSelect = document.getElementById("empresa-select");
    const loadingAlert = document.getElementById("loading-alert");
    const salesChartEl = document.getElementById("salesChart");
    const salesFormEl = document.getElementById("sales-form");
    const totalEl = document.getElementById("total");

    // Animação de loading
    function animarLoading() {
        const baseText = "Aguarde, carregando informações";
        let dots = 0;
        loadingAlert.textContent = baseText;
        loadingAlert.style.display = "block";
        return setInterval(() => {
            dots = (dots + 1) % 4;
            loadingAlert.textContent = baseText + ".".repeat(dots);
        }, 500);
    }

    // Calcula intervalo de datas conforme tipo
    function obterIntervaloDatas() {
        const tipo = tipoSelect.value || "mensal";
        const ano = parseInt(yearInput.value, 10) || new Date().getFullYear();
        if (ano < 2000 || ano > 2100) return {};

        let data_inicio, data_fim;

        if (tipo === "mensal") {
            const mes = parseInt(monthSelect.value, 10);
            const primeiro = new Date(ano, mes - 1, 1);
            const ultimo = new Date(ano, mes, 0);
            data_inicio = `${ano}-${String(mes).padStart(2, "0")}-01 00:00:00`;
            data_fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")} 23:59:59`;

        } else if (tipo === "trimestral") {
            const tri = parseInt(monthSelect.value, 10);
            const startMonth = (tri - 1) * 3;
            const endMonth = startMonth + 2;
            const primeiro = new Date(ano, startMonth, 1);
            const ultimo = new Date(ano, endMonth + 1, 0);
            data_inicio = `${ano}-${String(primeiro.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
            data_fim = `${ano}-${String(ultimo.getMonth() + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")} 23:59:59`;

        } else if (tipo === "semestral") {
            const sem = parseInt(monthSelect.value, 10);
            const startMonth = sem === 1 ? 0 : 6;
            const endMonth = sem === 1 ? 5 : 11;
            const primeiro = new Date(ano, startMonth, 1);
            const ultimo = new Date(ano, endMonth + 1, 0);
            data_inicio = `${ano}-${String(primeiro.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
            data_fim = `${ano}-${String(ultimo.getMonth() + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")} 23:59:59`;

        } else if (tipo === "anual") {
            data_inicio = `${ano}-01-01 00:00:00`;
            data_fim = `${ano}-12-31 23:59:59`;
        }

        return { data_inicio, data_fim };
    }

    // Função principal de obtenção de dados
    async function obterVendas() {
        const { data_inicio, data_fim } = obterIntervaloDatas();
        const empresa = empresaSelect.value;
        if (!empresa) {
            alert("Por favor, selecione uma empresa.");
            return;
        }

        const loadingInterval = animarLoading();

        try {
            const resp = await fetch("/api/vendas_escritorio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data_inicio, data_fim, IDEMPRESA: empresa })
            });
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Status ${resp.status}: ${text}`);
            }
            const vendas = await resp.json();

            atualizarHorarioAtualizacao();
            atualizarFormularioUnificado(vendas);

            const labels = vendas
                .filter(v => v.Vendedor.toUpperCase() !== "TOTAL")
                .map(v => v.Vendedor);
            const data = vendas
                .filter(v => v.Vendedor.toUpperCase() !== "TOTAL")
                .map(v => parseFloat(v.Valor));

            gerarGrafico(labels, data);

            salesChartEl.style.display = "block";
            salesFormEl.style.display = "block";
            totalEl.style.display = "block";

        } catch (err) {
            alert("Erro ao obter dados da API: " + err.message);
        } finally {
            clearInterval(loadingInterval);
            loadingAlert.style.display = "none";
        }
    }

    // Atualiza o formulário com os dados de vendas
    function atualizarFormularioUnificado(vendas) {
        salesFormEl.innerHTML = `<h2>Desempenho dos Vendedores:</h2>`;
        totalEl.innerHTML = `<h2>Total:</h2>`;

        // Normaliza valores
        vendas.forEach(v => {
            v.Valor = v.Valor ? parseFloat(v.Valor) : 0;
            v.Lucro = v.Lucro ? parseFloat(v.Lucro) : 0;
            v.Comissao_Venda = v.Comissao_Venda ? parseFloat(v.Comissao_Venda) : 0;
            v.Orçamentos = v.Orçamentos ? parseInt(v.Orçamentos, 10) : 0;
        });

        const registros = vendas.filter(r => r.Vendedor.toUpperCase() !== "TOTAL");
        registros.sort((a, b) => b.Valor - a.Valor);

        // Totais por cargo
        let totais = {
            vendedor: { venda: 0, comissao: 0, orc: 0, lucro: 0 },
            representante: { venda: 0, comissao: 0, orc: 0, lucro: 0 },
            supervisor: { venda: 0, comissao: 0, orc: 0, lucro: 0 },
            gerente: { venda: 0, comissao: 0, orc: 0, lucro: 0 },
        };

        registros.forEach((reg, idx) => {
            // Cria container de registro
            const div = document.createElement("div");
            div.classList.add("registro-venda", "vendedor");

            // Título com checkbox de blur
            const tituloCtn = document.createElement("div");
            tituloCtn.style.display = "flex";
            tituloCtn.style.justifyContent = "space-between";

            const cargo = reg.Cargo || "";
            const h3 = document.createElement("h3");
            h3.textContent = `${cargo.charAt(0).toUpperCase() + cargo.slice(1)} ${reg.Vendedor} - ${idx + 1}º Lugar`;

            const chkCtn = document.createElement("div");
            chkCtn.classList.add("checkbox-container");
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.classList.add("blur-toggle");
            chk.addEventListener("change", () => div.classList.toggle("blur", chk.checked));
            chkCtn.appendChild(chk);

            tituloCtn.append(h3, chkCtn);
            div.appendChild(tituloCtn);

            // Linhas de dados
            const rows = [
                { label: "Venda:", value: formatarMoeda(reg.Valor) },
                { label: "Lucro:", value: `${formatarMoeda(reg.Lucro)} - ${((reg.Lucro / reg.Valor) * 100 || 0).toFixed(2)}%` },
                { label: "Orçamentos:", value: reg.Orçamentos },
                { label: "Comissão:", value: formatarMoeda(reg.Comissao_Venda) }
            ];
            rows.forEach(r => {
                const row = document.createElement("div");
                row.classList.add("row");
                row.innerHTML = `<span>${r.label}</span><span>${r.value}</span>`;
                div.appendChild(row);
            });

            salesFormEl.appendChild(div);

            // Acumula nos totais
            const key = cargo.toLowerCase();
            if (totais[key]) {
                totais[key].venda += reg.Valor;
                totais[key].comissao += reg.Comissao_Venda;
                totais[key].orc += reg.Orçamentos;
                totais[key].lucro += reg.Lucro;
            }
        });

        // Função para criar resumo de cada cargo
        function criarResumo(titulo, t) {
            const c = document.createElement("div");
            c.classList.add("resumo");
            const hdr = document.createElement("div");
            hdr.style.display = "flex";
            hdr.style.justifyContent = "space-between";
            const h3 = document.createElement("h3");
            h3.textContent = titulo;
            const chkCtn = document.createElement("div");
            chkCtn.classList.add("checkbox-container");
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.classList.add("blur-toggle");
            chk.addEventListener("change", () => c.classList.toggle("blur", chk.checked));
            chkCtn.appendChild(chk);
            hdr.append(h3, chkCtn);
            c.appendChild(hdr);

            const pct = t.venda ? (t.lucro / t.venda) * 100 : 0;
            const items = [
                { label: "Venda:", value: formatarMoeda(t.venda) },
                { label: "Lucro:", value: `${formatarMoeda(t.lucro)} - ${pct.toFixed(2)}%` },
                { label: "Orçamentos:", value: t.orc },
                { label: "Comissão:", value: formatarMoeda(t.comissao) }
            ];
            items.forEach(r => {
                const row = document.createElement("div");
                row.classList.add("row");
                row.innerHTML = `<span>${r.label}</span><span>${r.value}</span>`;
                c.appendChild(row);
            });
            return c;
        }

        // Adiciona os resumos por cargo
        totalEl.appendChild(criarResumo("Total Vendedores:", totais.vendedor));
        totalEl.appendChild(criarResumo("Total Representantes:", totais.representante));
        totalEl.appendChild(criarResumo("Total Supervisores:", totais.supervisor));
        totalEl.appendChild(criarResumo("Total Gerentes:", totais.gerente));

        // Resumo geral
        const geral = {
            venda: Object.values(totais).reduce((s, o) => s + o.venda, 0),
            comissao: Object.values(totais).reduce((s, o) => s + o.comissao, 0),
            orc: Object.values(totais).reduce((s, o) => s + o.orc, 0),
            lucro: Object.values(totais).reduce((s, o) => s + o.lucro, 0),
        };
        totalEl.appendChild(criarResumo("Total Geral:", geral));
    }

    // Atualiza o horário de última atualização
    function atualizarHorarioAtualizacao() {
        const last = document.getElementById("last-att");
        if (last) {
            const now = new Date();
            last.textContent = `Última atualização: ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
        }
    }

    // Ajusta mês e ano para o atual
    function ajustarMesEAno() {
        const now = new Date();
        monthSelect.value = now.getMonth() + 1;
        yearInput.value = now.getFullYear();
    }

    // Atualiza opções do segundo select conforme tipo
    function atualizarSelectSegundo() {
        const tipo = tipoSelect.value;
        let html = "";
        if (tipo === "mensal") {
            monthSelect.style.display = "inline-block";
            html = `
                <option value="1">Janeiro</option>
                <option value="2">Fevereiro</option>
                <option value="3">Março</option>
                <option value="4">Abril</option>
                <option value="5">Maio</option>
                <option value="6">Junho</option>
                <option value="7">Julho</option>
                <option value="8">Agosto</option>
                <option value="9">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>`;
            monthSelect.value = new Date().getMonth() + 1;
        } else if (tipo === "trimestral") {
            monthSelect.style.display = "inline-block";
            html = `
                <option value="1">1° Trimestre</option>
                <option value="2">2° Trimestre</option>
                <option value="3">3° Trimestre</option>
                <option value="4">4° Trimestre</option>`;
            monthSelect.value = "1";
        } else if (tipo === "semestral") {
            monthSelect.style.display = "inline-block";
            html = `
                <option value="1">1° Semestre</option>
                <option value="2">2° Semestre</option>`;
            monthSelect.value = "1";
        } else if (tipo === "anual") {
            monthSelect.style.display = "none";
        }
        monthSelect.innerHTML = html;
    }

    // Formatação de moeda
    function formatarMoeda(v) {
        return parseFloat(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    // Geração do gráfico com Chart.js
    let chartInstance = null;
    function gerarGrafico(labels, data) {
        const ctx = salesChartEl.getContext("2d");
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Total de Vendas",
                    data,
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
                        title: { display: true, text: "Total Vendas (R$)" },
                    },
                    x: {
                        title: { display: true, text: "Vendedores" },
                        ticks: { font: { size: 28 } },
                    },
                },
            },
        });
    }

    // Liga eventos
    tipoSelect.addEventListener("change", () => {
        atualizarSelectSegundo();
        obterVendas();
    });
    monthSelect.addEventListener("change", obterVendas);
    yearInput.addEventListener("input", obterVendas);
    empresaSelect.addEventListener("change", obterVendas);

    // Inicializações
    atualizarSelectSegundo();
    ajustarMesEAno();
    atualizarHorarioAtualizacao();
    obterVendas();
    setInterval(obterVendas, 900000);
});