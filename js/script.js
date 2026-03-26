console.log("✅ script.js carregado - v3.0 Consolidado");

// --- Elementos do DOM ---
const excelInput = document.getElementById("excel-input");
const sheetSelector = document.getElementById("sheet-selector");
const sheetIconBtn = document.getElementById("sheet-icon-btn");
const modalContainer = document.getElementById("modal-container");
const sessionModal = document.getElementById("session-modal");
const card = document.querySelector(".card");

// --- Variáveis de Estado Globais ---
let workbookData = null;
let steps = {};
let currentStep = null;
let historyStack = [];
let totalSteps = 0;
let userInputData = {}; 

// --- Inicialização ---
window.onload = () => {
    checkForSavedSession();
};

// --- Event Listeners ---
excelInput.addEventListener("change", handleFileUpload);
sheetIconBtn.addEventListener("click", () => {
    sheetSelector.classList.toggle("show");
});

document.addEventListener("click", (e) => {
    if (
        sheetSelector &&
        !sheetSelector.contains(e.target) &&
        !sheetIconBtn.contains(e.target)
    ) {
        sheetSelector.classList.remove("show");
    }
});

// --- Funções Principais do Fluxo ---

function handleFileUpload(e) {
    const fileNameSpan = document.getElementById("file-name");
    const file = e.target.files[0];
    if (!file) return;

    fileNameSpan.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            workbookData = {};
            workbook.SheetNames.forEach((name) => {
                const sheet = workbook.Sheets[name];
                workbookData[name] = XLSX.utils.sheet_to_json(sheet);
            });
            clearSession(); 
            populateSheetSelector(Object.keys(workbookData));
        } catch (error) {
            console.error("Erro ao ler o ficheiro Excel:", error);
            alert("Ocorreu um erro ao ler o ficheiro. Verifique se o formato é válido.");
        }
    };
    reader.readAsArrayBuffer(file);
}

function populateSheetSelector(sheetNames) {
    sheetSelector.innerHTML = ""; 
    sheetNames.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        sheetSelector.appendChild(option);
    });

    sheetSelector.onchange = () => {
        clearSession();
        renderFlowFromSheet(sheetSelector.value);
    };
    renderFlowFromSheet(sheetNames[0]); 
}

