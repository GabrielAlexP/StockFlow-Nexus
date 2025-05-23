// Função para formatar o telefone conforme o padrão: (XX) XXXXX-XXXX para 11 dígitos e (XX) XXXX-XXXX para 10 dígitos
function formatPhone(input) {
    let phone = input.value.replace(/\D/g, '');
    if (phone.length <= 10) {
        phone = phone.substring(0, 10);
        if (phone.length >= 6) {
            input.value = '(' + phone.substring(0, 2) + ') ' + phone.substring(2, 6) + '-' + phone.substring(6);
        } else if (phone.length >= 2) {
            input.value = '(' + phone.substring(0, 2) + ') ' + phone.substring(2);
        } else {
            input.value = '(' + phone;
        }
    } else {
        phone = phone.substring(0, 11);
        if (phone.length >= 7) {
            input.value = '(' + phone.substring(0, 2) + ') ' + phone.substring(2, 7) + '-' + phone.substring(7);
        } else if (phone.length >= 2) {
            input.value = '(' + phone.substring(0, 2) + ') ' + phone.substring(2);
        } else {
            input.value = '(' + phone;
        }
    }
}

// Permite apenas números no CPF
function isNumberKey(evt) {
    var charCode = (evt.which) ? evt.which : evt.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57))
        return false;
    return true;
}

function formatCPF(input) {
    let cpf = input.value.replace(/\D/g, '');
    cpf = cpf.substring(0, 11);
    if (cpf.length > 9) {
        cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
    } else if (cpf.length > 6) {
        cpf = cpf.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    } else if (cpf.length > 3) {
        cpf = cpf.replace(/(\d{3})(\d+)/, '$1.$2');
    }
    input.value = cpf;
}

function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) {
        return false;
    }
    if (/^(\d)\1{10}$/.test(cpf)) {
        return false;
    }
    let soma = 0;
    let pesos1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 9; i++) {
        soma += cpf[i] * pesos1[i];
    }
    let resto1 = soma % 11;
    let digito1 = (resto1 < 2) ? 0 : 11 - resto1;
    soma = 0;
    let pesos2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 10; i++) {
        soma += cpf[i] * pesos2[i];
    }
    let resto2 = soma % 11;
    let digito2 = (resto2 < 2) ? 0 : 11 - resto2;
    return (cpf[9] == digito1 && cpf[10] == digito2);
}

function validateSignatureInputs() {
    const nome = document.getElementById("responsavel-nome").value.trim();
    const telefone = document.getElementById("responsavel-telefone").value.trim();
    const cpf = document.getElementById("responsavel-cpf").value.trim();
    const confirmBtn = document.getElementById("confirm-signature");
    const cpfError = document.getElementById("cpf-error");
    const telefoneError = document.getElementById("telefone-error");

    // Validação do CPF
    let digits = cpf.replace(/\D/g, '');
    let cpfValido = false;
    if (digits.length === 11) {
        cpfValido = validarCPF(cpf);
    }
    cpfError.style.display = (digits.length === 11 && !cpfValido) ? "block" : "none";

    // Validação do telefone (excluindo o DDD)
    let phoneDigits = telefone.replace(/\D/g, '');
    let phoneValid = true;
    if (phoneDigits.length > 2) {
        let localPart = phoneDigits.substring(2); // Remove o DDD (primeiros 2 dígitos)
        // Se todos os dígitos da parte local forem iguais, exibe o erro.
        if (localPart.split('').every(d => d === localPart[0])) {
            telefoneError.style.display = "block";
            phoneValid = false;
        } else {
            telefoneError.style.display = "none";
        }
    } else {
        telefoneError.style.display = "none";
    }

    // Habilita o botão somente se todos os campos forem válidos.
    if (nome !== "" && telefone !== "" && cpf !== "" && digits.length === 11 && cpfValido && phoneValid) {
        confirmBtn.disabled = false;
    } else {
        confirmBtn.disabled = true;
    }
}

let signatureData = null;

// Recupera o objeto usuário do sessionStorage e armazena o IDEmpresa e Nome do usuário em variáveis globais
const usuarioData = sessionStorage.getItem("usuario");
const usuario = usuarioData ? JSON.parse(usuarioData) : {};
window.empresaId = usuario.Empresa || "";
window.conferidoPor = usuario.Nome || "";

