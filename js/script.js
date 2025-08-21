console.log("✅ script.js carregado");

// Elementos do DOM
const excelInput = document.getElementById("excel-input");
const sheetSelector = document.getElementById("sheet-selector");
const titleEl = document.getElementById("step-title");
const descEl = document.getElementById("step-description");
const buttonsEl = document.getElementById("buttons");
const backBtn = document.getElementById("back-button");
const resetBtn = document.getElementById("reset-button");
const flowSummary = document.getElementById("flow-summary");
const viewFlowBtn = document.getElementById("view-flow-btn");

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

// Alternar visibilidade do seletor de planilhas em telas pequenas
const sheetIconBtn = document.getElementById("sheet-icon-btn");

if (sheetIconBtn) {
    sheetIconBtn.addEventListener("click", () => {
        sheetSelector.classList.toggle("show");
    });

    // Oculta o seletor se clicar fora dele
    document.addEventListener("click", (e) => {
        if (
            !sheetSelector.contains(e.target) &&
            !sheetIconBtn.contains(e.target)
        ) {
            sheetSelector.classList.remove("show");
        }
    });
}

// Função principal para carregar arquivo Excel
function handleFileUpload(e) {
    const fileNameSpan = document.getElementById("file-name");
    const file = e.target.files[0];
    if (!file) return;

    // Mostrar nome do arquivo
    fileNameSpan.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        workbookData = {};
        workbook.SheetNames.forEach((name) => {
            const sheet = workbook.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(sheet);
            workbookData[name] = rows;
        });

        populateSheetSelector(Object.keys(workbookData));
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
    sheetSelector.style.display = "inline-block";

    sheetSelector.onchange = () => {
        renderFlowFromSheet(sheetSelector.value);
    };

    renderFlowFromSheet(sheetNames[0]);
}

function renderFlowFromSheet(sheetName) {
    const rows = workbookData[sheetName];
    if (!rows) return;

    // Montar steps
    const newSteps = {};
    rows.forEach((row) => {
        const id = String(row["ID"]).trim();
        const title = String(row["Título do Passo"] || "").trim();
        const description = String(row["Descrição"] || "").trim();
        const tipo = String(row["Tipo"] || "")
            .toLowerCase()
            .trim();
        const emailTo = String(row["Email Para"] || "").trim();
        const emailCC = String(row["Email CC"] || "").trim();
        const assunto = String(row["Assunto Email"] || "").trim();

        if (tipo === "direto") {
            newSteps[id] = {
                title,
                description,
                next: String(row["Próximo Direto"]).trim(),
                emailData: emailTo
                    ? { to: emailTo, cc: emailCC, assunto }
                    : null,
            };
        } else if (tipo === "decisao") {
            newSteps[id] = {
                title,
                description,
                options: {
                    sim: String(row["Próximo Sim"]).trim(),
                    nao: String(row["Próximo Não"]).trim(),
                },
                emailData: emailTo
                    ? { to: emailTo, cc: emailCC, assunto }
                    : null,
            };
        } else if (tipo === "final") {
            newSteps[id] = {
                title,
                description,
                next: null,
                emailData: emailTo
                    ? { to: emailTo, cc: emailCC, assunto }
                    : null,
            };
        }
    });

    steps = newSteps;
    historyStack = [];
    currentStep = Object.keys(newSteps)[0];
    flowSummary.style.display = "none";
    viewFlowBtn.style.display = "none";
    renderStep(currentStep);
}

// Função principal para renderizar cada passo
function renderStep(stepKey, fromNavigation = false) {
    if (!stepKey || !steps[stepKey]) return;

    if (!fromNavigation && currentStep !== stepKey) {
        historyStack.push(currentStep);
    }
    currentStep = stepKey;
    const step = steps[stepKey];

    // Atualizar UI
    titleEl.textContent = step.title;
    descEl.textContent = step.description;
    buttonsEl.innerHTML = "";
    flowSummary.style.display = "none";
    viewFlowBtn.style.display = "none";

    // Remover botão próximo anterior se existir
    const oldNext = document.querySelector(".next-icon");
    if (oldNext) oldNext.remove();

    // Caso especial com envio de email
    if (step.emailData) {
        createEmailForm(step);
    }

    // Render botões de opções (sim/nao)
    if (step.options) {
        for (const [label, nextKey] of Object.entries(step.options)) {
            const btn = document.createElement("button");
            btn.textContent = label.charAt(0).toUpperCase() + label.slice(1);
            btn.onclick = () => renderStep(nextKey);
            buttonsEl.appendChild(btn);
        }
    }

    // Render botão próximo (se existir)
    if (step.next) {
        const nextBtn = document.createElement("button");
        nextBtn.innerHTML = `<i class="fa-solid fa-forward-step"></i>`;
        nextBtn.classList.add("next-icon");
        nextBtn.title = "Próximo";
        nextBtn.onclick = () => renderStep(step.next);

        const navDiv = document.querySelector(".nav-buttons");
        navDiv.appendChild(nextBtn);
    }

    // Atualizar estado do botão voltar
    backBtn.disabled = historyStack.length === 0;

    // Se for passo final, mostra resumo e botão para fluxo mermaid
    if (stepKey === findFinalStep()) {
        flowSummary.style.display = "flex";
        viewFlowBtn.style.display = "inline-block";
    }
}