function renderFlowFromSheet(sheetName) {
    const rows = workbookData[sheetName];
    if (!rows || rows.length === 0) {
        alert("A aba selecionada está vazia ou não pôde ser lida.");
        return;
    }

    const newSteps = {};
    
    rows.forEach((row) => {
        // Função higienizadora: ignora maiúsculas, minúsculas, acentos e espaços invisíveis
        const getVal = (colName) => {
            const key = Object.keys(row).find(k => 
                k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
                colName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            );
            return key ? String(row[key] || "").trim() : "";
        };

        const id = getVal("id");
        if (!id) return; // Pula linhas em branco

        const title = getVal("titulo do passo");
        const description = getVal("descricao");
        
        // Garante que "decisão" com acento vire "decisao" no sistema
        const tipo = getVal("tipo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Captura e-mails perfeitamente
        const emailTo = getVal("email para");
        const emailCC = getVal("email cc");
        const assunto = getVal("assunto email");
        const emailData = emailTo ? { to: emailTo, cc: emailCC, assunto } : null;

        // Imagens e Anexos
        const imagemRaw = getVal("imagem");
        const imagens = imagemRaw ? imagemRaw.split(/[\s,]+/).filter(img => img !== "") : [];
        const documentoAnexo = getVal("documento_anexo") || getVal("documento anexo");
        
        // Funcionalidades Adicionais
        const corPrioridade = getVal("cor_prioridade") || getVal("cor prioridade");
        const checklist = getVal("checklist");
        const inputRequerido = getVal("input_requerido") || getVal("input requerido");

        // Agrupa os dados
        const stepData = { 
            title, description, imagens, emailData, 
            corPrioridade, documentoAnexo, checklist, inputRequerido 
        };

        // Direcionamento e Botões Customizados
        if (tipo === "direto") {
            newSteps[id] = { ...stepData, next: getVal("proximo direto") };
        } else if (tipo === "decisao") {
            newSteps[id] = {
                ...stepData,
                options: {
                    // Agora salvamos o ID do próximo passo E o texto que vai no botão
                    sim: { 
                        id: getVal("proximo sim"), 
                        label: getVal("texto sim") || "Sim" 
                    },
                    nao: { 
                        id: getVal("proximo nao"), 
                        label: getVal("texto nao") || "Não" 
                    },
                },
            };
        } else if (tipo === "final") {
            newSteps[id] = { ...stepData, next: null, options: null };
        }
    });

    const validationErrors = validateFlowData(newSteps);
    if (validationErrors.length > 0) {
        alert("Foram encontrados erros de validação no fluxo:\n\n" + validationErrors.join("\n"));
        return;
    }

    steps = newSteps;
    totalSteps = Object.keys(steps).length;
    historyStack = [];
    userInputData = {};
    currentStep = Object.keys(steps)[0];
    renderStep(currentStep);
}

function renderStep(stepKey, fromNavigation = false) {
    if (!stepKey || !steps[stepKey]) return;

    if (!fromNavigation && currentStep !== stepKey) {
        historyStack.push(currentStep);
    }
    currentStep = stepKey;
    const step = steps[stepKey];
    const cardContent = document.querySelector(".card-content");

    cardContent.classList.add("fade-out");

    setTimeout(() => {
        cardContent.innerHTML = "";
        
        // CORREÇÃO: Remove o botão de próximo antigo antes de criar um novo
        const oldNextBtn = document.querySelector(".next-icon");
        if (oldNextBtn) oldNextBtn.remove();
        
        updateProgressBar();
        updateBreadcrumbs();
        applyPriorityClass(step.corPrioridade);

        // 1. Título
        const titleEl = document.createElement("h2");
        titleEl.id = "step-title";
        titleEl.textContent = step.title;
        cardContent.appendChild(titleEl);

        // 2. Descrição
        const descEl = document.createElement("p");
        descEl.id = "step-description";
        descEl.innerHTML = formatDescription(step.description);
        cardContent.appendChild(descEl);

        // 3. Documento Anexo
        if (step.documentoAnexo && step.documentoAnexo.startsWith("http")) {
            cardContent.appendChild(createDocumentLink(step.documentoAnexo));
        }

        // 4. Checklist
        if (step.checklist) {
            cardContent.appendChild(createChecklist(step.checklist));
        }

        // 5. Input
        if (step.inputRequerido) {
            cardContent.appendChild(createInputField(step.inputRequerido));
        }

        // 6. Formulário de E-mail (Se houver destinatário configurado)
        if (step.emailData) {
            cardContent.appendChild(createEmailForm(step));
        }

        // 7. Galeria de Imagens Imediata
        if (step.imagens && step.imagens.length > 0) {
            const imagesContainer = document.createElement("div");
            imagesContainer.className = "step-images-container";

            if (step.imagens.length === 1) {
                const img = document.createElement("img");
                img.src = step.imagens[0];
                img.className = "step-image-single";
                img.title = "Clique para ampliar em tela cheia";
                img.onclick = () => openImageGallery(step.imagens);
                imagesContainer.appendChild(img);
            } else {
                step.imagens.forEach((url) => {
                    const img = document.createElement("img");
                    img.src = url;
                    img.className = "step-image-thumbnail";
                    img.title = "Clique para ampliar em tela cheia";
                    img.onclick = () => openImageGallery(step.imagens);
                    imagesContainer.appendChild(img);
                });
            }
            cardContent.appendChild(imagesContainer);
        }

        // 8. Botões de Ação
        const buttonsEl = document.createElement("div");
        buttonsEl.id = "buttons";
        cardContent.appendChild(buttonsEl);

        if (step.options && (step.options.sim.id || step.options.nao.id)) {
            if (step.options.sim.id)
                buttonsEl.appendChild(createNavButton(step.options.sim.id, step.options.sim.label));
            if (step.options.nao.id)
                buttonsEl.appendChild(createNavButton(step.options.nao.id, step.options.nao.label));
        }

        if (step.next) {
            const nextBtn = createNavButton(
                step.next,
                `<i class="fa-solid fa-arrow-right"></i>`,
                "next-icon",
                "Próximo"
            );
            document.querySelector(".nav-buttons").appendChild(nextBtn);
        }

        // 9. Botão de Visualizar Fluxograma (Apenas no passo final)
        const hasOptions = step.options && (step.options.sim.id || step.options.nao.id);
        if (!step.next && !hasOptions) {
            const viewFlowBtn = document.createElement("button");
            viewFlowBtn.id = "view-flow-btn";
            viewFlowBtn.style.marginTop = "2rem"; 
            viewFlowBtn.innerHTML = `<i class="fa-solid fa-diagram-project"></i> Visualizar Fluxo Completo`;
            viewFlowBtn.onclick = showMermaidFlow;
            cardContent.appendChild(viewFlowBtn);
        }

        updateFooter();
        checkFormCompletion();
        saveSession();

        cardContent.classList.remove("fade-out");
        cardContent.classList.add("fade-in");
    }, 200);
}

// --- Funções de Criação de Elementos ---

function createNavButton(nextStepId, text, className = "", title = "") {
    const btn = document.createElement("button");
    btn.innerHTML = text;
    if (className) btn.className = className;
    if (title) btn.title = title;
    btn.onclick = () => renderStep(nextStepId);
    return btn;
}

function createDocumentLink(url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.className = "document-attachment-btn";
    link.innerHTML = `<i class="fa-solid fa-file-pdf"></i> Consultar Documento`;
    return link;
}

function createChecklist(checklistData) {
    const container = document.createElement("div");
    container.className = "checklist-container";
    container.innerHTML = "<h4>Checklist de Verificação</h4>";
    const tasks = checklistData
        .split(";")
        .map((t) => t.trim())
        .filter((t) => t);
    tasks.forEach((task) => {
        const item = document.createElement("div");
        item.className = "checklist-item";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `chk-${task.replace(/\s+/g, "-")}`;
        checkbox.onchange = checkFormCompletion;
        const label = document.createElement("label");
        label.textContent = task;
        label.htmlFor = checkbox.id;
        item.appendChild(checkbox);
        item.appendChild(label);
        container.appendChild(item);
    });
    return container;
}

function createInputField(label) {
    const container = document.createElement("div");
    container.className = "input-container";
    container.innerHTML = `<h4>${label}</h4>`;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Inserir ${label}...`;
    input.onkeyup = () => {
        userInputData[currentStep] = {
            ...userInputData[currentStep],
            [label]: input.value,
        };
        checkFormCompletion();
    };
    container.appendChild(input);
    return container;
}

function createEmailForm(step) {
    const emailForm = document.createElement("div");
    emailForm.className = "email-form";
    emailForm.innerHTML = `
        <label style="font-weight: 600; color: #6e6251;" for="email-message">Mensagem de Solicitação:</label>
        <textarea id="email-message" placeholder="Descreva o ocorrido e solicite apoio..." rows="4"></textarea>
        <button type="button" id="send-email-btn"><i class="fa-solid fa-paper-plane"></i> Enviar Email</button>
    `;

    emailForm.querySelector("#send-email-btn").onclick = () => {
        const message = emailForm.querySelector("#email-message").value.trim();
        if (!message) {
            alert("Por favor, digite uma mensagem antes de enviar.");
            return;
        }
        const mailtoLink = `mailto:${step.emailData.to}?cc=${encodeURIComponent(
            step.emailData.cc || ""
        )}&subject=${encodeURIComponent(
            step.emailData.assunto || ""
        )}&body=${encodeURIComponent(message)}`;
        window.location.href = mailtoLink;
    };

    return emailForm;
}

// --- Funções Auxiliares e de UI ---

function formatDescription(description) {
    if (
        description.includes("•") ||
        description.includes("*") ||
        description.includes("-")
    ) {
        return (
            "<ul>" +
            description
                .split("\n")
                .filter((line) => line.trim() !== "")
                .map(
                    (line) => `<li>${line.replace(/[•*-]\s*/, "").trim()}</li>`
                )
                .join("") +
            "</ul>"
        );
    }
    return description.replace(/\n/g, "<br>");
}

function checkFormCompletion() {
    const allCheckboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
    const allInputs = document.querySelectorAll('.input-container input[type="text"]');

    const allChecked = [...allCheckboxes].every((chk) => chk.checked);
    const allFilled = [...allInputs].every((inp) => inp.value.trim() !== "");

    const isComplete = allChecked && allFilled;

    document.querySelectorAll("#buttons button, .nav-buttons .next-icon").forEach((btn) => {
        btn.disabled = !isComplete;
    });
}

function updateProgressBar() {
    const progressBar = document.getElementById("progress-bar");
    if (!progressBar) return;
    const progress = totalSteps > 0 ? ((historyStack.length + 1) / totalSteps) * 100 : 0;
    progressBar.style.width = `${progress}%`;
}

function updateBreadcrumbs() {
    const breadcrumbsContainer = document.getElementById("breadcrumbs-container");
    if (!breadcrumbsContainer) return;
    breadcrumbsContainer.innerHTML = "";
    
    const path = [...historyStack, currentStep];

    path.forEach((stepId, index) => {
        if (!steps[stepId]) return;
        const stepTitle = steps[stepId].title;
        
        const crumb = document.createElement("span");
        crumb.className = "breadcrumb-item";
        crumb.textContent = stepTitle;

        if (index < path.length - 1) {
            crumb.onclick = () => {
                const stepsToPop = historyStack.length - index;
                for (let i = 0; i < stepsToPop; i++) historyStack.pop();
                renderStep(stepId, true);
            };
            breadcrumbsContainer.appendChild(crumb);
            
            const separator = document.createElement("i");
            separator.className = "fa-solid fa-chevron-right breadcrumb-separator";
            breadcrumbsContainer.appendChild(separator);
        } else {
            crumb.classList.add("active");
            breadcrumbsContainer.appendChild(crumb);
        }
    });

    // Rola o contêiner de breadcrumbs automaticamente para o final
    setTimeout(() => {
        breadcrumbsContainer.scrollLeft = breadcrumbsContainer.scrollWidth;
    }, 10);
}

function applyPriorityClass(color) {
    card.classList.remove(
        "prioridade-vermelho",
        "prioridade-laranja",
        "prioridade-azul",
        "prioridade-verde"
    );
    if (color) {
        card.classList.add(`prioridade-${color.toLowerCase()}`);
    }
}

// --- Funções de Navegação e do Rodapé ---

function updateFooter() {
    const backBtn = document.getElementById("back-button");
    const resetBtn = document.getElementById("reset-button");

    if (backBtn) {
        backBtn.disabled = historyStack.length === 0;
        backBtn.onclick = goBack;
    }
    if (resetBtn) {
        resetBtn.onclick = resetFlow;
    }
}

function goBack() {
    if (historyStack.length > 0) {
        renderStep(historyStack.pop(), true);
    }
}

function resetFlow() {
    clearSession();
    historyStack = [];
    userInputData = {};
    if (steps && Object.keys(steps).length > 0) {
        renderStep(Object.keys(steps)[0]);
    }
}

// --- Lógica de Sessão ---

function saveSession() {
    if (!workbookData) return;
    const session = {
        workbookData,
        steps,
        currentStep,
        historyStack,
        totalSteps,
        userInputData,
        sheetName: sheetSelector.value,
        fileName: document.getElementById("file-name").textContent,
    };
    localStorage.setItem("mineflow_session", JSON.stringify(session));
}

function clearSession() {
    localStorage.removeItem("mineflow_session");
}

function checkForSavedSession() {
    const savedSession = localStorage.getItem("mineflow_session");
    if (savedSession) {
        sessionModal.style.display = "flex";
        document.getElementById("session-continue-btn").onclick = () => {
            loadSession(JSON.parse(savedSession));
            sessionModal.style.display = "none";
        };
        document.getElementById("session-discard-btn").onclick = () => {
            clearSession();
            sessionModal.style.display = "none";
        };
    }
}

function loadSession(session) {
    workbookData = session.workbookData;
    steps = session.steps;
    currentStep = session.currentStep;
    historyStack = session.historyStack;
    totalSteps = session.totalSteps;
    userInputData = session.userInputData;

    populateSheetSelector(Object.keys(workbookData));
    sheetSelector.value = session.sheetName;
    document.getElementById("file-name").textContent = session.fileName;

    renderStep(currentStep, true);
}

// --- Validação Avançada do Excel ---

function validateFlowData(stepsData) {
    const errors = [];
    const ids = new Set(Object.keys(stepsData));
    for (const id in stepsData) {
        const step = stepsData[id];
        const checkLink = (link, type) => {
            if (link && !ids.has(link)) {
                errors.push(`- Passo "${id}" (${step.title}): O link para "${type}" aponta para um ID inexistente: "${link}"`);
            }
        };
        checkLink(step.next, "Próximo Direto");
        if (step.options) {
            checkLink(step.options.sim.id, `Próximo (${step.options.sim.label})`);
            checkLink(step.options.nao.id, `Próximo (${step.options.nao.label})`);
        }
    }
    return errors;
}

// --- Lógica do Modal do Fluxograma e PDF ---

function getMermaidGraph() {
    const direction = window.innerWidth <= 768 ? "TB" : "LR";
    let links = [];

    const sanitize = (text) => {
        if (!text) return "";
        return text.replace(/"/g, "&quot;");
    };

    for (const [id, step] of Object.entries(steps)) {
        const from = id.replace(/\W/g, "_");
        const title = sanitize(step.title);

        if (step.options && (step.options.sim.id || step.options.nao.id)) {
            if (step.options.sim.id)
                links.push(`${from}{"${title}"} -->|${step.options.sim.label}| ${step.options.sim.id.replace(/\W/g,"_")}`);
            if (step.options.nao.id)
                links.push(`${from}{"${title}"} -->|${step.options.nao.label}| ${step.options.nao.id.replace(/\W/g,"_")}`);
        } else if (step.next) {
            links.push(`${from}["${title}"] --> ${step.next.replace(/\W/g, "_")}`);
        } else {
            links.push(`${from}["${title}"]`);
        }
    }
    return `flowchart ${direction}\n${links.join("\n")}`;
}

async function showMermaidFlow() {
    try {
        const graphDefinition = getMermaidGraph();
        const { svg } = await mermaid.render("mermaid-graph", graphDefinition);

        modalContainer.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Fluxo de Decisão</h2>
                    <button class="modal-close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    ${svg}
                </div>
                <div class="modal-footer">
                    <div class="modal-actions">
                        <button id="show-desc-btn">Ver Descrições</button>
                        <button id="export-pdf-btn">Exportar PDF</button>
                    </div>
                </div>
            </div>
        `;

        modalContainer.classList.add("visible");

        modalContainer.querySelector(".modal-close-btn").onclick = closeModal;
        modalContainer.querySelector("#show-desc-btn").onclick = () => createDescriptionsPopup(steps);
        modalContainer.querySelector("#export-pdf-btn").onclick = () => exportFlowToPDF(steps);
        modalContainer.onclick = (e) => {
            if (e.target === modalContainer) closeModal();
        };
    } catch (err) {
        console.error("Erro ao gerar o fluxo:", err);
        alert("Erro ao gerar o fluxo: " + err.message);
    }
}