function mostrarFormulario() {
    document.getElementById('resultado').style.display = 'block';
    document.getElementById('btn-wrapper').style.display = 'block';
}

// Função para habilitar/desabilitar o select do vendedor
function toggleSelect() {
    const checkbox = document.getElementById('enable-select');
    const select = document.getElementById('vendedor-select');
    select.disabled = !checkbox.checked;

    if (checkbox.checked) {
        fetch(`/vendedores?empresa=${window.empresaId}`)
            .then(response => response.json())
            .then(data => {
                select.innerHTML = "<option value=''>Vendedor:</option>";
                data.forEach(seller => {
                    const option = document.createElement('option');
                    option.value = seller.ID_Vendedor;
                    option.textContent = seller.LogON;
                    select.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Erro ao buscar vendedores:', error);
            });
    } else {
        select.innerHTML = "<option>Vendedor:</option>";
    }
}

// Função para selecionar uma linha da tabela
function selectRow(row) {
    document.querySelectorAll('.result-table tbody tr').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');

    const status = row.cells[3].textContent.trim();
    const btn = document.getElementById('btn-gerar-entrega');
    if (status === "Liberado" || status === "Entregue Part.") {
        btn.disabled = false;
        btn.classList.remove('disabled');
    } else {
        btn.disabled = true;
        btn.classList.add('disabled');
    }
}

function formatDate(dateStr) {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
}

// Função para gerar a entrega
function gerarEntrega() {
    const selectedRow = document.querySelector('.result-table tr.selected');
    if (!selectedRow) {
        alert("Por favor, selecione um pedido");
        return;
    }

    const status = selectedRow.cells[3].textContent.trim();
    if (status !== "Liberado" && status !== "Entregue Part.") {
        alert("O pedido selecionado não está liberado para entrega.");
        return;
    }

    const pedido = selectedRow.cells[0].textContent.trim();
    fetch(`/modal_detalhes?pedido=${pedido}&empresa=${window.empresaId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            const modalTbody = document.getElementById('modal-table-body');
            modalTbody.innerHTML = "";

            data.forEach(item => {
                const allowed = item.Quantidade - item.QtdEntregue;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.IDProduto}</td>
                    <td>${item["Descrição"]}</td>
                    <td>${formatNumber(item.Quantidade)}</td>
                    <td>${formatNumber(item.QtdEntregue)}</td>
                    <td><input type="number" placeholder="Informe a quantidade" data-idproduto="${item.IDProduto}" data-max="${allowed}" min="0" max="${allowed}" value="0" /></td>
                `;
                modalTbody.appendChild(tr);
            });

            modalTbody.querySelectorAll('input[type="number"]').forEach(input => {
                input.addEventListener('input', function () {
                    const max = parseFloat(this.getAttribute('max'));
                    if (parseFloat(this.value) > max) {
                        this.value = max;
                    }
                });
            });

            document.querySelectorAll('input[name="entrega-type"]').forEach(radio => {
                radio.addEventListener('change', function () {
                    if (this.value === 'tudo') {
                        modalTbody.querySelectorAll('input[type="number"]').forEach(input => {
                            input.value = input.getAttribute('max');
                        });
                    } else if (this.value === 'parte') {
                        modalTbody.querySelectorAll('input[type="number"]').forEach(input => {
                            input.value = 0;
                        });
                    }
                });
            });

            document.getElementById('modal').style.display = 'block';
            carregarTransportadoras();
        })
        .catch(error => {
            console.error("Erro ao buscar detalhes:", error);
            alert("Erro ao buscar detalhes da entrega.");
        });
}

// Função para formatar números
function formatNumber(num) {
    const n = parseFloat(num);
    if (isNaN(n)) return num;
    return (n % 1 === 0) ? n.toString() : n.toFixed(1).replace('.', ',');
}

// Função para fechar o modal de assinatura e limpar o canvas
function closeSignatureModal() {
    clearSignature();
    document.getElementById("signature-modal").style.display = "none";
}

// Função para fechar o modal de entrega
function closeModal() {
    document.getElementById("modal").style.display = "none";
}