// Função para criar formulário de email
function createEmailForm(step) {
    const emailForm = document.createElement("div");
    emailForm.classList.add("email-form");

    const msgLabel = document.createElement("label");
    msgLabel.textContent = "Mensagem:";
    const msgInput = document.createElement("textarea");
    msgInput.placeholder = "Descreva o ocorrido...";
    msgInput.rows = 4;

    const sendBtn = document.createElement("button");
    sendBtn.textContent = "Enviar Email";

    sendBtn.onclick = () => {
        const mensagem = msgInput.value.trim();
        if (!mensagem) {
            alert("Por favor, digite uma mensagem antes de enviar.");
            return;
        }

        const encodedMessage = encodeURIComponent(mensagem);
        const mailtoLink = `mailto:${step.emailData.to}?cc=${encodeURIComponent(
            step.emailData.cc || ""
        )}&subject=${encodeURIComponent(
            step.emailData.assunto || ""
        )}&body=${encodedMessage}`;
        window.location.href = mailtoLink;
    };

    emailForm.appendChild(msgLabel);
    emailForm.appendChild(msgInput);
    emailForm.appendChild(sendBtn);
    buttonsEl.appendChild(emailForm);
}

// Funções de navegação
function goBack() {
    if (historyStack.length > 0) {
        const prevStep = historyStack.pop();
        renderStep(prevStep, true);
    }
}

function resetFlow() {
    historyStack = [];
    if (currentStep) {
        renderStep(Object.keys(steps)[0]);
    }
}

// Encontrar passo final
function findFinalStep() {
    for (const key in steps) {
        if (steps[key].next === null && !steps[key].options) return key;
    }
    return null;
}

// Gerar gráfico Mermaid
function getMermaidGraph() {
    const isMobile = window.innerWidth <= 768;
    const direction = isMobile ? "TB" : "LR";

    let nodes = [];
    let links = [];

    for (const [id, step] of Object.entries(steps)) {
        const nodeId = id.replace(/\W/g, "_");
        const label = step.title;

        if (step.options) {
            nodes.push(`${nodeId}{"${label}"}`);
            if (step.options.sim) {
                links.push(
                    `${nodeId} -->|Sim| ${step.options.sim.replace(/\W/g, "_")}`
                );
            }
            if (step.options.nao) {
                links.push(
                    `${nodeId} -->|Não| ${step.options.nao.replace(/\W/g, "_")}`
                );
            }
        } else if (step.next) {
            nodes.push(`${nodeId}["${label}"]`);
            links.push(`${nodeId} --> ${step.next.replace(/\W/g, "_")}`);
        } else {
            nodes.push(`${nodeId}["${label}"]`);
        }
    }

    return `
    flowchart ${direction}
    %% Nós
    ${nodes.join("\n")}
    %% Ligações
    ${links.join("\n")}
  `;
}