function closeModal() {
    modalContainer.classList.remove("visible");
    setTimeout(() => {
        modalContainer.innerHTML = "";
    }, 300);
}

function createDescriptionsPopup(stepsData) {
    const overlay = document.createElement("div");
    overlay.className = "descriptions-popup-overlay";

    let stepsHtml = "";
    for (const key in stepsData) {
        const step = stepsData[key];
        stepsHtml += `
            <div class="step-item">
                <h4>${step.title}</h4>
                <p>${step.description.replace(/\n/g, "<br>")}</p>
            </div>
        `;
    }

    overlay.innerHTML = `
        <div class="descriptions-popup-content">
            <h3>Descrições dos Passos</h3>
            ${stepsHtml}
        </div>
    `;

    modalContainer.querySelector(".modal-content").appendChild(overlay);
    overlay.onclick = () => overlay.remove();
}

function getImageAsBase64(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Tenta baixar nativamente primeiro
        
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg")); // Força JPEG puro
        };
        
        img.onerror = () => {
            // Se falhar por bloqueio, usa o proxy
            const proxyUrl = "https://api.allorigins.win/raw?url=";
            fetch(proxyUrl + encodeURIComponent(url))
                .then((response) => response.blob())
                .then((blob) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        let dataUrl = reader.result;
                        // Força o "pacote genérico" a ser reconhecido como imagem JPEG
                        if (dataUrl.includes("application/octet-stream") || dataUrl.startsWith("data:;")) {
                            dataUrl = dataUrl.replace(/data:.*?;/, "data:image/jpeg;");
                        }
                        resolve(dataUrl);
                    };
                    reader.readAsDataURL(blob);
                })
                .catch((error) => {
                    console.error(`Falha ao buscar a imagem: ${url}`, error);
                    resolve(null);
                });
        };
        img.src = url;
    });
}

