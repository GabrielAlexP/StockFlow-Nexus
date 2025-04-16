// Variável global para armazenar o botão de cancelamento e flag de alerta de expiração
let cancelButtonGlobal = null;
let expiredAlertShown = false;

document.addEventListener("DOMContentLoaded", function () {
    const usuarioData = sessionStorage.getItem("usuario");
    if (usuarioData) {
        window.usuario = JSON.parse(usuarioData);
    } else {
        console.warn("Nenhum dado de usuário encontrado.");
    }
});

// Funções de QR Code, busca do pedido e finalização de pagamento
let activeQrs = [];
let orderData = {};
let timerEnd = null;
let timerInterval = null;
let finalized = false;

function showNotification() {
    const notification = document.getElementById("copyNotification");
    notification.classList.remove("show");
    void notification.offsetWidth;
    notification.classList.add("show");
    setTimeout(() => {
        notification.classList.remove("show");
    }, 2900);
}

function hideNotification() {
    const notification = document.getElementById("copyNotification");
    notification.classList.remove("show");
}

function formatTime(ms) {
    let totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    totalSeconds %= 3600;
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function updateTimer() {
    if (!timerEnd) return;
    const remaining = timerEnd - Date.now();
    if (remaining <= 0) {
        document.getElementById("infoVencimento").textContent = "00:00:00";
        clearInterval(timerInterval);
        if (!expiredAlertShown) {
            alert("QR Code expirado, por favor, gere um novamente");
            document.getElementById("infoContainer").style.display = "none";
            document.getElementById("pixContainers").style.display = "none";
            expiredAlertShown = true;
        }
    } else {
        document.getElementById("infoVencimento").textContent = formatTime(remaining);
    }
}

function verificarStatusIndividual(txid, statusElement) {
    if (statusElement.textContent.trim().toUpperCase() !== "PENDENTE") {
        return;
    }
    fetch("/verificar_status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txid: txid })
    })
        .then(response => response.json())
        .then(data => {
            const currentStatus = data.status ? data.status.trim().toUpperCase() : "";
            if (currentStatus === "PAGA" || currentStatus === "CONCLUIDA") {
                statusElement.textContent = "Pago";
                statusElement.classList.remove("pendente");
                statusElement.classList.add("pago");
                activeQrs.forEach(item => { if (item.txid === txid) item.paid = true; });
                verificarStatusGlobal();
            } else {
                setTimeout(() => verificarStatusIndividual(txid, statusElement), 5000);
            }
        })
        .catch(err => {
            setTimeout(() => verificarStatusIndividual(txid, statusElement), 5000);
        });
}

function verificarStatusGlobal() {
    const allPaid = activeQrs.every(item => item.paid);
    if (allPaid && !finalized) {
        const statusBar = document.getElementById("statusBar");
        statusBar.textContent = "PAGAMENTO CONFIRMADO";
        statusBar.classList.add("pago");
        finalizePagamento();
        finalized = true;
        if (cancelButtonGlobal) {
            cancelButtonGlobal.disabled = true;
        }
    }
}

function buscarPedido() {
    const pedidoValor = document.getElementById("pedido").value;
    const searchButton = document.getElementById("searchButton");
    if (!pedidoValor) {
        alert("Por favor, insira o número do pedido.");
        return;
    }
    searchButton.disabled = true;
    const existingCancelBtn = document.getElementById("cancelQrButton");
    if (existingCancelBtn) {
        existingCancelBtn.remove();
    }
    fetch("/get_order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido: pedidoValor })
    })
        .then(response => response.json())
        .then(data => {
            searchButton.disabled = false;
            if (data.error) {
                alert(data.error);
                return;
            }
            if (data.tipoPagamentoNegado) {
                displayTipoPagamentoNegado(data.parcelas);
                return;
            }
            orderData = {
                pedido: pedidoValor,
                nome: data.nome,
                cnpjecpf: data.cnpjecpf,
                valor: data.valor,
                formaPagamento: data.formaPagamento,
                dataVenda: data.dataVenda,
                idCliente: data.IDCliente,
                OBS: data.OBS,
                Vendedor: data.Vendedor,
                empresa: window.usuario.Empresa,
                usuarioNome: window.usuario.Nome,
                parcelas: data.parcelas
            };
            document.getElementById("infoContainer").style.display = "flex";
            document.getElementById("infoPedido").textContent = pedidoValor;
            document.getElementById("infoCliente").textContent = data.nome;
            document.getElementById("infoDocumento").textContent = data.cnpjecpf;
            const valorFormatado = "R$ " + parseFloat(data.valor).toFixed(2).replace(".", ",");
            document.getElementById("infoValor").textContent = valorFormatado;
            document.getElementById("infoEmissao").textContent = new Date().toLocaleString("pt-BR");
            document.getElementById("infoVencimento").textContent = "";
            const pixContainers = document.getElementById("pixContainers");
            pixContainers.style.display = "flex";
            pixContainers.innerHTML = "";
            activeQrs = [];
            finalized = false;
            expiredAlertShown = false;
            if (timerInterval) clearInterval(timerInterval);
            gerarQRCodes(orderData);
        })
        .catch(error => {
            searchButton.disabled = false;
            console.error("Erro:", error);
            alert("Erro ao buscar o pedido.");
        });
}