// Função para gravar a entrega
function gravarEntrega() {
    let hasItem = false;
    let allDelivered = true;
    const modalTableRows = document.querySelectorAll('#modal-table-body tr');

    modalTableRows.forEach(tr => {
        const qtdInput = tr.querySelector('input[type="number"]');
        if (qtdInput) {
            const max = parseFloat(qtdInput.getAttribute('data-max'));
            const delivered = parseFloat(qtdInput.value);
            if (delivered > 0) {
                hasItem = true;
            }
            if (delivered < max) {
                allDelivered = false;
            }
        }
    });

    if (!hasItem) {
        alert("É necessário ter pelo menos uma unidade em um item.");
        return;
    }

    if (!signatureData) {
        alert("Por favor, assine antes de confirmar a entrega.");
        openSignatureModal();
        return;
    }

    // Define a situação com base na verificação:
    const situacao = allDelivered ? 'Entregue' : 'Entregue Part.';

    const selectedRow = document.querySelector('.result-table tr.selected');
    if (!selectedRow) {
        alert("Por favor, selecione um pedido");
        return;
    }

    const pedido = selectedRow.cells[0].textContent.trim();
    const idCliente = selectedRow.getAttribute('data-idcliente');
    if (!idCliente) {
        alert("IDCliente não encontrado no pedido selecionado");
        return;
    }

    // Obtém os dados da transportadora
    const transportadoraSelect = document.getElementById("transportadora-select");
    const transportadoraID = transportadoraSelect ? transportadoraSelect.value : "";
    const transportadoraNome = transportadoraSelect ? transportadoraSelect.options[transportadoraSelect.selectedIndex].text : "";

    const responsavelNome = document.getElementById("responsavel-nome").value.trim();
    const responsavelTelefone = document.getElementById("responsavel-telefone").value.trim();
    const responsavelCpf = document.getElementById("responsavel-cpf").value.trim();

    const produtos = [];
    modalTableRows.forEach(tr => {
        const codigo = tr.cells[0].textContent.trim();
        const descricao = tr.cells[1].textContent.trim();
        const qtdInput = tr.querySelector('input[type="number"]');
        const qtd = qtdInput ? qtdInput.value : 0;
        produtos.push({ codigo, descricao, qtd });
    });

    // Cria o payload com a variável 'situacao' e o IDEmpresa
    const dataPayload = {
        situacao: situacao,
        idCliente: idCliente,
        pedido: pedido,
        produtos: produtos,
        assinatura: signatureData,
        responsavel_nome: responsavelNome,
        responsavel_telefone: responsavelTelefone,
        responsavel_cpf: responsavelCpf,
        conferido_por: window.conferidoPor,
        transportadora: transportadoraID,
        transportadora_nome: transportadoraNome,
        empresa: window.empresaId
    };

    fetch('/gerar_pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataPayload)
    })
        .then(response => {
            if (!response.ok) {
                console.warn("Resposta não OK, mas tentando processar o PDF mesmo assim.");
            }
            return response.blob();
        })
        .then(blob => {
            if (blob.size === 0) {
                throw new Error("PDF gerado está vazio.");
            }
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            closeModal();
            closeSignatureModal();
            pesquisar();
            signatureData = null;
        })
        .catch(error => {
            console.error("Erro ao gerar PDF:", error);
        });
}

window.onclick = function (event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }

    const signatureModal = document.getElementById('signature-modal');
    if (event.target === signatureModal) {
        closeSignatureModal();
    }
};

