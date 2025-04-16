document.addEventListener("DOMContentLoaded", function () {
  // Carrega usuário da sessão
  const usuario = JSON.parse(sessionStorage.getItem("usuario")) || {};
  const isAdmin = usuario.Cargo && usuario.Cargo.toLowerCase() === "admin";

  // --- INÍCIO: Verificação de horário de trabalho ---
  (function verificarHorarioTrabalho() {
    const cargoRaw = usuario.Cargo ?? usuario.cargo;
    if (!cargoRaw) {
      console.warn("Verificação horário: cargo não encontrado", usuario);
      return;
    }
    const cargo = cargoRaw.trim().toLowerCase();
    const now = new Date();
    const hour = now.getHours(); // 0–23
    console.log(`Verificação horário: hora=${hour}, cargo=${cargo}`);
    if ((hour >= 18 || hour < 6) && cargo !== 'admin') {
      alert('Tempo de trabalho excedido. Volte no horário de expediente!');
      window.location.href = '/';
    }
  })();
  // --- FIM: Verificação de horário de trabalho ---

  // Variáveis do carrossel
  const empresa = usuario.Empresa;
  const imageCarousels = {
    main: { images: [], current: 0, interval: null },
    promo: { images: [], current: 0, interval: null }
  };
  const INTERVAL_MS = 4500;
  let currentTipo = null;

  // Atualiza container de imagens
  function updateContainer(tipo, selector, direction) {
    const c = imageCarousels[tipo];
    const cont = document.querySelector(selector);
    cont.innerHTML = "";
    if (c.images.length) {
      const img = document.createElement("img");
      img.src = c.images[c.current];
      img.style.cssText = "width:100%;height:100%;";
      if (tipo === "promo") {
        img.style.objectFit = "contain";
        img.style.background = "#000";
      } else {
        img.style.objectFit = "cover";
      }
      img.classList.add(direction === 'left' ? 'anim-left' : 'anim-right');
      cont.appendChild(img);

      if (c.images.length > 1) {
        ["left", "right"].forEach(dir => {
          const btn = document.createElement("button");
          btn.className = `container-arrow ${dir}`;
          btn.innerHTML = dir === "left" ? "&#10094;" : "&#10095;";
          btn.addEventListener("click", e => {
            e.stopPropagation();
            c.current = dir === "left"
              ? (c.current - 1 + c.images.length) % c.images.length
              : (c.current + 1) % c.images.length;
            updateContainer(tipo, selector, dir);
            resetCarousel(tipo, selector);
          });
          cont.appendChild(btn);
        });

        const dots = document.createElement("div");
        dots.className = "dots";
        c.images.forEach((_, i) => {
          const d = document.createElement("div");
          d.className = "dot" + (i === c.current ? " active" : "");
          d.addEventListener("click", e => {
            e.stopPropagation();
            const dir = i < c.current ? 'left' : 'right';
            c.current = i;
            updateContainer(tipo, selector, dir);
            resetCarousel(tipo, selector);
          });
          dots.appendChild(d);
        });
        cont.appendChild(dots);
      }
    } else {
      cont.textContent = `[Imagem do ${tipo === "main" ? "Admin" : "Promo"}]`;
    }
  }

  // Controle do carrossel
  function startCarousel(tipo, sel) {
    const c = imageCarousels[tipo];
    if (c.interval) clearInterval(c.interval);
    if (c.images.length > 1) {
      c.interval = setInterval(() => {
        c.current = (c.current + 1) % c.images.length;
        updateContainer(tipo, sel, 'right');
      }, INTERVAL_MS);
    }
  }
  function stopCarousel(tipo) {
    const c = imageCarousels[tipo];
    if (c.interval) {
      clearInterval(c.interval);
      c.interval = null;
    }
  }
  function resetCarousel(tipo, sel) {
    stopCarousel(tipo);
    startCarousel(tipo, sel);
  }

  // Exibe cargo do usuário
  document.getElementById("cargoUsuario").textContent = usuario.Cargo
    ? usuario.Cargo.charAt(0).toUpperCase() + usuario.Cargo.slice(1).toLowerCase()
    : "";
  document.getElementById("exit-icon").addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/";
  });

  // Busca imagens da API
  fetch(`/api/get_images?empresa=${empresa}`)
    .then(r => r.json())
    .then(data => {
      ["main", "promo"].forEach(tipo => {
        stopCarousel(tipo);
        imageCarousels[tipo].images = data[tipo] || [];
        imageCarousels[tipo].current = 0;
        updateContainer(tipo, `[data-imagem="${tipo}"] .placeholder`, 'right');
        startCarousel(tipo, `[data-imagem="${tipo}"] .placeholder`);
      });
    })
    .catch(console.error);

  // Navbar links
  const opEst = document.getElementById("opcoesEstoque");
  const opVend = document.getElementById("opcoesVendas");
  const opAdm = document.getElementById("opcoesAdmin");

  function permEst() {
    if (!usuario) { alert("Não autenticado"); return false; }
    const c = usuario.Cargo.toLowerCase();
    if (!["admin", "estoque"].includes(c)) { alert("Sem permissão"); return false; }
    return true;
  }
  function permVend() {
    if (!usuario) { alert("Não autenticado"); return false; }
    const c = usuario.Cargo.toLowerCase();
    if (!["admin", "vendedor", "gerente", "supervisor", "caixa"].includes(c)) {
      alert("Sem permissão");
      return false;
    }
    return true;
  }
  function permAdm() {
    if (!usuario) { alert("Não autenticado"); return false; }
    if (usuario.Cargo.toLowerCase() !== "admin") { alert("Sem permissão"); return false; }
    return true;
  }

  function addLinks(el, links, perm, other) {
    other.innerHTML = "";
    el.innerHTML = "";
    if (!perm()) return;
    el.innerHTML = `<li class="nav-title">${el.id.replace("opcoes", "Opções de ")}</li>`;
    links.forEach(l => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${l.url}">${l.icone} ${l.texto}</a>`;
      li.querySelector("a").addEventListener("click", e => {
        if (!perm()) {
          e.preventDefault();
          el.innerHTML = "";
        }
      });
      el.appendChild(li);
    });
  }

  document.getElementById("estoqueLink").addEventListener("click", e => {
    e.preventDefault();
    opVend.innerHTML = "";
    opAdm.innerHTML = "";
    addLinks(opEst, [
      { url: "/estoque", texto: "Consulta de Estoque", icone: "📦" },
      { url: "/pedidos", texto: "Status de Pedido", icone: "🔄" },
      { url: "/venda", texto: "Relatório de Vendas", icone: "🗂️" },
      { url: "/entrega", texto: "Ger. Entregas", icone: "📩" }
    ], permEst, opVend);
  });

  document.getElementById("vendasLink").addEventListener("click", e => {
    e.preventDefault();
    opEst.innerHTML = "";
    opAdm.innerHTML = "";
    addLinks(opVend, [
      { url: "/info", texto: "Informação de Progresso", icone: "🛒" },
      { url: "/cnpj", texto: "Consulta de CNPJ", icone: "🔎" },
      { url: "/pix", texto: "Pix", icone: "💸" },
      { url: "/ranking", texto: "Ranking da Empresa", icone: "📊" }
    ], permVend, opEst);
  });

  document.getElementById("adminLink").addEventListener("click", e => {
    e.preventDefault();
    opEst.innerHTML = "";
    opVend.innerHTML = "";
    if (!permAdm()) return;
    opAdm.innerHTML = `<li class="nav-title">Opções de Admin</li>`;
    [
      { url: "/fiscal", texto: "Perfil Fiscal V2", icone: "📋" },
      { url: "/produtos", texto: "Atualizar Preço", icone: "🛒" },
      { url: "/meta", texto: "Meta dos Vendedores", icone: "📶" },
      { url: "/admin", texto: "Dashboard de Vendas", icone: "🛒" },
      { url: "/escritorio", texto: "Ranking Escritório", icone: "🏢" }
    ].forEach(l => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${l.url}">${l.icone} ${l.texto}</a>`;
      li.querySelector("a").addEventListener("click", e2 => {
        if (!permAdm()) {
          e2.preventDefault();
          opAdm.innerHTML = "";
        }
      });
      opAdm.appendChild(li);
    });
  });

  // Modal de imagens
  const modalOv = document.getElementById("imageModal");
  const modalCl = document.getElementById("modalClose");
  const prevCont = document.getElementById("previewContent");
  const pArrow = document.getElementById("prevArrow");
  const nArrow = document.getElementById("nextArrow");
  const downloadLink = document.getElementById("downloadImage");
  const selectBtn = document.getElementById("selectImage");
  const removeBtn = document.getElementById("removeImage");
  const saveBtn = document.getElementById("saveImage");
  const fileInput = document.getElementById("fileInput");
  const adminButtons = document.getElementById("adminButtons");
  const userButtons = document.getElementById("userButtons");
  const modalTitle = document.getElementById("modalTitle");

  document.querySelectorAll("[data-imagem]").forEach(el => {
    el.addEventListener("click", () => {
      currentTipo = el.getAttribute("data-imagem");
      imageCarousels[currentTipo].current = 0;
      if (isAdmin) {
        modalTitle.textContent = "Gerenciar Imagem";
        adminButtons.style.display = "flex";
        userButtons.style.display = "none";
        updateModalAdmin();
      } else {
        modalTitle.textContent = "Pré-visualização de Imagem";
        adminButtons.style.display = "none";
        userButtons.style.display = "flex";
        updateModalUser();
      }
      stopCarousel(currentTipo);
      modalOv.style.display = "flex";
    });
  });

  function updateModalUser() {
    const c = imageCarousels[currentTipo];
    if (c.images.length) {
      const src = c.images[c.current];
      prevCont.innerHTML = `<img src="${src}">`;
      downloadLink.href = src;
      downloadLink.setAttribute("download", `imagem_${currentTipo}_${c.current + 1}`);
    } else {
      prevCont.textContent = "Nenhuma imagem disponível.";
      downloadLink.href = "#";
    }
    const showArrows = c.images.length > 1;
    pArrow.style.display = showArrows ? "block" : "none";
    nArrow.style.display = showArrows ? "block" : "none";
  }

  function updateModalAdmin() {
    const c = imageCarousels[currentTipo];
    if (c.images.length) {
      const src = c.images[c.current];
      prevCont.innerHTML = `<img src="${src}">`;
    } else {
      prevCont.textContent = "Nenhuma imagem selecionada.";
    }
    const showArrows = c.images.length > 1;
    pArrow.style.display = showArrows ? "block" : "none";
    nArrow.style.display = showArrows ? "block" : "none";
  }

  pArrow.addEventListener("click", e => {
    e.stopPropagation();
    const c = imageCarousels[currentTipo];
    c.current = (c.current - 1 + c.images.length) % c.images.length;
    isAdmin ? updateModalAdmin() : updateModalUser();
  });
  nArrow.addEventListener("click", e => {
    e.stopPropagation();
    const c = imageCarousels[currentTipo];
    c.current = (c.current + 1) % c.images.length;
    isAdmin ? updateModalAdmin() : updateModalUser();
  });

  modalCl.addEventListener("click", () => {
    modalOv.style.display = "none";
    prevCont.innerHTML = "";
    resetCarousel(currentTipo, `[data-imagem="${currentTipo}"] .placeholder`);
  });

  selectBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = e => {
        prevCont.innerHTML = `<img src="${e.target.result}">`;
      };
      reader.readAsDataURL(fileInput.files[0]);
    }
  });

  removeBtn.addEventListener("click", () => {
    const c = imageCarousels[currentTipo];
    if (!c.images.length) return alert("Nenhuma imagem para remover.");
    const filename = c.images[c.current].split("/").pop();
    const body = new URLSearchParams({ tipo: currentTipo, filename, empresa });
    fetch("/api/delete_image", { method: "POST", body })
      .then(r => r.json())
      .then(resp => {
        if (resp.sucesso) {
          c.images.splice(c.current, 1);
          c.current = 0;
          updateContainer(currentTipo, `[data-imagem="${currentTipo}"] .placeholder`, 'right');
          resetCarousel(currentTipo, `[data-imagem="${currentTipo}"] .placeholder`);
          modalOv.style.display = "none";
        } else throw resp.erro;
      })
      .catch(e => alert("Erro: " + e));
  });

  saveBtn.addEventListener("click", () => {
    if (fileInput.files[0] && currentTipo) {
      const fd = new FormData();
      fd.append("image", fileInput.files[0]);
      fd.append("tipo", currentTipo);
      fd.append("empresa", empresa);

      fetch("/api/upload_image", { method: "POST", body: fd })
        .then(response => {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            return response.json();
          } else {
            return response.text().then(text => { throw new Error("Erro no upload: " + text); });
          }
        })
        .then(resp => {
          if (resp.sucesso) return fetch(`/api/get_images?empresa=${empresa}`);
          else throw new Error(resp.erro);
        })
        .then(response => {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            return response.json();
          } else {
            return response.text().then(text => { throw new Error("Erro ao obter imagens: " + text); });
          }
        })
        .then(data => {
          imageCarousels[currentTipo].images = data[currentTipo] || [];
          imageCarousels[currentTipo].current = 0;
          updateContainer(currentTipo, `[data-imagem="${currentTipo}"] .placeholder`, 'right');
          resetCarousel(currentTipo, `[data-imagem="${currentTipo}"] .placeholder`);
          modalOv.style.display = "none";
        })
        .catch(e => alert("Erro: " + e.message));
    } else {
      alert("Selecione uma imagem.");
    }
  });

  // Últimas compras
  fetch(`/api/ultimas_compras?empresa=${empresa}`)
    .then(r => r.json())
    .then(data => {
      const cont = document.querySelector(".ultimas-compras");
      if (data.erro) {
        cont.innerHTML = `<p>${data.erro}</p>`;
        return;
      }
      function dFmt(iso) {
        const [y, m, d] = iso.split("-");
        return `${d}/${m}/${y}`;
      }
      function nFmt(n) {
        let x = parseFloat(n),
          s = x.toFixed(8).replace(/\.?0+$/, "");
        let [i, dec] = s.split(".");
        i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return dec ? `${i},${dec}` : i;
      }
      function mkGrp(items) {
        const g = document.createElement("div");
        g.className = "compra-grupo";
        const d = items[0] ? dFmt(items[0].DataCompra) : "";
        g.innerHTML = `<div class="data-compra">Data: ${d}</div>`;
        const t = document.createElement("table");
        t.innerHTML = `<thead><tr><th>Código</th><th>Descrição</th><th>Qtd.</th></tr></thead><tbody>`;
        items.forEach(i => {
          const r = document.createElement("tr");
          r.innerHTML = `<td>${i.Codigo}</td><td>${i.Descricao}</td><td>${nFmt(i.Quantidade)}</td>`;
          t.querySelector("tbody").appendChild(r);
        });
        g.appendChild(t);
        return g;
      }
      Object.values(data).forEach(grp => cont.appendChild(mkGrp(grp)));
    })
    .catch(e => {
      document.querySelector(".ultimas-compras").innerHTML = `<p>Erro ao buscar compras: ${e}</p>`;
    });
});