function displayEstoqueNegativo(produtos) {
    let avisoContainer = document.getElementById("avisoEstoqueNegativo");
    if (!avisoContainer) {
        avisoContainer = document.createElement("div");
        avisoContainer.id = "avisoEstoqueNegativo";
        avisoContainer.style.border = "2px solid red";
        avisoContainer.style.padding = "15px";
        avisoContainer.style.margin = "20px auto";
        avisoContainer.style.maxWidth = "960px";
        avisoContainer.style.backgroundColor = "#2a1a1a";
        avisoContainer.style.color = "#ffaaaa";
        avisoContainer.style.borderRadius = "8px";
        document.body.insertBefore(avisoContainer, document.getElementById("pixContainers"));
    }
    avisoContainer.innerHTML = "";
    const header = document.createElement("h2");
    header.textContent = "Produto do pedido com saldo negativo";
    header.style.textAlign = "center";
    header.style.marginBottom = "10px";
    avisoContainer.appendChild(header);
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.marginTop = "10px";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const colunas = ["Código", "Descrição", "Estoque Atual"];
    colunas.forEach(colText => {
        const th = document.createElement("th");
        th.textContent = colText;
        th.style.border = "1px solid red";
        th.style.padding = "8px";
        th.style.backgroundColor = "#4d1a1a";
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    produtos.forEach(produto => {
        const tr = document.createElement("tr");
        const tdCodigo = document.createElement("td");
        tdCodigo.textContent = produto.IDProduto;
        tdCodigo.style.border = "1px solid red";
        tdCodigo.style.padding = "8px";
        tr.appendChild(tdCodigo);
        const tdDesc = document.createElement("td");
        tdDesc.textContent = produto["Descrição"];
        tdDesc.style.border = "1px solid red";
        tdDesc.style.padding = "8px";
        tr.appendChild(tdDesc);
        const tdEstoque = document.createElement("td");
        tdEstoque.textContent = parseFloat(produto.Estoque).toString();
        tdEstoque.style.border = "1px solid red";
        tdEstoque.style.padding = "8px";
        tr.appendChild(tdEstoque);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    avisoContainer.appendChild(table);
    pixContainers.appendChild(avisoContainer);
}

function gerarQRCodes(order) {
    fetch("/gerar_qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            pedido: order.pedido,
            nome: order.nome,
            cnpjecpf: order.cnpjecpf,
            empresa: order.empresa,
            usuarioNome: order.usuarioNome
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error("Erro da API:", data);
                alert("Erro ao gerar QR Code: " + (data.detalhes || data.error));
                return;
            }
            if (!data.qrcodes) {
                console.error("Resposta inesperada:", data);
                alert("Resposta do servidor está incompleta.");
                return;
            }
            if (data.tipoPagamentoNegado) {
                displayTipoPagamentoNegado(data.parcelas);
                return;
            }

            if (data.confirmation && data.confirmation.toLowerCase().includes("expirado")) {
                alert("QR Code expirado! Gerando um novo...");
            }
            if (data.response && data.response.vencimento) {
                const vencimentoStr = data.response.vencimento;
                timerEnd = new Date(vencimentoStr);
                updateTimer();
                timerInterval = setInterval(updateTimer, 1000);
            }
            if (data.response && data.response.emissao) {
                document.getElementById("infoEmissao").textContent = new Date(data.response.emissao).toLocaleString("pt-BR");
            }
            const pixContainers = document.getElementById("pixContainers");
            pixContainers.innerHTML = "";
            data.qrcodes.forEach((item, index) => {
                if (!item.qrcode || item.qrcode.trim() === "") return;
                const pixItem = document.createElement("div");
                pixItem.className = "pix-item";
                const pixLeft = document.createElement("div");
                pixLeft.className = "pix-left";
                const qrDiv = document.createElement("div");
                qrDiv.className = "qrcodeContainer";
                const qrCode = new QRCodeStyling({
                    width: 320,
                    height: 320,
                    data: item.qrcode,
                    margin: 10,
                    dotsOptions: { color: "#000000", type: "rounded" },
                    backgroundOptions: { color: "#ffffff" }
                });
                qrCode.append(qrDiv);
                const pixValue = document.createElement("div");
                pixValue.className = "pix-value";
                const valorExibido = item.valor
                    ? parseFloat(item.valor).toFixed(2).replace(".", ",")
                    : parseFloat(order.valor).toFixed(2).replace(".", ",");
                pixValue.textContent = "Valor: R$ " + valorExibido;
                const pixStatus = document.createElement("div");
                pixStatus.className = "pix-status pendente";
                pixStatus.textContent = "Pendente";
                pixLeft.appendChild(qrDiv);
                pixLeft.appendChild(pixValue);
                pixLeft.appendChild(pixStatus);
                const pixRight = document.createElement("div");
                pixRight.className = "pix-right";
                pixRight.innerHTML = `
            <h2>Como funciona?</h2>
            <div class="step">
              <div class="step-circle">1</div>
              <div class="step-text">Abra o app da sua instituição financeira</div>
            </div>
            <div class="step">
              <div class="step-circle">2</div>
              <div class="step-text">Localize a opção pagar com Pix</div>
            </div>
            <div class="step">
              <div class="step-circle">3</div>
              <div class="step-text">Leia o QR Code ou copie e cole o Pix, revise os dados e efetue o pagamento</div>
            </div>
          `;
                const copyContainer = document.createElement("div");
                copyContainer.className = "pix-copy-individual";
                const copyInput = document.createElement("input");
                copyInput.type = "text";
                copyInput.readOnly = true;
                copyInput.value = item.qrcode;
                const copyIcon = document.createElement("i");
                copyIcon.className = "fas fa-copy";
                copyIcon.addEventListener("click", function () {
                    const textToCopy = copyInput.value;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(textToCopy)
                            .then(() => {
                                showNotification();
                            })
                            .catch(err => {
                                console.error("Erro ao copiar com Clipboard API:", err);
                                fallbackCopyText(textToCopy);
                            });
                    } else {
                        fallbackCopyText(textToCopy);
                    }
                });
                copyContainer.appendChild(copyInput);
                copyContainer.appendChild(copyIcon);
                pixRight.appendChild(copyContainer);
                pixItem.appendChild(pixLeft);
                pixItem.appendChild(pixRight);
                pixContainers.appendChild(pixItem);
                activeQrs.push({
                    txid: item.txid,
                    paid: false,
                    valor: valorExibido,
                    idTipoPag: item.IDTipoPag,
                    parcela: index + 1,
                    statusElement: pixStatus
                });
                if (pixStatus.textContent.trim().toUpperCase() === "PENDENTE") {
                    verificarStatusIndividual(item.txid, pixStatus);
                }
            });
            let cancelButton = document.getElementById("cancelQrButton");
            if (!cancelButton) {
                cancelButton = document.createElement("button");
                cancelButton.textContent = "Cancelar QR";
                cancelButton.id = "cancelQrButton";
                cancelButton.className = "cancel-btn";
                cancelButton.addEventListener("click", function () {
                    fetch("/cancelar_qr", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pedido: order.pedido })
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.error) {
                                alert(data.error);
                            } else {
                                alert("QR Codes cancelados. Na próxima busca, serão gerados apenas os QR Codes cancelados, enquanto os pagos permanecem.");
                                document.getElementById("pixContainers").style.display = "none";
                                document.getElementById("infoContainer").style.display = "none";
                            }
                        })
                        .catch(err => {
                            console.error("Erro ao cancelar QR:", err);
                            alert("Erro ao cancelar QR Codes.");
                        });
                });
                document.querySelector('.search-wrapper').appendChild(cancelButton);
                cancelButtonGlobal = cancelButton;
            }
        })
        .catch(error => {
            console.error("Erro:", error);
            alert("Erro ao gerar os QR Codes.");
        });
}