// Mostrar fluxo Mermaid em nova janela com descrições
async function showMermaidFlow() {
    try {
        const graphDefinition = getMermaidGraph();
        const { svg } = await mermaid.render("theGraph", graphDefinition);

        const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visualização do Fluxo</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      background: #f2f4f8;
      position: relative;
    }
    .logo-fluxo {
      position: absolute;
      top: 20px;
      left: 20px;
      max-width: 120px;
      height: auto;
    }
    .container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .card {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 40px 50px;
      max-width: 1800px;
      width: 100%;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    .card h1 {
      margin-top: 0;
      margin-bottom: 30px;
      font-size: 26px;
      color: #6e6251;
      border-bottom: 2px solid #dcdcdc;
      padding-bottom: 10px;
    }
    svg {
      width: 100%;
      min-width: 700px;
      height: auto;
    }
    .action-buttons {
      position: absolute;
      top: 30px;
      right: 30px;
      display: flex;
      gap: 10px;
    }
    .action-btn {
      padding: 10px 15px;
      background-color: #6e6251;
      color: #fff;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1rem;
    }
    .action-btn:hover {
      background-color: #5d5448;
    }
    @media (max-width: 768px) {
      .card {
        padding: 20px;
      }
      .card h1 {
        font-size: 22px;
      }
      svg {
        min-width: unset;
      }
      .action-buttons {
        top: 15px;
        right: 15px;
      }
      .action-btn {
        padding: 8px 12px;
      }
    }
    .popup-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .popup-container {
      background-color: #ffffff;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 90%;
      max-height: 80vh; 
      overflow-y: auto; 
      display: flex;
      flex-direction: column;
    }
    .popup-container h2 {
      margin-top: 0;
      font-size: 1.5rem;
      color: #333;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .popup-content {
      flex-grow: 1; 
    }
    .step-item {
      margin-bottom: 20px;
    }
    .step-item h3 {
      margin: 0;
      font-size: 1.2rem;
      color: #6e6251;
    }
    .step-item p {
      margin-top: 5px;
      font-size: 1rem;
      line-height: 1.5;
      color: #555;
    }
    .email-info {
      margin-top: 10px;
      padding: 10px;
      background-color: #f8f8f8;
      border-radius: 5px;
      font-size: 0.9rem;
    }
    .email-info p {
      margin: 5px 0;
    }
    .close-popup-btn {
      margin-top: 20px;
      padding: 10px 20px;
      background-color: #6e6251;
      color: #fff;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1rem;
      align-self: flex-end; 
    }
    .close-popup-btn:hover {
      background-color: #5d5448;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
</head>
<body>
  <img src="https://th.bing.com/th/id/R.7b67ecdc4d616955a56466a343aab865?rik=Xv7df86hl9VGfA&riu=http%3a%2f%2fwww.kinross.com.br%2fwp-content%2fuploads%2f2019%2f01%2fKinrossParacatuCMYK.png&ehk=UMsgtz2KvV%2fe%2fuDUC5%2f6bwzOBMQxwD4cBeT1KQbp%2bLI%3d&risl=&pid=ImgRaw&r=0"
       alt="Logo Kinross" class="logo-fluxo" />
  <div class="container">
    <div class="card">
      <h1>Fluxo de Decisão</h1>
      ${svg}
      <div class="action-buttons">
        <button class="action-btn" id="popup-btn">Ver Descrições</button>
        <button class="action-btn" id="export-pdf-btn">Exportar PDF</button>
      </div>
    </div>
  </div>
  <script>
    // Função para verificar se as bibliotecas estão carregadas
    function checkLibrariesLoaded() {
      return new Promise((resolve) => {
        const check = () => {
          if (window.jspdf && window.html2canvas) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }

    // Inicialização após carregamento das bibliotecas
    async function initialize() {
      try {
        await checkLibrariesLoaded();
        
        const { jsPDF } = window.jspdf;
        const steps = ${JSON.stringify(steps)};
        
        // Função para criar popup de descrições
        function createPopup() {
          const overlay = document.createElement('div');
          overlay.classList.add('popup-overlay');

          const popupContainer = document.createElement('div');
          popupContainer.classList.add('popup-container');

          const header = document.createElement('h2');
          header.textContent = 'Descrições do Fluxo de Decisão';

          const content = document.createElement('div');
          content.classList.add('popup-content');

          for (const key in steps) {
            if (steps.hasOwnProperty(key)) {
              const stepData = steps[key];
              const stepDiv = document.createElement('div');
              stepDiv.classList.add('step-item');
              
              const stepTitle = document.createElement('h3');
              stepTitle.textContent = stepData.title;
              
              const stepDescription = document.createElement('p');
              stepDescription.textContent = stepData.description;
              
              stepDiv.appendChild(stepTitle);
              stepDiv.appendChild(stepDescription);
              
              if (stepData.emailData) {
                const emailInfo = document.createElement('div');
                emailInfo.classList.add('email-info');
                emailInfo.innerHTML = \`
                  <p><strong>Email Para:</strong> \${stepData.emailData.to}</p>
                  \${stepData.emailData.cc ? \`<p><strong>Email CC:</strong> \${stepData.emailData.cc}</p>\` : ''}
                  \${stepData.emailData.assunto ? \`<p><strong>Assunto:</strong> \${stepData.emailData.assunto}</p>\` : ''}
                \`;
                stepDiv.appendChild(emailInfo);
              }
              
              content.appendChild(stepDiv);
            }
          }

          const closeButton = document.createElement('button');
          closeButton.classList.add('close-popup-btn');
          closeButton.textContent = 'Fechar';
          closeButton.onclick = () => {
            document.body.removeChild(overlay);
          };

          popupContainer.appendChild(header);
          popupContainer.appendChild(content);
          popupContainer.appendChild(closeButton);
          overlay.appendChild(popupContainer);

          document.body.appendChild(overlay);
        }
        
        // Função para exportar para PDF
        async function exportToPDF() {
          try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('landscape');
            
            // Adicionar título e data
            pdf.setFontSize(20);
            pdf.text('Fluxo de Decisão', 140, 20, { align: 'center' });
            pdf.setFontSize(12);
            const today = new Date();
            pdf.text('Gerado em: ' + today.toLocaleDateString(), 20, 20);
            
            // Capturar imagem do fluxo
            const svgElement = document.querySelector('svg');
            const canvas = await html2canvas(svgElement.parentElement);
            const imgData = canvas.toDataURL('image/png');
            
            // Adicionar imagem ao PDF
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth() - 40;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 20, 30, pdfWidth, pdfHeight);
            
            // Adicionar descrições
            let yPosition = 40 + pdfHeight;
            pdf.setFontSize(16);
            pdf.text('Descrições dos Passos:', 20, yPosition);
            yPosition += 10;
            
            pdf.setFontSize(12);
            
            for (const key in steps) {
              if (steps.hasOwnProperty(key)) {
                const stepData = steps[key];
                
                if (yPosition > pdf.internal.pageSize.getHeight() - 50) {
                  pdf.addPage();
                  yPosition = 20;
                }
                
                pdf.setFont('helvetica', 'bold');
                pdf.text(stepData.title, 20, yPosition);
                yPosition += 7;
                
                pdf.setFont('helvetica', 'normal');
                const splitDesc = pdf.splitTextToSize(stepData.description, pdf.internal.pageSize.getWidth() - 40);
                pdf.text(splitDesc, 20, yPosition);
                yPosition += splitDesc.length * 7 + 5;
                
                if (stepData.emailData) {
                  pdf.setFont('helvetica', 'bold');
                  pdf.text('Informações de Email:', 20, yPosition);
                  yPosition += 7;
                  
                  pdf.setFont('helvetica', 'normal');
                  pdf.text('Para: ' + stepData.emailData.to, 25, yPosition);
                  yPosition += 7;
                  
                  if (stepData.emailData.cc) {
                    pdf.text('CC: ' + stepData.emailData.cc, 25, yPosition);
                    yPosition += 7;
                  }
                  
                  if (stepData.emailData.assunto) {
                    pdf.text('Assunto: ' + stepData.emailData.assunto, 25, yPosition);
                    yPosition += 7;
                  }
                  
                  yPosition += 5;
                }
                
                yPosition += 10;
              }
            }
            
            pdf.save('fluxo_decisao_' + new Date().toISOString().slice(0, 10) + '.pdf');
          } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar PDF: ' + error.message);
          }
        }
        
        // Adicionar event listeners
        document.getElementById('popup-btn').addEventListener('click', createPopup);
        document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
        
      } catch (error) {
        console.error('Erro na inicialização:', error);
        alert('Ocorreu um erro ao carregar as funcionalidades. Por favor, recarregue a página.');
      }
    }
    
    // Iniciar quando o DOM estiver pronto
    document.addEventListener('DOMContentLoaded', initialize);
  </script>
</body>
</html>
        `;

        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(htmlContent);
            newWindow.document.close();
        } else {
            alert(
                "Por favor, permita pop-ups para abrir a visualização do fluxo."
            );
        }
    } catch (err) {
        console.error("Erro ao gerar o fluxo:", err);
        alert("Erro ao gerar o fluxo: " + err.message);
    }
}

// Inicialização
if (Object.keys(steps).length === 0) {
    titleEl.textContent = "Fluxo de Ocorrências";
    descEl.textContent = "Selecione um arquivo Excel para começar.";
}