function pesquisar() {
    const filtroSelecionado = document.querySelector('input[name="search-type"]:checked');
    if (!filtroSelecionado) {
        alert("Por favor, selecione um filtro");
        return;
    }

    const filtro = filtroSelecionado.value;
    const valorBusca = document.querySelector('.search-bar input[type="text"]').value.trim();
    if (!valorBusca) {
        alert("Por favor, informe um valor para a pesquisa");
        return;
    }

    const vendedorSelect = document.getElementById('vendedor-select');
    let vendedorParam = "";
    if (!vendedorSelect.disabled && vendedorSelect.value) {
        vendedorParam = vendedorSelect.value;
    }

    let url = `/pesquisar?filtro=${filtro}&valor=${encodeURIComponent(valorBusca)}&empresa=${window.empresaId}`;
    if (vendedorParam) {
        url += `&vendedor=${vendedorParam}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            document.getElementById('resultado').style.display = 'block';
            document.getElementById('btn-wrapper').style.display = 'block';

            const tbody = document.querySelector('.result-table tbody');
            tbody.innerHTML = "";

            if (data.length === 0) {
                tbody.innerHTML = "<tr><td colspan='5'>Nenhum resultado encontrado.</td></tr>";
            } else {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.setAttribute('data-idcliente', item.IDCliente);
                    tr.onclick = function () { selectRow(tr); };
                    tr.innerHTML = `
                        <td>${item.Pedido}</td>
                        <td>${item.NomeCliente}</td>
                        <td>${formatDate(item.DataVenda)}</td>
                        <td>${item.Situação}</td>
                        <td>${item.Vendedor}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        })
        .catch(error => {
            console.error("Erro na requisição:", error);
            alert("Erro na requisição. Tente novamente.");
        });
}

// Inicializa o canvas de assinatura com suporte a mouse e toque
document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById("signature-pad");
    const ctx = canvas.getContext("2d");
    // Define a cor da assinatura como branca para visualização no site
    ctx.strokeStyle = "#fff";
    let drawing = false;

    function getOffset(event) {
        const rect = canvas.getBoundingClientRect();
        let x, y;
        if (event.touches && event.touches.length > 0) {
            x = event.touches[0].clientX - rect.left;
            y = event.touches[0].clientY - rect.top;
        } else {
            x = event.offsetX;
            y = event.offsetY;
        }
        // Ajusta as coordenadas considerando a escala do canvas
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return { x: x * scaleX, y: y * scaleY };
    }

    function startDrawing(event) {
        event.preventDefault();
        if (document.getElementById("confirm-signature").disabled) return;
        drawing = true;
        const pos = getOffset(event);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function stopDrawing(event) {
        event.preventDefault();
        drawing = false;
    }

    function draw(event) {
        event.preventDefault();
        if (!drawing) return;
        const pos = getOffset(event);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("touchstart", startDrawing);
    canvas.addEventListener("touchend", stopDrawing);
    canvas.addEventListener("touchmove", draw);
});

function FormatarAssinatura() {
    const originalCanvas = document.getElementById("signature-pad");
    const width = originalCanvas.width;
    const height = originalCanvas.height;
    const originalCtx = originalCanvas.getContext("2d");
    // Obtém os dados do canvas original (com fundo transparente e traços brancos)
    const imageData = originalCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    // Processa cada pixel: se fizer parte do traço (alpha > 0), define como preto; caso contrário, branco
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255;
        } else {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }
    }
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offscreenCtx = offscreenCanvas.getContext("2d");
    offscreenCtx.putImageData(imageData, 0, 0);
    return offscreenCanvas.toDataURL("image/png");
}

function openSignatureModal() {
    document.getElementById("responsavel-nome").value = "";
    document.getElementById("responsavel-telefone").value = "";
    document.getElementById("responsavel-cpf").value = "";
    document.getElementById("confirm-signature").disabled = true;
    document.getElementById("cpf-error").style.display = "none";

    document.getElementById("signature-modal").style.display = "block";
}

function closeSignatureModal() {
    const canvas = document.getElementById("signature-pad");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("signature-modal").style.display = "none";
}

function clearSignature() {
    const canvas = document.getElementById("signature-pad");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function confirmSignature() {
    signatureData = FormatarAssinatura();
    closeSignatureModal();
    closeModal();
    gravarEntrega();
}

function carregarTransportadoras() {
    fetch(`/transportadoras?empresa=${window.empresaId}`)
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById("transportadora-select");
            select.innerHTML = "";
            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.text = "Selecione a transportadora";
            select.appendChild(defaultOption);

            data.forEach(transp => {
                const option = document.createElement("option");
                option.value = transp.IDTransportadora;
                option.text = transp.RasSocial;
                select.appendChild(option);
            });
        })
        .catch(error => {
            console.error("Erro ao buscar transportadoras:", error);
        });
}