function displayTipoPagamentoNegado(parcelas) {
    const pixContainers = document.getElementById("pixContainers");
    pixContainers.style.display = "block";
    pixContainers.innerHTML = "";
    const avisoContainer = document.createElement("div");
    avisoContainer.style.border = "2px solid red";
    avisoContainer.style.padding = "15px";
    avisoContainer.style.margin = "20px auto";
    avisoContainer.style.maxWidth = "960px";
    avisoContainer.style.backgroundColor = "#2a1a1a";
    avisoContainer.style.color = "#ffaaaa";
    avisoContainer.style.borderRadius = "8px";
    const header = document.createElement("h2");
    header.textContent = "Tipo de Pagamento negado! Essa página apenas aceita Pix";
    header.style.textAlign = "center";
    header.style.marginBottom = "10px";
    avisoContainer.appendChild(header);
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.marginTop = "10px";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const colunas = ["Parcela", "Tipo de Pagamento", "Valor"];
    colunas.forEach(colText => {
        const th = document.createElement("th");
        th.textContent = colText;
        th.style.border = "1px solid red";
        th.style.padding = "8px";
        th.style.backgroundColor = "#4d1a1a";
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    parcelas.forEach(item => {
        const tr = document.createElement("tr");
        const tdParcela = document.createElement("td");
        tdParcela.textContent = item.Parcela;
        tdParcela.style.border = "1px solid red";
        tdParcela.style.padding = "8px";
        tr.appendChild(tdParcela);
        const tdTipo = document.createElement("td");
        tdTipo.textContent = item["Descrição"];
        tdTipo.style.border = "1px solid red";
        tdTipo.style.padding = "8px";
        tr.appendChild(tdTipo);
        const tdValor = document.createElement("td");
        tdValor.textContent = parseFloat(item.Valor).toString();
        tdValor.style.border = "1px solid red";
        tdValor.style.padding = "8px";
        tr.appendChild(tdValor);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    avisoContainer.appendChild(table);
    pixContainers.appendChild(avisoContainer);
}

function fallbackCopyText(text) {
    const tempInput = document.createElement("textarea");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand("copy");
        showNotification();
    } catch (err) {
        console.error("Fallback: Não foi possível copiar o texto", err);
    }
    document.body.removeChild(tempInput);
}

function finalizePagamento() {
    const payload = {
        pedido: orderData.pedido,
        formaPagamento: orderData.formaPagamento,
        dataVenda: orderData.dataVenda,
        idCliente: orderData.idCliente,
        obs: orderData.obs,
        usuarioNome: orderData.usuarioNome,
        parcelas: activeQrs.map(item => ({
            txid: item.txid,
            comprovante: item.txid,
            valor: item.valor,
            idTipoPag: item.idTipoPag,
            parcela: item.parcela
        }))
    };
    fetch("/finalizar_pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(response => response.json())
        .then(data => {
        })
        .catch(error => {
            console.error("Erro ao finalizar pagamento:", error);
        });
}

document.getElementById("pedido").addEventListener("keydown", function (event) {
    if (event.key === "Enter") { buscarPedido(); }
});

const VERSION_HISTORY = [
    { version: '1.0.1', description: 'Bloqueio de tela em caso de pedido com estoque negativo ou tipo de pagamento diferente de pix' },
];

const versionInfo = document.getElementById('version-info');
const modalversion = document.getElementById('version-modal');
const modalBody = document.getElementById('version-modal-body');
const modalClose = document.getElementById('version-modal-close');

function populateVersionModal() {
    modalBody.innerHTML = '';
    VERSION_HISTORY.forEach((item, idx) => {
        const h3 = document.createElement('h3');
        h3.textContent = item.version;
        const p = document.createElement('p');
        p.textContent = item.description;
        modalBody.appendChild(h3);
        modalBody.appendChild(p);
        if (idx < VERSION_HISTORY.length - 1) {
            const hr = document.createElement('hr');
            modalBody.appendChild(hr);
        }
    });
}

versionInfo.addEventListener('click', () => {
    populateVersionModal();
    modalversion.style.display = 'block';
});

modalClose.addEventListener('click', () => {
    modalversion.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modalversion) {
        modalversion.style.display = 'none';
    }
});