async function exportFlowToPDF(stepsData) {
    alert("A iniciar a geração do PDF. O carregamento das imagens pode demorar alguns segundos...");
    try {
        const { jsPDF } = window.jspdf;

        // 1. Carrega todas as imagens anexas em cache primeiro
        const imageMap = {};
        const imagePromises = [];
        
        const imageUrls = [
            ...new Set(
                Object.values(stepsData)
                    .flatMap((step) => step.imagens || []) 
                    .filter((img) => img && img.startsWith("http"))
            ),
        ];

        imageUrls.forEach((url) => {
            imagePromises.push(
                getImageAsBase64(url).then((base64) => {
                    if (base64) {
                        imageMap[url] = base64;
                    }
                })
            );
        });

        await Promise.all(imagePromises);

        // 2. Tira a "foto" do Diagrama ANTES de criar o PDF
        const flowElement = modalContainer.querySelector(".modal-body");
        const canvas = await html2canvas(flowElement, { scale: 2 });
        const diagramData = canvas.toDataURL("image/png");
        const diagramProps = { width: canvas.width, height: canvas.height };

        // 3. Define a orientação (Paisagem "l" se for mais largo, Retrato "p" se for mais alto)
        const orientation = diagramProps.width > diagramProps.height ? "l" : "p";
        
        // Inicializa o PDF com a orientação ideal para o fluxograma
        const pdf = new jsPDF(orientation, "pt", "a4");

        let pdfWidth = pdf.internal.pageSize.getWidth();
        let pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 40;
        let yPosition = margin;

        // 4. Calcula o tamanho do diagrama para não cortar e centralizar
        let printWidth = pdfWidth - margin * 2;
        let printHeight = (diagramProps.height * printWidth) / diagramProps.width;

        // Se a altura calculada for maior que a página, reduzimos pela altura
        if (printHeight > pdfHeight - margin * 2 - 40) {
            printHeight = pdfHeight - margin * 2 - 40;
            printWidth = (diagramProps.width * printHeight) / diagramProps.height;
        }

        const xPosition = (pdfWidth - printWidth) / 2; // Centraliza horizontalmente

        // Adiciona o Título e o Diagrama na primeira página
        pdf.setFontSize(20);
        pdf.text("Fluxo de Decisão", pdfWidth / 2, yPosition, { align: "center" });
        yPosition += 30;
        
        pdf.addImage(diagramData, "PNG", xPosition, yPosition, printWidth, printHeight);

        // ==============================================================
        // PÁGINA 2 EM DIANTE: DESCRIÇÕES (Sempre em Retrato/Vertical)
        // ==============================================================
        pdf.addPage("a4", "p"); // Força as próximas páginas a serem formato "portrait"
        
        pdfWidth = pdf.internal.pageSize.getWidth(); // Atualiza a largura
        pdfHeight = pdf.internal.pageSize.getHeight(); // Atualiza a altura
        yPosition = margin;

        const checkAddPage = (spaceNeeded) => {
            if (yPosition + spaceNeeded > pdfHeight - margin) {
                pdf.addPage("a4", "p"); // Mantém "portrait" nas quebras de página
                yPosition = margin;
            }
        };

        pdf.setFontSize(16);
        pdf.text("Descrições dos Passos", margin, yPosition);
        yPosition += 30;

        for (const key in stepsData) {
            const step = stepsData[key];

            checkAddPage(40);

            pdf.setFontSize(12);
            pdf.setFont("helvetica", "bold");
            pdf.text(step.title, margin, yPosition);
            yPosition += 15;

            pdf.setFont("helvetica", "normal");
            const splitDesc = pdf.splitTextToSize(step.description, pdfWidth - margin * 2);
            checkAddPage(splitDesc.length * 12);
            pdf.text(splitDesc, margin, yPosition);
            yPosition += splitDesc.length * 12 + 10;

            if (step.imagens && step.imagens.length > 0) {
                step.imagens.forEach((imgUrl) => {
                    if (imageMap[imgUrl]) {
                        const imgBase64 = imageMap[imgUrl];
                        
                        // Recalcula as proporções para a página Retrato
                        const imgsrc = imgBase64;
                        // Extraímos as proporções baseadas na string base64 via jsPDF
                        const imgProps = pdf.getImageProperties(imgBase64);
                        const imgWidth = pdfWidth - margin * 2;
                        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                        checkAddPage(imgHeight + 20);
                        
                        // Verifica o formato para evitar o erro "UNKNOWN"
                        let format = imgBase64.startsWith("data:image/png") ? "PNG" : "JPEG";
                        pdf.addImage(imgBase64, format, margin, yPosition, imgWidth, imgHeight);
                        
                        yPosition += imgHeight + 20;
                    } else {
                        checkAddPage(20);
                        pdf.setFont("helvetica", "italic");
                        pdf.setTextColor(150);
                        pdf.text(`[Erro ao carregar imagem: ${imgUrl}]`, margin, yPosition);
                        pdf.setTextColor(0);
                        yPosition += 20;
                    }
                });
            }
            yPosition += 10;
        }

        pdf.save(`fluxo_decisao_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Erro ao gerar PDF: " + error.message);
    }
}

// --- FUNÇÃO PARA ABRIR A GALERIA DE IMAGENS ---
function openImageGallery(imageUrls) {
    const overlay = document.createElement("div");
    overlay.className = "gallery-overlay";

    const closeBtn = document.createElement("button");
    closeBtn.className = "gallery-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Fechar Galeria";
    closeBtn.onclick = () => overlay.remove();
    overlay.appendChild(closeBtn);

    imageUrls.forEach(url => {
        const img = document.createElement("img");
        img.src = url;
        img.className = "gallery-img";
        img.onerror = () => { img.style.display = 'none'; alert(`Não foi possível carregar a imagem: ${url}`); };
        overlay.appendChild(img);
    });

    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    document.body.appendChild(overlay);
}