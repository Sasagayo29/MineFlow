console.log("✅ script.js carregado");

// Elementos do DOM
const excelInput = document.getElementById("excel-input");
const sheetSelector = document.getElementById("sheet-selector");
const sheetIconBtn = document.getElementById("sheet-icon-btn");
const titleEl = document.getElementById("step-title");
const descEl = document.getElementById("step-description");
const buttonsEl = document.getElementById("buttons");
const backBtn = document.getElementById("back-button");
const resetBtn = document.getElementById("reset-button");
const flowSummary = document.getElementById("flow-summary");
const viewFlowBtn = document.getElementById("view-flow-btn");
const modalContainer = document.getElementById("modal-container");
const imageContainer = document.getElementById("image-container");

// Variáveis de estado
let workbookData = null;
let steps = {};
let currentStep = null;
let historyStack = [];

// Inicialização do Mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis",
    },
});

// Event Listeners
excelInput.addEventListener("change", handleFileUpload);
backBtn.addEventListener("click", goBack);
resetBtn.addEventListener("click", resetFlow);
viewFlowBtn.addEventListener("click", showMermaidFlow);
sheetIconBtn.addEventListener("click", () => {
    sheetSelector.classList.toggle("show");
});

document.addEventListener("click", (e) => {
    if (!sheetSelector.contains(e.target) && !sheetIconBtn.contains(e.target)) {
        sheetSelector.classList.remove("show");
    }
});

// Funções Principais
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
            populateSheetSelector(Object.keys(workbookData));
        } catch (error) {
            console.error("Erro ao ler o ficheiro Excel:", error);
            alert(
                "Ocorreu um erro ao ler o ficheiro. Verifique se o formato é válido."
            );
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

    sheetSelector.onchange = () => renderFlowFromSheet(sheetSelector.value);
    renderFlowFromSheet(sheetNames[0]);
}

function renderFlowFromSheet(sheetName) {
    const rows = workbookData[sheetName];
    if (!rows || rows.length === 0) {
        alert("A aba selecionada está vazia ou não pôde ser lida.");
        return;
    }

    const requiredColumns = ["ID", "Título do Passo", "Descrição", "Tipo"];
    const fileColumns = Object.keys(rows[0]);
    const missingColumns = requiredColumns.filter(
        (col) => !fileColumns.includes(col)
    );

    if (missingColumns.length > 0) {
        alert(
            `Erro: O ficheiro Excel não contém as seguintes colunas obrigatórias na aba "${sheetName}":\n\n- ${missingColumns.join(
                "\n- "
            )}\n\nPor favor, corrija o ficheiro e tente novamente.`
        );
        excelInput.value = "";
        return;
    }

    const newSteps = {};
    rows.forEach((row) => {
        const id = String(row["ID"] || "").trim();
        if (!id) return;

        const title = String(row["Título do Passo"] || "").trim();
        const description = String(row["Descrição"] || "").trim();
        const tipo = String(row["Tipo"] || "")
            .toLowerCase()
            .trim();
        const emailTo = String(row["Email Para"] || "").trim();
        const emailCC = String(row["Email CC"] || "").trim();
        const assunto = String(row["Assunto Email"] || "").trim();
        const emailData = emailTo
            ? { to: emailTo, cc: emailCC, assunto }
            : null;
        const imagem = String(row["Imagem"] || "").trim();

        if (tipo === "direto") {
            newSteps[id] = {
                title,
                description,
                next: String(row["Próximo Direto"] || "").trim(),
                emailData,
                imagem,
            };
        } else if (tipo === "decisao") {
            newSteps[id] = {
                title,
                description,
                emailData,
                imagem,
                options: {
                    sim: String(row["Próximo Sim"] || "").trim(),
                    nao: String(row["Próximo Não"] || "").trim(),
                },
            };
        } else if (tipo === "final") {
            newSteps[id] = {
                title,
                description,
                next: null,
                options: null,
                emailData,
                imagem,
            };
        }
    });

    steps = newSteps;
    historyStack = [];
    currentStep = Object.keys(steps)[0];
    flowSummary.style.display = "none";
    viewFlowBtn.style.display = "none";
    renderStep(currentStep);
}

function renderStep(stepKey, fromNavigation = false) {
    if (!stepKey || !steps[stepKey]) return;

    if (!fromNavigation && currentStep !== stepKey) {
        historyStack.push(currentStep);
    }
    currentStep = stepKey;
    const step = steps[stepKey];

    titleEl.textContent = step.title;
    descEl.textContent = step.description;
    buttonsEl.innerHTML = "";
    imageContainer.innerHTML = ""; // Limpa sempre o container
    flowSummary.style.display = "none";
    viewFlowBtn.style.display = "none";

    document.querySelector(".next-icon")?.remove();

    if (step.emailData) {
        createEmailForm(step);
    }

    // Lógica para exibir a imagem diretamente no card
    if (step.imagem && step.imagem.startsWith("http")) {
        const spinner = document.createElement("div");
        spinner.className = "loading-spinner";
        imageContainer.appendChild(spinner);

        const img = new Image();
        img.src = step.imagem;

        img.onload = () => {
            spinner.remove();
            imageContainer.appendChild(img);
            img.style.display = "block";
        };
        img.onerror = () => {
            spinner.remove();
            const errorText = document.createElement("p");
            errorText.textContent = "Erro ao carregar a imagem.";
            errorText.style.color = "red";
            imageContainer.appendChild(errorText);
        };
    }

    if (step.options) {
        for (const [label, nextKey] of Object.entries(step.options)) {
            if (nextKey) {
                const btn = document.createElement("button");
                btn.textContent =
                    label.charAt(0).toUpperCase() + label.slice(1);
                btn.onclick = () => renderStep(nextKey);
                buttonsEl.appendChild(btn);
            }
        }
    }

    if (step.next) {
        const nextBtn = document.createElement("button");
        nextBtn.innerHTML = `<i class="fa-solid fa-arrow-right"></i>`;
        nextBtn.classList.add("next-icon");
        nextBtn.title = "Próximo";
        nextBtn.onclick = () => renderStep(step.next);
        document.querySelector(".nav-buttons").appendChild(nextBtn);
    }

    backBtn.disabled = historyStack.length === 0;

    if (!step.next && !step.options) {
        flowSummary.style.display = "block";
        viewFlowBtn.style.display = "inline-block";
    }
}

function createEmailForm(step) {
    const emailForm = document.createElement("div");
    emailForm.className = "email-form";
    emailForm.innerHTML = `
        <label for="email-message">Mensagem:</label>
        <textarea id="email-message" placeholder="Descreva o ocorrido..." rows="4"></textarea>
        <button id="send-email-btn">Enviar Email</button>
    `;
    buttonsEl.appendChild(emailForm);

    document.getElementById("send-email-btn").onclick = () => {
        const message = document.getElementById("email-message").value.trim();
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
}

// Funções de Navegação e Auxiliares
function goBack() {
    if (historyStack.length > 0) {
        renderStep(historyStack.pop(), true);
    }
}

function resetFlow() {
    historyStack = [];
    if (steps && Object.keys(steps).length > 0) {
        renderStep(Object.keys(steps)[0]);
    }
}

// Lógica do Modal do Fluxograma
function getMermaidGraph() {
    const direction = window.innerWidth <= 768 ? "TB" : "LR";
    let links = [];
    for (const [id, step] of Object.entries(steps)) {
        const from = id.replace(/\W/g, "_");
        if (step.options) {
            if (step.options.sim)
                links.push(
                    `${from}{"${
                        step.title
                    }"} -->|Sim| ${step.options.sim.replace(/\W/g, "_")}`
                );
            if (step.options.nao)
                links.push(
                    `${from}{"${
                        step.title
                    }"} -->|Não| ${step.options.nao.replace(/\W/g, "_")}`
                );
        } else if (step.next) {
            links.push(
                `${from}["${step.title}"] --> ${step.next.replace(/\W/g, "_")}`
            );
        } else {
            links.push(`${from}["${step.title}"]`);
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
                    <div class="modal-actions">
                        <button id="show-desc-btn">Ver Descrições</button>
                        <button id="export-pdf-btn">Exportar PDF</button>
                    </div>
                    <button class="modal-close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    ${svg}
                </div>
            </div>
        `;

        modalContainer.classList.add("visible");

        modalContainer.querySelector(".modal-close-btn").onclick = closeModal;
        modalContainer.querySelector("#show-desc-btn").onclick = () =>
            createDescriptionsPopup(steps);
        modalContainer.querySelector("#export-pdf-btn").onclick = () =>
            exportFlowToPDF(steps);
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
                <p>${step.description}</p>
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

async function exportFlowToPDF(stepsData) {
    alert("A iniciar a geração do PDF. Isto pode demorar alguns segundos...");
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("landscape", "pt", "a4");
        const flowElement = modalContainer.querySelector(".modal-body");

        const canvas = await html2canvas(flowElement, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 40;

        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight =
            (imgProps.height * (pdfWidth - margin * 2)) / imgProps.width;

        pdf.setFontSize(20);
        pdf.text("Fluxo de Decisão", pdfWidth / 2, margin, { align: "center" });
        pdf.addImage(
            imgData,
            "PNG",
            margin,
            margin + 20,
            pdfWidth - margin * 2,
            imgHeight
        );

        pdf.addPage();
        let yPosition = margin;

        pdf.setFontSize(16);
        pdf.text("Descrições dos Passos", margin, yPosition);
        yPosition += 30;

        for (const key in stepsData) {
            const step = stepsData[key];
            if (yPosition > pdfHeight - margin) {
                pdf.addPage();
                yPosition = margin;
            }
            pdf.setFontSize(12);
            pdf.setFont("helvetica", "bold");
            pdf.text(step.title, margin, yPosition);
            yPosition += 15;

            pdf.setFont("helvetica", "normal");
            const splitDesc = pdf.splitTextToSize(
                step.description,
                pdfWidth - margin * 2
            );
            pdf.text(splitDesc, margin, yPosition);
            yPosition += splitDesc.length * 12 + 20;
        }

        pdf.save(`fluxo_decisao_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Erro ao gerar PDF: " + error.message);
    }
}
